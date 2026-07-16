const mongoose = require("mongoose");

// A student's attempt at a full AI-generated Practice Exam (Grade 5 / O/L / A/L).
// Stores the score, the timing, the per-area breakdown that drives the
// strength/weakness analysis, and the AI advice — enough to show in history and
// on the Progress dashboard without regenerating anything.

const areaSchema = new mongoose.Schema(
  {
    area: { type: String, required: true }, // topic / section the questions covered
    correct: { type: Number, default: 0 },
    total: { type: Number, default: 0 },
  },
  { _id: false },
);

const examAttemptSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  exam: { type: String, default: "" }, // 'grade5' | 'ol' | 'al'
  examLabel: { type: String, default: "" }, // e.g. "O/L"
  subject: { type: String, default: "" },
  medium: { type: String, default: "en" }, // 'en' | 'si'

  // MCQ marks (the essay section is self-marked from the scheme).
  score: { type: Number, required: true },
  total: { type: Number, required: true },
  percentage: { type: Number, required: true },

  timeTakenSec: { type: Number, default: 0 },
  timeLimitSec: { type: Number, default: 0 },

  areas: [areaSchema],

  // AI analysis of the MCQ performance.
  strengths: [{ type: String }],
  weaknesses: [{ type: String }],
  improvements: [{ type: String }],

  created_at: { type: Date, default: Date.now },
});

examAttemptSchema.index({ user_id: 1, created_at: -1 });

module.exports = mongoose.model("ExamAttempt", examAttemptSchema);
