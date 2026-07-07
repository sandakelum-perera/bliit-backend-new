const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  type: String,
  role: {
    type: String,
    enum: ["student", "teacher", "admin"],
    default: "student",
  },
  phone_number: String,
  email_verified_at: Date,
  profile_image: String,
  password: String,
  remember_token: String,
  google_id: String,
  googleId: String, // Alternative field name
  google_token: String,
  google_refresh_token: String,
  token: String,
  // ── AI subscription / credits ──
  aiPlan: {
    type: String,
    enum: ["free", "pro25", "pro40"],
    default: "free",
  },
  aiPlanExpiresAt: Date, // when a paid plan reverts to free (null for free)
  aiCredits: {
    monthUsed: { type: Number, default: 0 },
    monthKey: { type: String, default: "" }, // "YYYY-MM"
    dayUsed: { type: Number, default: 0 },
    dayKey: { type: String, default: "" }, // "YYYY-MM-DD"
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
