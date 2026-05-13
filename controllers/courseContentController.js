const CourseContent = require("../models/CourseContent");
const Enrollment = require("../models/Enrollment");

exports.getCourseContents = async (req, res) => {
  try {
    const contents = await CourseContent.find().populate("course_id");
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
    const content = await CourseContent.findById(req.params.id).populate(
      "course_id",
    );
    if (!content)
      return res.status(404).json({ message: "Course content not found" });

    // Check if user has paid for the course (if userId is provided)
    const userId = req.query.userId || req.headers["x-user-id"];
    if (userId) {
      const enrollment = await Enrollment.findOne({
        user_id: userId,
        course_id: content.course_id._id,
        payment_status: "paid",
      });

      if (!enrollment) {
        return res.status(403).json({
          message:
            "You must enroll and pay for this course to access the content",
          requiresPayment: true,
        });
      }
    }

    res.json(content);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getContentsByCourseId = async (req, res) => {
  try {
    const userId = req.query.userId || req.headers["x-user-id"];

    // Determine if the user has paid for this course
    let hasPaid = false;
    if (userId) {
      const Course = require("../models/Course");
      const course = await Course.findById(req.params.courseId).select("isFree");
      if (course?.isFree) {
        // Free course: any enrollment counts as paid
        const enrollment = await Enrollment.findOne({
          user_id: userId,
          course_id: req.params.courseId,
        });
        hasPaid = !!enrollment;
      } else {
        const enrollment = await Enrollment.findOne({
          user_id: userId,
          course_id: req.params.courseId,
          payment_status: "paid",
        });
        hasPaid = !!enrollment;
      }
    }

    const contents = await CourseContent.find({
      course_id: req.params.courseId,
      published: true,
    }).sort({ order_index: 1, order: 1 });

    // Strip video/content URLs for users who have not paid
    if (!hasPaid) {
      const stripped = contents.map((c) => {
        const obj = c.toObject();
        delete obj.video_url;
        delete obj.content_url;
        return obj;
      });
      return res.json(stripped);
    }

    res.json(contents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateCourseContent = async (req, res) => {
  try {
    const content = await CourseContent.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    );
    if (!content)
      return res.status(404).json({ message: "Course content not found" });
    res.json(content);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteCourseContent = async (req, res) => {
  try {
    const content = await CourseContent.findByIdAndDelete(req.params.id);
    if (!content)
      return res.status(404).json({ message: "Course content not found" });
    res.json({ message: "Course content deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
