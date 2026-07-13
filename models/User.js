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
  // Either a remote URL (e.g. the Google photo) or a base64 data URI when the
  // student uploaded and cropped their own picture in the app.
  profile_image: String,

  // ── Student profile, collected by the app's onboarding flow ──
  gender: { type: String, enum: ["male", "female", ""], default: "" },
  date_of_birth: Date,
  // Level id from the app's syllabus options, e.g. "10" or "degree".
  level: { type: String, default: "" },
  // Set once the student finishes onboarding, so it is only ever shown once.
  profile_completed: { type: Boolean, default: false },
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
    enum: ["free", "pro25", "pro40", "pro100"],
    default: "free",
  },
  aiPlanExpiresAt: Date, // when a paid plan reverts to free (null for free)
  aiCredits: {
    monthUsed: { type: Number, default: 0 },
    monthKey: { type: String, default: "" }, // "YYYY-MM"
    dayUsed: { type: Number, default: 0 },
    dayKey: { type: String, default: "" }, // "YYYY-MM-DD"
  },
  is_approved: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
