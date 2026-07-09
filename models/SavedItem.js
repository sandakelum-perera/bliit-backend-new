const mongoose = require("mongoose");

// An item the student explicitly saved from the app (tapped "Save"): a study
// plan, a mind map, or an AI note. One collection backs the Notebook tabs and
// the home "Recent Activity" feed, so a single query can mix all three types.
//
// `data` holds the full payload needed to re-open the item without asking the
// AI again, and is kept as Mixed so the schema doesn't have to track every
// field the prompts evolve to produce.
const savedItemSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ["study_plan", "mind_map", "ai_note"],
    required: true,
    index: true,
  },
  title: { type: String, default: "" },
  subtitle: { type: String, default: "" },
  // Context the item was created for (empty for plain AI notes).
  className: { type: String, default: "" },
  subject: { type: String, default: "" },
  topic: { type: String, default: "" },
  subTopic: { type: String, default: "" },
  language: { type: String, default: "en" },
  // Full payload used to restore the item in the app.
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now },
});

// Newest-first listing per user, optionally narrowed by type.
savedItemSchema.index({ user_id: 1, type: 1, created_at: -1 });

module.exports = mongoose.model("SavedItem", savedItemSchema);
