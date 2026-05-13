const Follow = require("../models/Follow");
const Student = require("../models/Student");
const Teacher = require("../models/Teacher");

// Follow a teacher
exports.followTeacher = async (req, res) => {
  try {
    const { student_id, teacher_id } = req.body;

    if (!student_id || !teacher_id) {
      return res.status(400).json({
        message: "Student ID and Teacher ID are required",
      });
    }

    // Verify student exists
    const student = await Student.findById(student_id);
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Verify teacher exists
    const teacher = await Teacher.findById(teacher_id);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found" });
    }

    // Check if already following
    const existingFollow = await Follow.findOne({ student_id, teacher_id });
    if (existingFollow) {
      return res.status(400).json({
        message: "Already following this teacher",
      });
    }

    // Create follow
    const follow = await Follow.create({
      student_id,
      teacher_id,
    });

    res.status(201).json({
      message: "Successfully followed teacher",
      follow,
    });
  } catch (error) {
    console.error("Error following teacher:", error);
    res.status(500).json({
      message: "Error following teacher",
      error: error.message,
    });
  }
};

// Unfollow a teacher
exports.unfollowTeacher = async (req, res) => {
  try {
    const { student_id, teacher_id } = req.body;

    if (!student_id || !teacher_id) {
      return res.status(400).json({
        message: "Student ID and Teacher ID are required",
      });
    }

    const follow = await Follow.findOneAndDelete({ student_id, teacher_id });

    if (!follow) {
      return res.status(404).json({
        message: "Follow relationship not found",
      });
    }

    res.status(200).json({
      message: "Successfully unfollowed teacher",
    });
  } catch (error) {
    console.error("Error unfollowing teacher:", error);
    res.status(500).json({
      message: "Error unfollowing teacher",
      error: error.message,
    });
  }
};

// Check if student is following a teacher
exports.checkFollowing = async (req, res) => {
  try {
    const { student_id, teacher_id } = req.params;

    const follow = await Follow.findOne({ student_id, teacher_id });

    res.status(200).json({
      isFollowing: !!follow,
    });
  } catch (error) {
    console.error("Error checking follow status:", error);
    res.status(500).json({
      message: "Error checking follow status",
      error: error.message,
    });
  }
};

// Get all teachers a student is following
exports.getFollowingTeachers = async (req, res) => {
  try {
    const { student_id } = req.params;

    const follows = await Follow.find({ student_id }).populate("teacher_id");

    res.status(200).json({
      teachers: follows.map((f) => f.teacher_id),
      count: follows.length,
    });
  } catch (error) {
    console.error("Error getting following teachers:", error);
    res.status(500).json({
      message: "Error getting following teachers",
      error: error.message,
    });
  }
};

// Get all followers of a teacher
exports.getTeacherFollowers = async (req, res) => {
  try {
    const { teacher_id } = req.params;

    const follows = await Follow.find({ teacher_id }).populate("student_id");

    res.status(200).json({
      students: follows.map((f) => f.student_id),
      count: follows.length,
    });
  } catch (error) {
    console.error("Error getting teacher followers:", error);
    res.status(500).json({
      message: "Error getting teacher followers",
      error: error.message,
    });
  }
};

// Get follower count for a teacher
exports.getFollowerCount = async (req, res) => {
  try {
    const { teacher_id } = req.params;

    const count = await Follow.countDocuments({ teacher_id });

    res.status(200).json({
      count,
    });
  } catch (error) {
    console.error("Error getting follower count:", error);
    res.status(500).json({
      message: "Error getting follower count",
      error: error.message,
    });
  }
};
