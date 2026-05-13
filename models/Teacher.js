const mongoose = require("mongoose");

const teacherSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  name: String,
  email: String,
  phone_number: String,
  address: String,
  qualification: String,
  specialization: String,
  experience_years: String,
  subjects: String,
  bio: String,
  linkedin_profile: String,
  portfolio_url: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Teacher", teacherSchema);
