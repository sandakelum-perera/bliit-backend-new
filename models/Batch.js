const mongoose = require('mongoose');

const batchSchema = new mongoose.Schema({
  course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  batchName: String,
  batchCode: String,
  startDate: Date,
  endDate: Date,
  capacity: Number,
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  description: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Batch', batchSchema);