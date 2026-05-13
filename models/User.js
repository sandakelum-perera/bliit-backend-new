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
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
