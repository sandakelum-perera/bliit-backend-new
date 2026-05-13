const mongoose = require("mongoose");

const followSchema = new mongoose.Schema({
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  teacher_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
  },
  created_at: { type: Date, default: Date.now },
});

// Compound index to ensure a student can only follow a teacher once
followSchema.index({ student_id: 1, teacher_id: 1 }, { unique: true });

module.exports = mongoose.model("Follow", followSchema);
