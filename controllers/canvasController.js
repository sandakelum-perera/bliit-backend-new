/**
 * Canvas AI gateway. Proxies all of the Smart Canvas frontend's AI capabilities
 * (text, JSON, vision, vision+JSON, image generation, text-to-speech) so the
 * provider API keys live ONLY in the backend env (GEMINI_API_KEY / OPENAI_API_KEY)
 * and are never shipped to the browser. Each request carries a `provider`
 * ("gemini" | "openai"); Gemini is the default. Mirrors the request/response
 * shapes the frontend lib/gemini.ts and lib/openai.ts clients used directly.
 */

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_TTS_MODEL = "gemini-2.5-flash-preview-tts";
const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

const crypto = require("crypto");
const {
  PLAN_LIST,
  status: creditStatus,
  activate: activatePlan,
  consume: consumeCredits,
  costOf,
  PLANS,
} = require("../services/credits");

/* ── PayHere config (shared with paymentController) ───────────────────────── */
const PAYHERE_MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID || "1227569";
const PAYHERE_SECRET = process.env.PAYHERE_MERCHANT_SECRET || "your_merchant_secret";
const PAYHERE_MODE = process.env.PAYHERE_MODE || "sandbox";
const SUB_CURRENCY = process.env.PAYHERE_SUB_CURRENCY || "LKR";

function payhereHash(orderId, amount, currency) {
  const hashedSecret = crypto.createHash("md5").update(PAYHERE_SECRET).digest("hex").toUpperCase();
  const str =
    PAYHERE_MERCHANT_ID + orderId + parseFloat(amount).toFixed(2) + currency + hashedSecret;
  return crypto.createHash("md5").update(str).digest("hex").toUpperCase();
}

/** Days a billing period lasts. */
function periodDays(period) {
  return period === "year" ? 365 : 30;
}

/** Activate a paid plan + record/update the matching Subscription history row. */
async function activateSubscription(user, plan, orderId, amount, currency, period = "month") {
  await activatePlan(user, plan, periodDays(period)); // sets aiPlan, expiry, resets credits
  const Subscription = require("../models/Subscription");
  const now = new Date();
  const expiresAt = user.aiPlanExpiresAt;
  const update = {
    user_id: user._id,
    plan,
    period,
    orderId,
    status: "active",
    startedAt: now,
    expiresAt,
  };
  if (amount != null) update.amount = parseFloat(amount);
  if (currency) update.currency = currency;
  // Expire any previous active subscriptions for this user.
  await Subscription.updateMany(
    { user_id: user._id, status: "active", orderId: { $ne: orderId } },
    { $set: { status: "expired" } },
  );
  await Subscription.findOneAndUpdate({ orderId }, { $set: update }, { upsert: true, new: true });
}

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_IMAGE_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_MODEL = "gpt-4o";
const OPENAI_MAX_TOKENS = 8192;

function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function geminiKey() {
  const k = process.env.GEMINI_API_KEY;
  if (!k) throw httpErr(500, "GEMINI_API_KEY is not configured on the server.");
  return k;
}

function openaiKey() {
  const k = process.env.OPENAI_API_KEY;
  if (!k) throw httpErr(500, "OPENAI_API_KEY is not configured on the server.");
  return k;
}

function fail(res, err) {
  const status = err.status && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status === 429)
    return res.status(429).json({ error: "Rate limit exceeded. Please try again in a moment." });
  if (status === 402) return res.status(402).json({ error: "AI credits exhausted." });
  return res.status(status).json({ error: err.message || "AI gateway error" });
}

