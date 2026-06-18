/**
 * AI subscription plans + credit metering. Every successful AI generation costs
 * one credit. Plans:
 *   - free   : 5 credits/day, capped at 30/month
 *   - pro25  : $25/mo  → 100 credits/month
 *   - pro40  : $40/mo  → 200 credits/month
 *   - pro100 : $100/mo → 600 credits/month
 * Counters reset automatically at the start of each day/month.
 */

const PLANS = {
  free: { id: "free", name: "Free", price: 0, priceYear: 0, monthly: 30, daily: 5 },
  pro25: { id: "pro25", name: "Pro", price: 8500, priceYear: 83500, monthly: 100, daily: null },
  pro40: { id: "pro40", name: "Premium", price: 13500, priceYear: 133500, monthly: 200, daily: null },
  pro100: { id: "pro100", name: "Ultimate", price: 33500, priceYear: 334000, monthly: 600, daily: null },
};

const PLAN_LIST = Object.values(PLANS);

/**
 * Per-operation credit costs. The frontend tags each AI request with a
 * `creditKind`; anything untagged falls back to DEFAULT_COST (1). `none` is a
 * zero-cost request — used for the follow-up calls of an action that was already
 * charged up front (e.g. each slide of an AI presentation after the one-time
 * "present" charge).
 */
const COSTS = {
  image: 4, // text → image generation
  solve: 3, // solve the board / a homework photo
  diagram: 2, // generate a notation diagram from a topic
  ai_voice: 1, // AI voice-over of one presentation slide (per node)
  present_si: 4, // narrate a diagram with AI — Sinhala (charged once)
  present_en: 3, // narrate a diagram with AI — English (charged once)
  none: 0, // already-charged follow-up request
};
const DEFAULT_COST = 1;

/** Credits an operation costs, by its `creditKind` tag (default 1). */
function costOf(kind) {
  if (kind == null) return DEFAULT_COST;
  return Object.prototype.hasOwnProperty.call(COSTS, kind) ? COSTS[kind] : DEFAULT_COST;
}

function periodKeys(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return { monthKey: `${y}-${m}`, dayKey: `${y}-${m}-${d}` };
}

function planOf(user) {
  return PLANS[user?.aiPlan] || PLANS.free;
}

/** Lazily revert an expired paid plan back to Free. Returns whether it changed. */
function enforceExpiry(user) {
  if (
    user.aiPlan &&
    user.aiPlan !== "free" &&
    user.aiPlanExpiresAt &&
    new Date(user.aiPlanExpiresAt).getTime() < Date.now()
  ) {
    user.aiPlan = "free";
    user.aiPlanExpiresAt = null;
    return true;
  }
  return false;
}

/** Roll the day/month counters over if we've crossed into a new period. */
function ensurePeriods(user) {
  if (!user.aiCredits) user.aiCredits = {};
  const c = user.aiCredits;
  const { monthKey, dayKey } = periodKeys();
  let changed = false;
  if (c.monthKey !== monthKey) {
    c.monthKey = monthKey;
    c.monthUsed = 0;
    changed = true;
  }
  if (c.dayKey !== dayKey) {
    c.dayKey = dayKey;
    c.dayUsed = 0;
    changed = true;
  }
  return changed;
}

/** Current credit standing for a user (after expiry + period resets). */
function status(user) {
  enforceExpiry(user);
  ensurePeriods(user);
  const plan = planOf(user);
  const c = user.aiCredits;
  const monthUsed = c.monthUsed || 0;
  const dayUsed = c.dayUsed || 0;
  const monthRemaining = Math.max(0, plan.monthly - monthUsed);
  const dayRemaining = plan.daily != null ? Math.max(0, plan.daily - dayUsed) : null;
  const remaining = dayRemaining != null ? Math.min(monthRemaining, dayRemaining) : monthRemaining;
  return {
    plan: plan.id,
    planName: plan.name,
    price: plan.price,
    monthlyLimit: plan.monthly,
    monthUsed,
    monthRemaining,
    dailyLimit: plan.daily,
    dayUsed,
    dayRemaining,
    remaining,
    expiresAt: user.aiPlanExpiresAt || null,
  };
}

/** Switch a user to a plan, set its expiry, and grant a fresh allowance. */
async function activate(user, plan, days = 30) {
  if (!PLANS[plan]) throw new Error("Unknown plan: " + plan);
  user.aiPlan = plan;
  user.aiPlanExpiresAt = plan === "free" ? null : new Date(Date.now() + days * 86400000);
  ensurePeriods(user); // stamp current day/month keys
  user.aiCredits.monthUsed = 0;
  user.aiCredits.dayUsed = 0;
  user.markModified("aiCredits");
  await user.save();
}

/** Consume `amount` credits (default 1). Persists the user. */
async function consume(user, amount = 1) {
  const n = Math.max(0, Math.floor(amount));
  if (n === 0) return;
  ensurePeriods(user);
  user.aiCredits.monthUsed = (user.aiCredits.monthUsed || 0) + n;
  user.aiCredits.dayUsed = (user.aiCredits.dayUsed || 0) + n;
  user.markModified("aiCredits");
  try {
    await user.save();
  } catch (e) {
    console.error("credit consume save failed:", e.message);
  }
}

/**
 * Express middleware for AI generation routes. Rejects with 402 when the user is
 * out of credits, otherwise charges one credit on a successful, result-bearing
 * response (2xx that isn't a null image/audio fallback).
 */
function aiCredits(req, res, next) {
  const user = req.user;
  if (!user) return res.status(401).json({ error: "Authentication required" });

  const cost = costOf(req.body && req.body.creditKind);
  // Zero-cost follow-up (e.g. each slide of an already-charged presentation):
  // skip metering entirely so it neither blocks nor deducts.
  if (cost === 0) return next();

  const st = status(user); // also reverts expired plans / rolls periods
  if (user.isModified()) user.save().catch(() => {});
  if (st.remaining < cost) {
    const dailyBlocked =
      st.dailyLimit != null && (st.dayRemaining ?? 0) < cost && st.monthRemaining >= cost;
    return res.status(402).json({
      error: dailyBlocked
        ? `Daily limit reached (${st.dailyLimit} per day). This action needs ${cost} credit${cost === 1 ? "" : "s"} — try again tomorrow or upgrade your plan.`
        : `Not enough AI credits (${cost} needed, ${st.remaining} left). Upgrade your plan for more.`,
      code: "no_credits",
      credits: st,
    });
  }

  const sendJson = res.json.bind(res);
  res.json = async (body) => {
    try {
      const ok = res.statusCode >= 200 && res.statusCode < 300;
      const noResult = body && (body.dataUrl === null || body.audioBase64 === null);
      // Charge before sending so a follow-up balance fetch is always accurate.
      if (ok && !noResult) await consume(user, cost);
    } catch {
      /* never block the response on metering */
    }
    return sendJson(body);
  };
  next();
}

module.exports = {
  PLANS,
  PLAN_LIST,
  COSTS,
  costOf,
  planOf,
  status,
  consume,
  activate,
  enforceExpiry,
  ensurePeriods,
  aiCredits,
};
