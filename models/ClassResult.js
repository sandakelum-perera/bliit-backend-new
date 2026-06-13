const mongoose = require('mongoose');

const classResultSchema = new mongoose.Schema({
  class_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
  batch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  score: { type: Number, default: 0 },
  maxScore: { type: Number, default: 100 },
  grade: String,
  remarks: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

classResultSchema.index({ class_id: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model('ClassResult', classResultSchema);
