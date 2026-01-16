const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: { type: Number, min: 1, max: 5 },
  review_text: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Review', reviewSchema);