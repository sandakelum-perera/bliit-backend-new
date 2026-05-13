const mongoose = require("mongoose");

const courseContentSchema = new mongoose.Schema({
  course_id: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  title: String,
  content: String,
  type: { type: String, enum: ["video", "document", "link", "assignment"] },
  video_url: String,
  content_url: String,
  description: String,
  order_index: Number,
  order: Number,
  published: { type: Boolean, default: false },
  duration: {
    value: Number,
    unit: { type: String, enum: ["hours", "days", "weeks", "months", "years"] },
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("CourseContent", courseContentSchema);
