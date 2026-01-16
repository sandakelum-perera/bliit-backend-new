const mongoose = require('mongoose');

const classSchema = new mongoose.Schema({
  course_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  batch_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  title: String,
  description: String,
  scheduledDate: Date,
  duration: Number,
  meetLink: String,
  status: { type: String, enum: ['scheduled', 'ongoing', 'completed', 'cancelled'], default: 'scheduled' },
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  attendees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  recordingLink: String,
  notes: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Class', classSchema);