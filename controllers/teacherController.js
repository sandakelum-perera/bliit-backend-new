const Teacher = require("../models/Teacher");

exports.getTeachers = async (req, res) => {
  try {
    const teachers = await Teacher.find().populate({
      path: "user_id",
      match: { is_approved: true },
    });
    // populate returns null for user_id when the match condition isn't met
    res.json(teachers.filter((t) => t.user_id !== null));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createTeacher = async (req, res) => {
  const teacher = new Teacher(req.body);
  try {
    const newTeacher = await teacher.save();
    res.status(201).json(newTeacher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getTeacherById = async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.params.id).populate("user_id");
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getTeacherByEmail = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({ email: req.params.email });
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getTeacherByUserId = async (req, res) => {
  try {
    const teacher = await Teacher.findOne({
      user_id: req.params.userId,
    }).populate("user_id", "profile_image");
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json(teacher);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateTeacher = async (req, res) => {
  try {
    const teacher = await Teacher.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!teacher) return res.status(404).json({ message: "Teacher not found" });
    res.json(teacher);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};
