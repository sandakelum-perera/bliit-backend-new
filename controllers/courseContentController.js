const CourseContent = require('../models/CourseContent');

exports.getCourseContents = async (req, res) => {
  try {
    const contents = await CourseContent.find();
    res.json(contents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createCourseContent = async (req, res) => {
  const content = new CourseContent(req.body);
  try {
    const newContent = await content.save();
    res.status(201).json(newContent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getCourseContentById = async (req, res) => {
  try {
    const content = await CourseContent.findById(req.params.id);
    if (!content) return res.status(404).json({ message: 'Course content not found' });
    res.json(content);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getContentsByCourseId = async (req, res) => {
  try {
    const contents = await CourseContent.find({ course_id: req.params.courseId });
    res.json(contents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateCourseContent = async (req, res) => {
  try {
    const content = await CourseContent.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!content) return res.status(404).json({ message: 'Course content not found' });
    res.json(content);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteCourseContent = async (req, res) => {
  try {
    const content = await CourseContent.findByIdAndDelete(req.params.id);
    if (!content) return res.status(404).json({ message: 'Course content not found' });
    res.json({ message: 'Course content deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};