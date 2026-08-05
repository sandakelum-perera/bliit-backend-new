const mongoose = require('mongoose');

const bloomingCentreRegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  country_code: { type: String, default: '+94' },
  university: { type: String, required: true },
  degree_program: { type: String, required: true },
  semester: { type: String, required: true },
  finds_coursework_difficult: { type: String, enum: ['yes', 'somewhat', 'no'], required: true },
  struggle_areas: { type: String },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  payment_status: { type: String, enum: ['pending', 'paid'], default: 'pending' },
  payment_date: { type: Date },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('BloomingCentreRegistration', bloomingCentreRegistrationSchema);
