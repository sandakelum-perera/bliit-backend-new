const mongoose = require("mongoose");

const postLikeSchema = new mongoose.Schema({
  student_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  post_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
    required: true,
  },
  created_at: { type: Date, default: Date.now },
});

// Compound index to ensure a student can only like a post once
postLikeSchema.index({ student_id: 1, post_id: 1 }, { unique: true });

module.exports = mongoose.model("PostLike", postLikeSchema);
