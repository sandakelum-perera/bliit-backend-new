const Class = require('../models/Class');

exports.getClasses = async (req, res) => {
  try {
    const classes = await Class.find().populate('course_id').populate('batch_id').populate('instructor').populate('attendees');
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createClass = async (req, res) => {
  const classObj = new Class(req.body);
  try {
    const newClass = await classObj.save();
    res.status(201).json(newClass);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getClassById = async (req, res) => {
  try {
    const classObj = await Class.findById(req.params.id).populate('course_id').populate('batch_id').populate('instructor').populate('attendees');
    if (!classObj) return res.status(404).json({ message: 'Class not found' });
    res.json(classObj);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateClass = async (req, res) => {
  try {
    const classObj = await Class.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!classObj) return res.status(404).json({ message: 'Class not found' });
    res.json(classObj);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteClass = async (req, res) => {
  try {
    const classObj = await Class.findByIdAndDelete(req.params.id);
    if (!classObj) return res.status(404).json({ message: 'Class not found' });
    res.json({ message: 'Class deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getClassesByCourse = async (req, res) => {
  try {
    const classes = await Class.find({ course_id: req.params.courseId }).populate('course_id').populate('batch_id').populate('instructor').populate('attendees');
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getClassesByBatch = async (req, res) => {
  try {
    const classes = await Class.find({ batch_id: req.params.batchId }).populate('course_id').populate('batch_id').populate('instructor').populate('attendees');
    res.json(classes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};