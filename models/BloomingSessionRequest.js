const mongoose = require('mongoose');

const bloomingSessionRequestSchema = new mongoose.Schema({
  registration_id: { type: mongoose.Schema.Types.ObjectId, ref: 'BloomingCentreRegistration', required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  topic: { type: String, required: true },
  description: { type: String },
  preferred_date: { type: Date },
  status: { type: String, enum: ['pending', 'scheduled', 'completed', 'cancelled'], default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BloomingSessionRequest', bloomingSessionRequestSchema);
