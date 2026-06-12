const mongoose = require("mongoose");

const mcqQuestionSchema = new mongoose.Schema(
  {
    question:     { type: String, required: true },
    options:      [{ type: String }],
    correctIndex: { type: Number, required: true },
  },
  { _id: true },
);

const fillBlankItemSchema = new mongoose.Schema(
  { text: String, blanks: [String] },
  { _id: true },
);

const activityPairSchema = new mongoose.Schema(
  { left: String, right: String },
  { _id: true },
);

const courseContentSchema = new mongoose.Schema({
  course_id:   { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  title:       String,
  content:     String,
  type:        { type: String, enum: ["video", "document", "link", "assignment", "quiz", "activity"] },
  video_url:   String,
  content_url: String,
  description: String,
  order_index: Number,
  order:       Number,
  published:   { type: Boolean, default: false },
  duration: {
    value: Number,
    unit:  { type: String, enum: ["hours", "days", "weeks", "months", "years"] },
  },
  mcq: {
    maxAttempts:        { type: Number, default: 1, min: 1 },
    questionsPerAttempt:{ type: Number, default: 0 },
    questions:          [mcqQuestionSchema],
  },
  // Interactive activity (fill-blank, matching, drag-drop, ordering, word-puzzle)
  activity: {
    activityType: { type: String, enum: ["fill-blank", "matching", "drag-drop", "ordering", "word-puzzle"] },
    maxAttempts:  { type: Number, default: 1, min: 1 },
    instructions: String,
    // fill-blank: list of sentences with [blank] markers + correct answers
    fillBlanks:   [fillBlankItemSchema],
    // matching / drag-drop: left-right pairs
    pairs:        [activityPairSchema],
    // ordering: items stored in correct order
    orderItems:   [String],
    // word-puzzle: sentences whose words are scrambled
    sentences:    [String],
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CourseContent", courseContentSchema);