/* ── Gemini (native generateContent REST) ─────────────────────────────────── */
async function geminiCall(model, body) {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(geminiKey())}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw httpErr(res.status, `Gemini error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function geminiText(data) {
  if (data?.promptFeedback?.blockReason)
    throw httpErr(400, `Gemini blocked this prompt (${data.promptFeedback.blockReason}).`);
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || "").join("").trim();
}

function geminiInlinePart(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.find((p) => p.inlineData && p.inlineData.data) || null;
}

/* ── OpenAI (chat completions) ────────────────────────────────────────────── */
async function openaiChat(messages, opts = {}) {
  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${openaiKey()}` },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: opts.temperature ?? 0.5,
      max_tokens: OPENAI_MAX_TOKENS,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.json())?.error?.message || "";
    } catch {
      /* ignore */
    }
    throw httpErr(res.status, `OpenAI error ${res.status}${detail ? `: ${detail}` : ""}`);
  }
  const data = await res.json();
  const choice = data?.choices?.[0];
  return {
    text: (choice?.message?.content || "").trim(),
    finish: choice?.finish_reason || "",
    refusal: choice?.message?.refusal || null,
  };
}

function stripToJSON(text) {
  let t = (text || "").trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(t);
  if (fence) t = fence[1].trim();
  if (t[0] !== "{" && t[0] !== "[") {
    const first = t.search(/[{[]/);
    const last = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (first >= 0 && last > first) t = t.slice(first, last + 1);
  }
  return t.trim();
}

const JSON_SYSTEM =
  "You are a helpful, knowledgeable teacher building learning materials for students. " +
  "Always assist with the educational request. " +
  "Respond with a single valid JSON object only — no prose, no markdown, no code fences.";

const VISION_JSON_SYSTEM =
  "You are a patient, encouraging teacher. A student has shared a snapshot of their own " +
  "whiteboard / homework and wants to learn how to solve it. Always help: read what is shown " +
  "and give a clear, correct, step-by-step worked solution so the student can understand the " +
  "method. This is legitimate tutoring for learning. " +
  "Respond with a single valid JSON object only — no prose, no markdown, no code fences.";

/* ── Handlers ─────────────────────────────────────────────────────────────── */

// POST /api/canvas/text  { prompt, provider }
exports.text = async (req, res) => {
  try {
    const { prompt, provider } = req.body;
    if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: "prompt is required" });
    let text;
    if (provider === "openai") {
      const c = await openaiChat([{ role: "user", content: prompt }], { temperature: 0.8 });
      text = c.text;
    } else {
      const data = await geminiCall(GEMINI_MODEL, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8 },
      });
      text = geminiText(data);
    }
    if (!text) throw httpErr(502, "The AI returned an empty response.");
    res.json({ text });
  } catch (err) {
    console.error("canvas/text error:", err.message);
    fail(res, err);
  }
};

// POST /api/canvas/json  { prompt, provider }
exports.json = async (req, res) => {
  try {
    const { prompt, provider } = req.body;
    if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: "prompt is required" });
    let text;
    if (provider === "openai") {
      const messages = [
        { role: "system", content: JSON_SYSTEM },
        { role: "user", content: prompt },
      ];
      let c = await openaiChat(messages, { json: true, temperature: 0.7 });
      if (!c.text && !c.refusal) c = await openaiChat(messages, { json: false, temperature: 0.7 });
      text = stripToJSON(c.text);
    } else {
      const data = await geminiCall(GEMINI_MODEL, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
      });
      text = geminiText(data);
    }
    if (!text) throw httpErr(502, "The AI returned an empty response.");
    res.json({ text });
  } catch (err) {
    console.error("canvas/json error:", err.message);
    fail(res, err);
  }
};

// POST /api/canvas/vision  { prompt, imageBase64, mimeType, provider }
exports.vision = async (req, res) => {
  try {
    const { prompt, imageBase64, mimeType = "image/png", provider } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "imageBase64 is required" });
    let text;
    if (provider === "openai") {
      const c = await openaiChat(
        [
          {
            role: "user",
            content: [
              { type: "text", text: prompt || "" },
              { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            ],
          },
        ],
        { temperature: 0 },
      );
      text = c.text;
    } else {
      const data = await geminiCall(GEMINI_MODEL, {
        contents: [
          { role: "user", parts: [{ text: prompt || "" }, { inlineData: { mimeType, data: imageBase64 } }] },
        ],
        generationConfig: { temperature: 0.4 },
      });
      text = geminiText(data);
    }
    if (!text) throw httpErr(502, "The AI returned an empty response.");
    res.json({ text });
  } catch (err) {
    console.error("canvas/vision error:", err.message);
    fail(res, err);
  }
};

