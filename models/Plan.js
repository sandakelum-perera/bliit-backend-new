const mongoose = require("mongoose");

/**
 * A subscription plan, stored per product so the Smart Canvas (web) and the
 * Smart Notebook (mobile app) can be priced and described independently.
 *
 * This is the source of truth for what a plan COSTS and what it INCLUDES:
 * `services/planStore` caches it in memory, and credit metering + PayHere
 * checkout both read it, so the price a student is shown is the price they are
 * charged.
 */
const planSchema = new mongoose.Schema({
  // Which app the plan belongs to.
  product: { type: String, enum: ["canvas", "notebook"], required: true, index: true },

  // Stable id used by the app / stored on User.aiPlan (e.g. "free", "pro25").
  planId: { type: String, required: true },

  name: { type: String, required: true },

  // Prices in LKR. 0 = free tier.
  price: { type: Number, default: 0 }, // per month
  priceYear: { type: Number, default: 0 }, // per year (already discounted)

  // AI credit allowance.
  monthly: { type: Number, default: 0 },
  daily: { type: Number, default: null }, // null = no daily cap

  // Bullet points shown on the plan card.
  features: [{ type: String }],

  // Badges the plan card as "Best Value".
  popular: { type: Boolean, default: false },

  // Display order, low first.
  sortOrder: { type: Number, default: 0 },

  // Hidden from the app when false, without deleting history.
  active: { type: Boolean, default: true },

  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// One plan id per product.
planSchema.index({ product: 1, planId: 1 }, { unique: true });

planSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

module.exports = mongoose.model("Plan", planSchema);
