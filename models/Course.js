const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema({
  courseName: String,
  courseCode: String,
  creditHours: Number,
  registrationFee: Number,
  courseFee: Number,
  isFree: { type: Boolean, default: false },
  courseContact: String,
  coordinator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  instructor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
  description: String,
  category: String,
  rate: Number,
  lessons: Number,
  skill_level: String,
  language: String,
  published: Boolean,
  featured: Boolean,
  image: String,
  limitedTimeOffer: Boolean,
  limitedTimeOfferPrice: Number,
  certificateOfCompletion: Boolean,
  enrolled: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Course", courseSchema);
