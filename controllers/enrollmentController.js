const Enrollment = require("../models/Enrollment");
const Student = require("../models/Student");
const Course = require("../models/Course");

exports.getEnrollments = async (req, res) => {
  try {
    const enrollments = await Enrollment.find()
      .populate("student_id")
      .populate("course_id")
      .populate("user_id");
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createEnrollment = async (req, res) => {
  try {
    const { student_id, course_id, user_id, payment_status } = req.body;

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      student_id,
      course_id,
    });
    if (existingEnrollment) {
      return res
        .status(400)
        .json({ message: "Already enrolled in this course" });
    }

    // Check if the course is free
    const course = await Course.findById(course_id);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // If course is free, automatically set payment_status to "paid" and status to "active"
    const enrollmentData = { ...req.body };
    if (course.isFree) {
      enrollmentData.payment_status = "paid";
      enrollmentData.status = "active";
      enrollmentData.payment_date = new Date();
    }

    const enrollment = new Enrollment(enrollmentData);
    const newEnrollment = await enrollment.save();

    // Only increment course enrollment count if payment is already confirmed
    if (enrollmentData.payment_status === "paid") {
      await Course.findByIdAndUpdate(course_id, { $inc: { enrolled: 1 } });
    }

    const populatedEnrollment = await Enrollment.findById(newEnrollment._id)
      .populate("student_id")
      .populate("course_id")
      .populate("user_id");

    res.status(201).json(populatedEnrollment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getEnrollmentById = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id)
      .populate("student_id")
      .populate("course_id")
      .populate("user_id");
    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found" });
    res.json(enrollment);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getEnrollmentsByStudent = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({
      student_id: req.params.studentId,
    })
      .populate("course_id")
      .populate("user_id");
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getEnrollmentsByUser = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({ user_id: req.params.userId })
      .populate({
        path: "course_id",
        populate: {
          path: "instructor_id",
          populate: {
            path: "user_id",
          },
        },
      })
      .populate("student_id");
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getEnrollmentsByCourse = async (req, res) => {
  try {
    const enrollments = await Enrollment.find({
      course_id: req.params.courseId,
    })
      .populate("student_id")
      .populate("user_id");
    res.json(enrollments);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateEnrollment = async (req, res) => {
  try {
    const oldEnrollment = await Enrollment.findById(req.params.id);
    if (!oldEnrollment)
      return res.status(404).json({ message: "Enrollment not found" });

    const oldPaymentStatus = oldEnrollment.payment_status;
    const newPaymentStatus = req.body.payment_status;

    const enrollment = await Enrollment.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updated_at: Date.now() },
      { new: true },
    )
      .populate("student_id")
      .populate("course_id")
      .populate("user_id");

    // Update course enrollment count if payment status changed
    if (oldPaymentStatus !== "paid" && newPaymentStatus === "paid") {
      // Changed from non-paid to paid - increment
      await Course.findByIdAndUpdate(enrollment.course_id._id, {
        $inc: { enrolled: 1 },
      });
    } else if (oldPaymentStatus === "paid" && newPaymentStatus !== "paid") {
      // Changed from paid to non-paid - decrement
      await Course.findByIdAndUpdate(enrollment.course_id._id, {
        $inc: { enrolled: -1 },
      });
    }

    res.json(enrollment);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteEnrollment = async (req, res) => {
  try {
    const enrollment = await Enrollment.findById(req.params.id);
    if (!enrollment)
      return res.status(404).json({ message: "Enrollment not found" });

    // Only decrement course enrollment count if it was a paid enrollment
    if (enrollment.payment_status === "paid") {
      await Course.findByIdAndUpdate(enrollment.course_id, {
        $inc: { enrolled: -1 },
      });
    }

    await enrollment.deleteOne();
    res.json({ message: "Enrollment deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
