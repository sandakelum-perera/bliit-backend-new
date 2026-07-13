const WebinarRegistration = require('../models/WebinarRegistration');

exports.createRegistration = async (req, res) => {
  const registration = new WebinarRegistration(req.body);
  try {
    const newRegistration = await registration.save();
    res.status(201).json(newRegistration);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getRegistrations = async (req, res) => {
  try {
    const registrations = await WebinarRegistration.find().sort({ created_at: -1 });
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
