const Batch = require('../models/Batch');

exports.getBatches = async (req, res) => {
  try {
    const batches = await Batch.find().populate('course_id');
    res.json(batches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createBatch = async (req, res) => {
  const batch = new Batch(req.body);
  try {
    const newBatch = await batch.save();
    res.status(201).json(newBatch);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getBatchById = async (req, res) => {
  try {
    const batch = await Batch.findById(req.params.id).populate('course_id');
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    res.json(batch);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateBatch = async (req, res) => {
  try {
    const batch = await Batch.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    res.json(batch);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteBatch = async (req, res) => {
  try {
    const batch = await Batch.findByIdAndDelete(req.params.id);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    res.json({ message: 'Batch deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getBatchesByCourse = async (req, res) => {
  try {
    const batches = await Batch.find({ course_id: req.params.courseId }).populate('course_id');
    res.json(batches);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};