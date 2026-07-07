const User = require("../models/User");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");
const Course = require("../models/Course");
const Enrollment = require("../models/Enrollment");
const CourseContent = require("../models/CourseContent");
const Batch = require("../models/Batch");
const Subscription = require("../models/Subscription");
const { status: creditStatus, PLANS } = require("../services/credits");

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
    const { page = 1, limit = 20, role, search } = req.query;
    const query = {};

    if (role) {
      query.role = role;
    }
    if (search) {
      const re = new RegExp(search, "i");
      query.$or = [{ name: re }, { email: re }];
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const oldRole = user.role;

    // Remove old role record when role changes
    if (oldRole === "student" && role !== "student") {
      await Student.deleteOne({ user_id: userId });
    } else if (oldRole === "teacher" && role !== "teacher") {
      await Teacher.deleteOne({ user_id: userId });
    }

    // Create new role record if one doesn't already exist
    if (role === "student" && oldRole !== "student") {
      const exists = await Student.findOne({ user_id: userId });
      if (!exists) {
        await Student.create({
          user_id: userId,
          name: user.name,
          email: user.email,
          phone_number: user.phone_number,
        });
      }
    } else if (role === "teacher" && oldRole !== "teacher") {
      const exists = await Teacher.findOne({ user_id: userId });
      if (!exists) {
        await Teacher.create({
          user_id: userId,
          name: user.name,
          email: user.email,
          phone_number: user.phone_number,
        });
      }
    }

    user.role = role;
    user.updated_at = Date.now();
    await user.save();

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

// Get all pending teacher accounts awaiting admin approval
exports.getPendingTeachers = async (req, res) => {
  try {
    const pendingUsers = await User.find({ role: "teacher", is_approved: false });
    const userIds = pendingUsers.map((u) => u._id);
    const teachers = await Teacher.find({ user_id: { $in: userIds } }).populate("user_id");
    res.json(teachers);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Approve a teacher account
exports.approveTeacher = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndUpdate(
      userId,
      { is_approved: true, updated_at: Date.now() },
      { new: true },
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "Teacher approved", user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Reject a teacher account (deletes the user and teacher record)
exports.rejectTeacher = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findByIdAndDelete(userId);
    if (!user) return res.status(404).json({ message: "User not found" });
    await Teacher.deleteMany({ user_id: userId });
    res.json({ message: "Teacher rejected and removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get payment history: paid course enrollments + AI subscriptions
exports.getPaymentHistory = async (req, res) => {
  try {
    const { page = 1, limit = 50, type } = req.query;

    let coursePayments = [];
    let aiSubscriptions = [];

    if (!type || type === "course") {
      coursePayments = await Enrollment.find({ payment_status: "paid" })
        .populate({ path: "student_id", populate: { path: "user_id", select: "name email" } })
        .populate("course_id", "courseName courseCode courseFee limitedTimeOffer limitedTimeOfferPrice")
        .populate("batch_id", "batchName batchCode")
        .sort({ payment_date: -1 })
        .lean();

      coursePayments = coursePayments.map((e) => {
        const fee =
          e.course_id?.limitedTimeOffer && e.course_id?.limitedTimeOfferPrice
            ? e.course_id.limitedTimeOfferPrice
            : e.course_id?.courseFee || 0;
        return {
          _id: e._id,
          type: "course",
          studentName: e.student_id?.user_id?.name || e.student_id?.name || "Unknown",
          email: e.student_id?.user_id?.email || e.student_id?.email || "",
          courseName: e.course_id?.courseName || "",
          courseCode: e.course_id?.courseCode || "",
          batchName: e.batch_id?.batchName || "",
          amount: fee,
          currency: "LKR",
          date: e.payment_date || e.enrollment_date,
          status: "paid",
        };
      });
    }

    if (!type || type === "ai") {
      aiSubscriptions = await Subscription.find({ status: { $in: ["active", "expired", "cancelled"] } })
        .populate("user_id", "name email")
        .sort({ startedAt: -1 })
        .lean();

      aiSubscriptions = aiSubscriptions.map((s) => ({
        _id: s._id,
        type: "ai_subscription",
        studentName: s.user_id?.name || "Unknown",
        email: s.user_id?.email || "",
        plan: s.plan,
        period: s.period,
        amount: s.amount || 0,
        currency: s.currency || "LKR",
        date: s.startedAt || s.created_at,
        expiresAt: s.expiresAt,
        status: s.status,
      }));
    }

    const all = [...coursePayments, ...aiSubscriptions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    const total = all.length;
    const start = (page - 1) * limit;
    const paginated = all.slice(start, start + Number(limit));

    res.json({
      payments: paginated,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      summary: {
        totalCoursePayments: coursePayments.length,
        totalAiSubscriptions: aiSubscriptions.length,
        totalRevenueLKR: [...coursePayments, ...aiSubscriptions]
          .filter((p) => p.currency === "LKR")
          .reduce((sum, p) => sum + (p.amount || 0), 0),
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get AI credits overview for all users
exports.getCreditsOverview = async (req, res) => {
  try {
    const { page = 1, limit = 50, plan } = req.query;
    const query = {};
    if (plan) query.aiPlan = plan;

    const users = await User.find(query)
      .select("name email role aiPlan aiPlanExpiresAt aiCredits created_at")
      .sort({ created_at: -1 })
      .lean();

    const enriched = users.map((u) => {
      const planDef = PLANS[u.aiPlan] || PLANS.free;
      const credits = u.aiCredits || {};
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const monthUsed = credits.monthKey === monthKey ? (credits.monthUsed || 0) : 0;
      const monthRemaining = Math.max(0, planDef.monthly - monthUsed);
      const isExpired =
        u.aiPlan !== "free" && u.aiPlanExpiresAt && new Date(u.aiPlanExpiresAt) < now;

      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        plan: isExpired ? "free" : (u.aiPlan || "free"),
        planName: isExpired ? "Free" : planDef.name,
        monthlyLimit: isExpired ? PLANS.free.monthly : planDef.monthly,
        monthUsed,
        monthRemaining: isExpired ? Math.max(0, PLANS.free.monthly - monthUsed) : monthRemaining,
        expiresAt: u.aiPlanExpiresAt || null,
        isExpired: !!isExpired,
      };
    });

    const filtered = plan
      ? enriched.filter((u) => u.plan === plan)
      : enriched;

    const total = filtered.length;
    const start = (page - 1) * limit;
    const paginated = filtered.slice(start, start + Number(limit));

    const planCounts = Object.keys(PLANS).reduce((acc, p) => {
      acc[p] = enriched.filter((u) => u.plan === p).length;
      return acc;
    }, {});

    res.json({
      users: paginated,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: Number(page),
      planCounts,
    });
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
