const mongoose = require("mongoose");

const mcqAttemptSchema = new mongoose.Schema({
  user_id:        { type: mongoose.Schema.Types.ObjectId, ref: "User",          required: true },
  course_id:      { type: mongoose.Schema.Types.ObjectId, ref: "Course",        required: true },
  content_id:     { type: mongoose.Schema.Types.ObjectId, ref: "CourseContent", required: true },
  // Indices into the question bank that were shown in this attempt
  selectedIndices: [{ type: Number }],
  // answers[i] is the chosen option index for selectedIndices[i]
  answers:         [{ type: Number }],
  score:           { type: Number, required: true },
  total:           { type: Number, required: true },
  attempt_number:  { type: Number, required: true },
  created_at:      { type: Date, default: Date.now },
});

module.exports = mongoose.model("McqAttempt", mcqAttemptSchema);
