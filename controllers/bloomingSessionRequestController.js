const BloomingSessionRequest = require('../models/BloomingSessionRequest');
const BloomingCentreRegistration = require('../models/BloomingCentreRegistration');

exports.createRequest = async (req, res) => {
  try {
    const { registration_id, topic, description, preferred_date } = req.body;

    const registration = await BloomingCentreRegistration.findById(registration_id);
    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }
    if (String(registration.user_id) !== String(req.user._id)) {
      return res.status(403).json({ message: "This registration does not belong to you" });
    }
    if (registration.payment_status !== "paid") {
      return res.status(403).json({ message: "Payment is required before requesting sessions" });
    }

    const request = new BloomingSessionRequest({
      registration_id,
      user_id: req.user._id,
      topic,
      description,
      preferred_date,
    });
    const saved = await request.save();
    res.status(201).json(saved);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getMyRequests = async (req, res) => {
  try {
    const requests = await BloomingSessionRequest.find({ user_id: req.user._id }).sort({ created_at: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAllRequests = async (req, res) => {
  try {
    const requests = await BloomingSessionRequest.find().sort({ created_at: -1 });
    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
