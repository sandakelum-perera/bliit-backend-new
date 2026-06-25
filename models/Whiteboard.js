const mongoose = require("mongoose");

const whiteboardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: { type: String, default: "Untitled Whiteboard" },
    shapes: { type: mongoose.Schema.Types.Mixed, default: [] },
    slides: { type: mongoose.Schema.Types.Mixed, default: [] }, // PresentSlide[]
    notation: { type: String, default: null }, // JSON string via exportDiagramJSON
    bgColor: String,
    thumbnail: String, // small PNG data URL for preview
  },
  { timestamps: true }
);

module.exports = mongoose.model("Whiteboard", whiteboardSchema);