// POST /api/canvas/vision-json  { prompt, imageBase64, mimeType, provider }
exports.visionJSON = async (req, res) => {
  try {
    const { prompt, imageBase64, mimeType = "image/png", provider } = req.body;
    if (!imageBase64) return res.status(400).json({ error: "imageBase64 is required" });
    let text;
    if (provider === "openai") {
      const messages = [
        { role: "system", content: VISION_JSON_SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: prompt || "" },
            { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
          ],
        },
      ];
      let c = await openaiChat(messages, { json: true, temperature: 0.4 });
      if (!c.text && !c.refusal) c = await openaiChat(messages, { json: false, temperature: 0.4 });
      text = stripToJSON(c.text);
    } else {
      const data = await geminiCall(GEMINI_MODEL, {
        contents: [
          { role: "user", parts: [{ text: prompt || "" }, { inlineData: { mimeType, data: imageBase64 } }] },
        ],
        generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
      });
      text = geminiText(data);
    }
    if (!text) throw httpErr(502, "The AI returned an empty response.");
    res.json({ text });
  } catch (err) {
    console.error("canvas/vision-json error:", err.message);
    fail(res, err);
  }
};

// POST /api/canvas/image  { prompt, provider }  →  { dataUrl: string | null }
exports.image = async (req, res) => {
  try {
    const { prompt, provider } = req.body;
    if (!prompt || !String(prompt).trim()) return res.status(400).json({ error: "prompt is required" });

    if (provider === "openai") {
      const key = openaiKey();
      const call = (body) =>
        fetch(OPENAI_IMAGE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify(body),
        });
      let r = await call({ model: "gpt-image-1", prompt, n: 1, size: "1024x1024" });
      if (!r.ok && (r.status === 400 || r.status === 403 || r.status === 404)) {
        let msg = "";
        try {
          msg = (await r.clone().json())?.error?.message || "";
        } catch {
          /* ignore */
        }
        if (/model|not (found|available)|access|verif|gpt-image/i.test(msg))
          r = await call({ model: "dall-e-3", prompt, n: 1, size: "1024x1024" });
      }
      if (!r.ok) return res.json({ dataUrl: null });
      const data = await r.json();
      const b64 = data?.data?.[0]?.b64_json;
      if (b64) return res.json({ dataUrl: `data:image/png;base64,${b64}` });
      return res.json({ dataUrl: data?.data?.[0]?.url || null });
    }

    // Gemini native image model (best-effort — never hard-fails)
    try {
      const data = await geminiCall(GEMINI_IMAGE_MODEL, {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ["IMAGE"] },
      });
      const part = geminiInlinePart(data);
      if (!part) return res.json({ dataUrl: null });
      const mime = part.inlineData.mimeType || "image/png";
      return res.json({ dataUrl: `data:${mime};base64,${part.inlineData.data}` });
    } catch {
      return res.json({ dataUrl: null });
    }
  } catch (err) {
    console.error("canvas/image error:", err.message);
    fail(res, err);
  }
};

// POST /api/canvas/tts  { text, voiceName }  →  { audioBase64, mimeType } (Gemini only)
exports.tts = async (req, res) => {
  try {
    const { text, voiceName = "Kore" } = req.body;
    if (!text || !String(text).trim()) return res.status(400).json({ error: "text is required" });
    try {
      const data = await geminiCall(GEMINI_TTS_MODEL, {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
        },
      });
      const part = geminiInlinePart(data);
      if (!part) return res.json({ audioBase64: null });
      return res.json({ audioBase64: part.inlineData.data, mimeType: part.inlineData.mimeType || "" });
    } catch {
      return res.json({ audioBase64: null });
    }
  } catch (err) {
    console.error("canvas/tts error:", err.message);
    fail(res, err);
  }
};

