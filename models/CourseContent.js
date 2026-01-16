const mongoose = require('mongoose');

const courseContentSchema = new mongoose.Schema({
  course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  title: String,
  content: String,
  order: Number,
  duration: {
    value: Number,
    unit: { type: String, enum: ['hours', 'days', 'weeks', 'months', 'years'] }
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CourseContent', courseContentSchema);