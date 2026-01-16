const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  courseName: String,
  courseCode: String,
  creditHours: Number,
  registrationFee: Number,
  courseFee: Number,
  courseContact: String,
  coordinator: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  description: String,
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
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Course', courseSchema);