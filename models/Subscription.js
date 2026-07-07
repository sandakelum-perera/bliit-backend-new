const mongoose = require("mongoose");

/** One AI-subscription purchase / period. Acts as the payment + renewal history. */
const subscriptionSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  plan: { type: String, enum: ["pro25", "pro40"] },
  period: { type: String, enum: ["month", "year"], default: "month" },
  orderId: { type: String, index: true }, // PayHere order id (AISUB_...)
  amount: Number,
  currency: { type: String, default: "USD" },
  status: {
    type: String,
    enum: ["pending", "active", "expired", "cancelled"],
    default: "pending",
  },
  startedAt: Date,
  expiresAt: Date,
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Subscription", subscriptionSchema);