// GET /api/canvas/credits  →  current standing + available plans
exports.credits = async (req, res) => {
  try {
    const st = creditStatus(req.user);
    // Persist any period reset that creditStatus() applied.
    req.user.save().catch(() => {});
    res.json({
      status: st,
      plans: PLAN_LIST.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        priceYear: p.priceYear,
        monthly: p.monthly,
        daily: p.daily,
      })),
    });
  } catch (err) {
    console.error("canvas/credits error:", err.message);
    res.status(500).json({ error: "Could not load credits." });
  }
};

// POST /api/canvas/charge  { kind }  →  deduct credits up-front for a multi-call
// action (e.g. an AI diagram presentation that then makes many free narration
// requests). Returns the updated standing, or 402 when the balance is too low.
exports.charge = async (req, res) => {
  try {
    const cost = costOf(req.body && req.body.kind);
    if (cost <= 0) return res.json({ ok: true, status: creditStatus(req.user) });
    const st = creditStatus(req.user);
    if (req.user.isModified()) req.user.save().catch(() => {});
    if (st.remaining < cost) {
      return res.status(402).json({
        error: `Not enough AI credits (${cost} needed, ${st.remaining} left). Upgrade your plan for more.`,
        code: "no_credits",
        credits: st,
      });
    }
    await consumeCredits(req.user, cost);
    res.json({ ok: true, status: creditStatus(req.user) });
  } catch (err) {
    console.error("canvas/charge error:", err.message);
    res.status(500).json({ error: "Could not charge credits." });
  }
};

// POST /api/canvas/plan  { userId?, plan }  →  assign a plan (admin only)
// Real billing (PayHere) plugs in here later; for now an admin assigns plans.
exports.setPlan = async (req, res) => {
  try {
    const { plan, userId } = req.body;
    if (!PLANS[plan]) return res.status(400).json({ error: "Unknown plan." });
    const User = require("../models/User");
    const target = userId ? await User.findById(userId) : req.user;
    if (!target) return res.status(404).json({ error: "User not found." });
    target.aiPlan = plan;
    await target.save();
    res.json({ ok: true, status: creditStatus(target) });
  } catch (err) {
    console.error("canvas/plan error:", err.message);
    res.status(500).json({ error: "Could not update plan." });
  }
};

/* ── PayHere subscription checkout ────────────────────────────────────────── */

// POST /api/canvas/subscribe  { plan, period }  →  PayHere payment object (hash)
exports.subscribe = async (req, res) => {
  try {
    const { plan } = req.body;
    const period = req.body.period === "year" ? "year" : "month";
    const def = PLANS[plan];
    if (!def) return res.status(400).json({ error: "Unknown plan." });
    const price = period === "year" ? def.priceYear : def.price;
    if (!price || price <= 0)
      return res.status(400).json({ error: "The Free plan does not require payment." });

    const user = req.user;
    const orderId = `AISUB_${user._id}_${plan}_${period}_${Date.now()}`;
    const amount = price.toFixed(2);
    const currency = SUB_CURRENCY;
    const frontend = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");
    const backend = process.env.BACKEND_URL || "http://localhost:3000";
    const [firstName, ...rest] = (user.name || "User").split(" ");

    // Record the pending purchase so it shows in history even before payment.
    try {
      const Subscription = require("../models/Subscription");
      await Subscription.create({
        user_id: user._id,
        plan,
        period,
        orderId,
        amount: price,
        currency,
        status: "pending",
      });
    } catch (e) {
      console.warn("subscription pending record failed:", e.message);
    }

    res.json({
      sandbox: PAYHERE_MODE === "sandbox",
      merchant_id: PAYHERE_MERCHANT_ID,
      return_url: `${frontend}/canvas?subscription=success`,
      cancel_url: `${frontend}/canvas?subscription=cancel`,
      notify_url: `${backend}/api/canvas/subscribe/notify`,
      order_id: orderId,
      items: `Smart Canvas ${def.name} plan — ${period === "year" ? "yearly" : "monthly"} (${def.monthly} AI credits/mo)`,
      amount,
      currency,
      hash: payhereHash(orderId, amount, currency),
      first_name: firstName,
      last_name: rest.join(" "),
      email: user.email,
      phone: user.phone_number || "",
      address: "",
      city: "Colombo",
      country: "Sri Lanka",
    });
  } catch (err) {
    console.error("canvas/subscribe error:", err.message);
    res.status(500).json({ error: "Could not start checkout." });
  }
};

