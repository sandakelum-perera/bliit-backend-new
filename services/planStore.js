/**
 * In-memory cache over the Plan collection.
 *
 * Credit metering runs on every AI request and is synchronous, so plans can't
 * be fetched from Mongo per call. Instead the collection is loaded once at
 * startup (seeding the defaults if it's empty) and kept in a cache that
 * `credits.js` and the PayHere checkout read from. Editing a plan in the DB and
 * calling `reload()` updates prices, credits and features everywhere at once.
 */

const Plan = require("../models/Plan");

const CANVAS = "canvas";
const NOTEBOOK = "notebook";

/** product -> planId -> plan (plain object) */
const _cache = { [CANVAS]: new Map(), [NOTEBOOK]: new Map() };
let _loaded = false;

/**
 * The plans the collection is seeded with the first time it runs. These mirror
 * the historic hard-coded plans, so seeding changes nothing for existing users
 * — the DB simply takes over as the source of truth.
 */
const DEFAULTS = [
  // ── Smart Notebook (mobile app) ───────────────────────────────────────────
  {
    product: NOTEBOOK,
    planId: "free",
    name: "Free",
    price: 0,
    priceYear: 0,
    monthly: 30,
    daily: 5,
    sortOrder: 0,
    features: [
      "30 AI credits every month",
      "Up to 5 credits per day",
      "AI notes, scanning & smart summaries",
      "MCQ & essay practice",
    ],
  },
  {
    product: NOTEBOOK,
    planId: "pro25",
    name: "Pro",
    price: 990,
    priceYear: 9900,
    monthly: 100,
    daily: null,
    sortOrder: 1,
    features: [
      "100 AI credits every month",
      "No daily cap — use them when you like",
      "AI notes, scanning & smart summaries",
      "MCQ & essay practice with grading",
      "AI study plans and mind maps",
    ],
  },
  {
    product: NOTEBOOK,
    planId: "pro40",
    name: "Premium",
    price: 1890,
    priceYear: 18900,
    monthly: 200,
    daily: null,
    popular: true,
    sortOrder: 2,
    features: [
      "200 AI credits every month",
      "No daily cap — use them when you like",
      "Everything in Pro",
      "Practice exams with AI analysis",
      "Study timetable with reminders",
      "Priority support",
    ],
  },
  {
    product: NOTEBOOK,
    planId: "pro100",
    name: "Ultimate",
    price: 4990,
    priceYear: 49900,
    monthly: 600,
    daily: null,
    sortOrder: 3,
    features: [
      "600 AI credits every month",
      "No daily cap — use them when you like",
      "Everything in Premium",
      "Best value per credit",
      "Early access to new features",
      "Priority support",
    ],
  },

  // ── Smart Canvas (web) ────────────────────────────────────────────────────
  {
    product: CANVAS,
    planId: "free",
    name: "Free",
    price: 0,
    priceYear: 0,
    monthly: 30,
    daily: 5,
    sortOrder: 0,
    features: ["30 AI credits every month", "Up to 5 credits per day"],
  },
  {
    product: CANVAS,
    planId: "pro25",
    name: "Pro",
    price: 1590,
    priceYear: 15900,
    monthly: 100,
    daily: null,
    sortOrder: 1,
    features: ["100 AI credits every month", "No daily cap"],
  },
  {
    product: CANVAS,
    planId: "pro40",
    name: "Premium",
    price: 13500,
    priceYear: 133500,
    monthly: 200,
    daily: null,
    popular: true,
    sortOrder: 2,
    features: ["200 AI credits every month", "No daily cap", "Priority support"],
  },
  {
    product: CANVAS,
    planId: "pro100",
    name: "Ultimate",
    price: 33500,
    priceYear: 334000,
    monthly: 600,
    daily: null,
    sortOrder: 3,
    features: ["600 AI credits every month", "No daily cap", "Priority support"],
  },
];

function _put(doc) {
  const plan = {
    product: doc.product,
    id: doc.planId,
    planId: doc.planId,
    name: doc.name,
    price: doc.price || 0,
    priceYear: doc.priceYear || 0,
    monthly: doc.monthly || 0,
    daily: doc.daily == null ? null : doc.daily,
    features: Array.isArray(doc.features) ? doc.features : [],
    popular: !!doc.popular,
    sortOrder: doc.sortOrder || 0,
  };
  _cache[doc.product]?.set(doc.planId, plan);
  return plan;
}

/** Seeds the defaults when the collection is empty, then fills the cache. */
async function init() {
  try {
    const count = await Plan.estimatedDocumentCount();
    if (count === 0) {
      await Plan.insertMany(DEFAULTS);
      console.log(`[plans] seeded ${DEFAULTS.length} default plans`);
    }
    await reload();
    _loaded = true;
  } catch (err) {
    // Never block boot on this — credits.js falls back to its own defaults.
    console.error("[plans] init failed:", err.message);
  }
}

/** Re-reads every active plan into the cache. */
async function reload() {
  const docs = await Plan.find({ active: true }).sort({ sortOrder: 1 }).lean();
  _cache[CANVAS].clear();
  _cache[NOTEBOOK].clear();
  docs.forEach(_put);
  return docs.length;
}

/** Every active plan for a product, cheapest first. */
function list(product) {
  return [..._cache[product]?.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

/** One plan, or null when it isn't cached (e.g. before init, or unknown id). */
function get(product, planId) {
  return _cache[product]?.get(planId) || null;
}

function loaded() {
  return _loaded;
}

module.exports = { CANVAS, NOTEBOOK, DEFAULTS, init, reload, list, get, loaded };
