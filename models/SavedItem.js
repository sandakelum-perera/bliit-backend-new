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
    enum: ["study_plan", "mind_map", "ai_note", "note", "notebook"],
    required: true,
    index: true,
  },
  // The notebook this item lives in (null for top-level items). Notes created
  // inside a notebook point at that notebook's SavedItem _id.
  parent_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "SavedItem",
    default: null,
    index: true,
  },
  title: { type: String, default: "" },
  subtitle: { type: String, default: "" },
  // One-line blurb shown under the title in note lists.
  description: { type: String, default: "" },
  favorite: { type: Boolean, default: false },
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
// Listing the notes inside one notebook.
savedItemSchema.index({ user_id: 1, parent_id: 1, created_at: -1 });

module.exports = mongoose.model("SavedItem", savedItemSchema);