// POST /api/canvas/subscribe/notify  (PayHere server-to-server — NO auth)
exports.subscribeNotify = async (req, res) => {
  try {
    const { merchant_id, order_id, payhere_amount, payhere_currency, status_code, md5sig } =
      req.body;
    const hashedSecret = crypto
      .createHash("md5")
      .update(PAYHERE_SECRET)
      .digest("hex")
      .toUpperCase();
    const localSig = crypto
      .createHash("md5")
      .update(
        String(merchant_id) +
          String(order_id) +
          String(payhere_amount) +
          String(payhere_currency) +
          String(status_code) +
          hashedSecret,
      )
      .digest("hex")
      .toUpperCase();

    if (localSig !== md5sig || String(status_code) !== "2") {
      console.warn("subscribe/notify rejected:", order_id, "status", status_code);
      return res.status(400).send("Verification failed");
    }

    const [prefix, userId, plan, period] = String(order_id).split("_");
    if (prefix !== "AISUB" || !PLANS[plan]) return res.status(400).send("Bad order id");

    const User = require("../models/User");
    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");
    await activateSubscription(user, plan, order_id, payhere_amount, payhere_currency, period);
    console.log(`Subscription activated: user ${userId} → ${plan} (${period})`);
    res.status(200).send("OK");
  } catch (err) {
    console.error("canvas/subscribe/notify error:", err.message);
    res.status(500).send("error");
  }
};

// POST /api/canvas/subscribe/confirm  { order_id }  (auth — client-side fallback)
// PayHere's notify is authoritative; this only activates immediately in sandbox
// (where notify can't reach localhost). In live mode it returns the current
// status and lets the server-to-server notify do the activation.
exports.subscribeConfirm = async (req, res) => {
  try {
    const { order_id } = req.body;
    const [prefix, userId, plan, period] = String(order_id || "").split("_");
    if (prefix !== "AISUB" || !PLANS[plan])
      return res.status(400).json({ error: "Invalid order id." });
    if (String(userId) !== String(req.user._id))
      return res.status(403).json({ error: "This order belongs to another account." });

    if (PAYHERE_MODE === "sandbox") {
      const price = period === "year" ? PLANS[plan].priceYear : PLANS[plan].price;
      await activateSubscription(req.user, plan, order_id, price, SUB_CURRENCY, period);
      return res.json({ ok: true, status: creditStatus(req.user) });
    }
    // Live: wait for the verified notify callback to activate.
    res.json({ ok: true, pending: true, status: creditStatus(req.user) });
  } catch (err) {
    console.error("canvas/subscribe/confirm error:", err.message);
    res.status(500).json({ error: "Could not confirm subscription." });
  }
};

// GET /api/canvas/subscription  →  current paid subscription + payment history
exports.subscription = async (req, res) => {
  try {
    const Subscription = require("../models/Subscription");
    const st = creditStatus(req.user);
    if (req.user.isModified()) req.user.save().catch(() => {});
    const history = await Subscription.find({ user_id: req.user._id })
      .sort({ created_at: -1 })
      .limit(20)
      .lean();
    const now = Date.now();
    const current =
      history.find(
        (s) => s.status === "active" && s.expiresAt && new Date(s.expiresAt).getTime() > now,
      ) || null;
    res.json({ status: st, current, history });
  } catch (err) {
    console.error("canvas/subscription error:", err.message);
    res.status(500).json({ error: "Could not load subscription." });
  }
};
