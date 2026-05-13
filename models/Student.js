const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
  },
  name: String,
  email: String,
  phone_number: String,
  date_of_birth: Date,
  address: String,
  education_level: String,
  interests: String,
  emergency_contact: String,
  emergency_phone: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Student", studentSchema);
