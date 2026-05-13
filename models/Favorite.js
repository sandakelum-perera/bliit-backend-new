const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  course_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  created_at: { type: Date, default: Date.now },
});

// Ensure a user can't favorite the same course twice
favoriteSchema.index({ user_id: 1, course_id: 1 }, { unique: true });

module.exports = mongoose.model("Favorite", favoriteSchema);
