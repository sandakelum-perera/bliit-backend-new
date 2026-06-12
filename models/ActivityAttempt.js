const mongoose = require("mongoose");

const activityAttemptSchema = new mongoose.Schema({
  user_id:        { type: mongoose.Schema.Types.ObjectId, ref: "User",          required: true },
  course_id:      { type: mongoose.Schema.Types.ObjectId, ref: "Course",        required: true },
  content_id:     { type: mongoose.Schema.Types.ObjectId, ref: "CourseContent", required: true },
  activity_type:  String,
  score:          { type: Number, required: true },
  total:          { type: Number, required: true },
  attempt_number: { type: Number, required: true },
  // Per-item correctness so frontend can show detailed feedback
  feedback:       [{ type: Boolean }],
  created_at:     { type: Date, default: Date.now },
});

module.exports = mongoose.model("ActivityAttempt", activityAttemptSchema);
