const mongoose = require("mongoose");

// A student's graded answer for a study-plan final-test question. Saved
// automatically whenever POST /api/study-plan/evaluate succeeds, so the student
// (and later, teachers) can review performance over time. Stores the score plus
// the AI's qualitative breakdown: strengths, weaknesses and improvement points.
const studyPlanResultSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    // Optional link back to the plan this test belonged to.
    plan_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudyPlan",
      default: null,
    },
    // Context / question snapshot.
    className: { type: String, default: "" },
    subject: { type: String, default: "" },
    topic: { type: String, default: "" },
    subTopic: { type: String, default: "" },
    question: { type: String, default: "" },
    // Grading.
    verdict: {
      type: String,
      enum: ["correct", "partial", "incorrect"],
      default: "partial",
    },
    score: { type: Number, required: true },
    marks: { type: Number, required: true }, // total marks the question was out of
    feedback: { type: String, default: "" },
    // AI qualitative breakdown.
    strengths: [{ type: String }],
    weaknesses: [{ type: String }],
    improvements: [{ type: String }],
    created_at: { type: Date, default: Date.now },
  },
);

module.exports = mongoose.model("StudyPlanResult", studyPlanResultSchema);
