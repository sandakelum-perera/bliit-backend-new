const mongoose = require("mongoose");

const pathwaySchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  image: String,
  order: { type: Number, default: 0 },
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  published: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Pathway", pathwaySchema);
