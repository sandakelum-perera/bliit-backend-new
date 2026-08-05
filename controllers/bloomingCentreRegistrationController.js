const BloomingCentreRegistration = require('../models/BloomingCentreRegistration');

exports.createRegistration = async (req, res) => {
  const registration = new BloomingCentreRegistration(req.body);
  try {
    const newRegistration = await registration.save();
    res.status(201).json(newRegistration);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getRegistrations = async (req, res) => {
  try {
    const registrations = await BloomingCentreRegistration.find().sort({ created_at: -1 });
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Registrations belonging to the signed-in student, for the Blooming Centre dashboard.
exports.getMyRegistrations = async (req, res) => {
  try {
    const registrations = await BloomingCentreRegistration.find({ user_id: req.user._id }).sort({ created_at: -1 });
    res.json(registrations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Attaches the newly created / signed-in BLIIT account to a registration
// created before the student had an account (register -> sign up -> pay flow).
exports.linkUser = async (req, res) => {
  try {
    const registration = await BloomingCentreRegistration.findByIdAndUpdate(
      req.params.id,
      { user_id: req.user._id },
      { new: true },
    );
    if (!registration) {
      return res.status(404).json({ message: "Registration not found" });
    }
    res.json(registration);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
