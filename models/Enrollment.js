const mongoose = require("mongoose");

const enrollmentSchema = new mongoose.Schema({
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  enrollment_date: { type: Date, default: Date.now },
  status: {
    type: String,
    enum: ["active", "completed", "dropped", "pending"],
    default: "pending",
  },
  progress: { type: Number, default: 0 }, // 0-100
  completed_at: Date,
  payment_status: {
    type: String,
    enum: ["pending", "paid", "failed", "refunded"],
    default: "pending",
  },
  payment_date: Date,
  payment_id: String,
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

// Prevent duplicate enrollments
enrollmentSchema.index({ student_id: 1, course_id: 1 }, { unique: true });

module.exports = mongoose.model("Enrollment", enrollmentSchema);
