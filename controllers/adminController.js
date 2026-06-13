const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const CourseContent = require("../models/CourseContent");
const Batch = require("../models/Batch");

// Assign active batch to any enrollments that are missing one
async function patchMissingBatches() {
  try {
    const unassigned = await Enrollment.find({ batch_id: { $exists: false } });
    for (const enrollment of unassigned) {
      const activeBatch = await Batch.findOne({ course_id: enrollment.course_id, status: "active" });
      if (activeBatch) {
        enrollment.batch_id = activeBatch._id;
        await enrollment.save();
      }
    }
  } catch (_) { /* non-critical background fix */ }
}

// Get all users with pagination and filters
exports.getAllUsers = async (req, res) => {
  try {
    const { page = 1, limit = 20, role } = req.query;
    const query = {};

    if (role) {
      query.role = role;
    }

    const users = await User.find(query)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ created_at: -1 });

    const count = await User.countDocuments(query);

    res.json({
      users,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get enrollment statistics
exports.getEnrollmentStats = async (req, res) => {
  try {
    const totalEnrollments = await Enrollment.countDocuments();
    const paidEnrollments = await Enrollment.countDocuments({
      payment_status: "paid",
    });
    const pendingEnrollments = await Enrollment.countDocuments({
      payment_status: "pending",
    });

    res.json({
      total: totalEnrollments,
      paid: paidEnrollments,
      pending: pendingEnrollments,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all enrollments with detailed information
exports.getAllEnrollments = async (req, res) => {
  patchMissingBatches();
  try {
    const { page = 1, limit = 20, payment_status, course_id } = req.query;
    const query = {};

    if (payment_status) {
      query.payment_status = payment_status;
    }
    if (course_id) {
      query.course_id = course_id;
    }

    const enrollments = await Enrollment.find(query)
      .populate({
        path: "student_id",
        populate: { path: "user_id" },
      })
      .populate("course_id")
      .populate("user_id")
      .populate("batch_id", "batchName batchCode status")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ enrollment_date: -1 });

    const count = await Enrollment.countDocuments(query);

    res.json({
      enrollments,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get paid enrollments
exports.getPaidEnrollments = async (req, res) => {
  patchMissingBatches();
  try {
    const { page = 1, limit = 20 } = req.query;

    const enrollments = await Enrollment.find({ payment_status: "paid" })
      .populate({
        path: "student_id",
        populate: { path: "user_id" },
      })
      .populate("course_id")
      .populate("user_id")
      .populate("batch_id", "batchName batchCode status")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ enrollment_date: -1 });

    const count = await Enrollment.countDocuments({ payment_status: "paid" });

    res.json({
      enrollments,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get dashboard statistics
exports.getDashboardStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalStudents = await Student.countDocuments();
    const totalTeachers = await Teacher.countDocuments();
    const totalCourses = await Course.countDocuments();
    const totalEnrollments = await Enrollment.countDocuments();
    const paidEnrollments = await Enrollment.countDocuments({
      payment_status: "paid",
    });

    // Get recent enrollments
    const recentEnrollments = await Enrollment.find()
      .populate({
        path: "student_id",
        populate: { path: "user_id" },
      })
      .populate("course_id")
      .limit(10)
      .sort({ enrollment_date: -1 });

    res.json({
      totalUsers,
      totalStudents,
      totalTeachers,
      totalCourses,
      totalEnrollments,
      paidEnrollments,
      recentEnrollments,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update user role
exports.updateUserRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!["student", "teacher", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { role, updated_at: Date.now() },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Also delete associated student/teacher records
    if (user.role === "student") {
      await Student.deleteMany({ user_id: userId });
    } else if (user.role === "teacher") {
      await Teacher.deleteMany({ user_id: userId });
    }

    res.json({ message: "User deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all students with their enrollment info
exports.getAllStudentsWithEnrollments = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const students = await Student.find()
      .populate("user_id")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ created_at: -1 });

    const count = await Student.countDocuments();

    // Get enrollment counts for each student
    const studentsWithEnrollments = await Promise.all(
      students.map(async (student) => {
        const enrollmentCount = await Enrollment.countDocuments({
          student_id: student._id,
        });
        const paidCount = await Enrollment.countDocuments({
          student_id: student._id,
          payment_status: "paid",
        });
        return {
          ...student.toObject(),
          enrollmentCount,
          paidCount,
        };
      }),
    );

    res.json({
      students: studentsWithEnrollments,
      totalPages: Math.ceil(count / limit),
      currentPage: page,
      total: count,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
