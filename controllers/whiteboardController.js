const Whiteboard = require("../models/Whiteboard");

/** GET /api/whiteboards — list all boards owned by the authenticated user */
exports.list = async (req, res) => {
  try {
    const boards = await Whiteboard.find({ userId: req.user._id })
      .select("_id name thumbnail bgColor createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .lean();
    res.json(boards);
  } catch {
    res.status(500).json({ message: "Failed to list whiteboards" });
  }
};

/** GET /api/whiteboards/:id — load a single board (with full shape data) */
exports.get = async (req, res) => {
  try {
    const board = await Whiteboard.findOne({
      _id: req.params.id,
      userId: req.user._id,
    }).lean();
    if (!board) return res.status(404).json({ message: "Not found" });
    res.json(board);
  } catch {
    res.status(500).json({ message: "Failed to load whiteboard" });
  }
};

/** POST /api/whiteboards — create a new cloud whiteboard */
exports.create = async (req, res) => {
  try {
    const { name, shapes, slides, notation, bgColor, thumbnail } = req.body;
    const board = await Whiteboard.create({
      userId: req.user._id,
      name: name || "Untitled Whiteboard",
      shapes: shapes ?? [],
      slides: slides ?? [],
      notation: notation ?? null,
      bgColor,
      thumbnail,
    });
    res.status(201).json(board);
  } catch {
    res.status(500).json({ message: "Failed to save whiteboard" });
  }
};

/** PUT /api/whiteboards/:id — update an existing cloud whiteboard */
exports.update = async (req, res) => {
  try {
    const { name, shapes, slides, notation, bgColor, thumbnail } = req.body;
    const board = await Whiteboard.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { $set: { name, shapes, slides, notation, bgColor, thumbnail } },
      { new: true }
    ).lean();
    if (!board) return res.status(404).json({ message: "Not found" });
    res.json(board);
  } catch {
    res.status(500).json({ message: "Failed to update whiteboard" });
  }
};

/** DELETE /api/whiteboards/:id — delete a cloud whiteboard */
exports.remove = async (req, res) => {
  try {
    const board = await Whiteboard.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!board) return res.status(404).json({ message: "Not found" });
    res.json({ message: "Deleted" });
  } catch {
    res.status(500).json({ message: "Failed to delete whiteboard" });
  }
};
