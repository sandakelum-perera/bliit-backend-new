const Course = require("../models/Course");

exports.getCourses = async (req, res) => {
  try {
    const courses = await Course.find()
      .sort({ createdAt: -1 })
      .populate("coordinator")
      .populate({
        path: "instructor_id",
        populate: { path: "user_id" },
      })
      .populate("pathway_id", "name");
    if (courses.length === 0) {
      return res.json({ message: "No courses available" });
    }
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createCourse = async (req, res) => {
  const course = new Course(req.body);
  try {
    const newCourse = await course.save();
    res.status(201).json(newCourse);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getCourseById = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate("coordinator")
      .populate({
        path: "instructor_id",
        populate: { path: "user_id" },
      })
      .populate("pathway_id", "name description");
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCourseByCode = async (req, res) => {
  try {
    const course = await Course.findOne({ courseCode: req.params.code })
      .populate("coordinator")
      .populate({
        path: "instructor_id",
        populate: { path: "user_id" },
      });
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCoursesByCoordinator = async (req, res) => {
  try {
    const courses = await Course.find({ coordinator: req.params.coordinatorId })
      .populate("coordinator")
      .populate({
        path: "instructor_id",
        populate: { path: "user_id" },
      });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getCoursesByInstructor = async (req, res) => {
  try {
    console.log(
      "getCoursesByInstructor - instructorId:",
      req.params.instructorId,
    );
    const courses = await Course.find({
      instructor_id: req.params.instructorId,
    })
      .populate("coordinator")
      .populate({
        path: "instructor_id",
        populate: { path: "user_id" },
      });
    console.log("getCoursesByInstructor - found courses:", courses.length);
    res.json(courses);
  } catch (err) {
    console.error("getCoursesByInstructor - error:", err);
    res.status(500).json({ message: err.message });
  }
};

exports.updateCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getFeaturedCourses = async (req, res) => {
  try {
    const courses = await Course.find({ featured: true })
      .sort({ createdAt: -1 })
      .populate("coordinator")
      .populate({
        path: "instructor_id",
        populate: { path: "user_id" },
      });
    res.json(courses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteCourse = async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json({ message: "Course deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
