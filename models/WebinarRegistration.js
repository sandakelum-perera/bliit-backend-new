const mongoose = require('mongoose');

const webinarRegistrationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  country_code: { type: String, default: '+94' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WebinarRegistration', webinarRegistrationSchema);
