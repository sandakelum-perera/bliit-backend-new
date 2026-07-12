/**
 * Saved items — study plans, mind maps, notebooks and the notes inside them.
 * Backs the Notebook tabs, the notebook detail screen and the home "Recent
 * Activity" feed. Every route is scoped to the signed-in user (req.user._id).
 */

const mongoose = require("mongoose");
const SavedItem = require("../models/SavedItem");

const TYPES = ["study_plan", "mind_map", "ai_note", "note", "notebook"];

const str = (v) => (v == null ? "" : String(v).trim());

/** Returns a valid ObjectId, or null for empty/invalid input. */
function objectId(v) {
  const s = str(v);
  return s && mongoose.Types.ObjectId.isValid(s) ? new mongoose.Types.ObjectId(s) : null;
}

// POST /api/saved
// { type, parentId?, title, subtitle?, description?, favorite?, className?,
//   subject?, topic?, subTopic?, language?, data? }
exports.save = async (req, res) => {
  try {
    const type = str(req.body.type);
    if (!TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of ${TYPES.join(", ")}` });
    }
    const title = str(req.body.title);
    if (!title) return res.status(400).json({ error: "title is required" });

    const item = await SavedItem.create({
      user_id: req.user._id,
      type,
      parent_id: objectId(req.body.parentId),
      title,
      subtitle: str(req.body.subtitle),
      description: str(req.body.description),
      favorite: !!req.body.favorite,
      className: str(req.body.className),
      subject: str(req.body.subject),
      topic: str(req.body.topic),
      subTopic: str(req.body.subTopic),
      language: str(req.body.language) || "en",
      data: req.body.data || {},
    });
    res.status(201).json(item);
  } catch (err) {
    console.error("saved/save error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/saved?type=note&parentId=<notebookId>&limit=50 — newest first.
// `type` and `parentId` are optional. Pass parentId=none to fetch only
// top-level items (those not inside a notebook).
exports.list = async (req, res) => {
  try {
    const query = { user_id: req.user._id };

    const type = str(req.query.type);
    if (type) {
      if (!TYPES.includes(type)) {
        return res.status(400).json({ error: `type must be one of ${TYPES.join(", ")}` });
      }
      query.type = type;
    }

    const parentId = str(req.query.parentId);
    if (parentId === "none") {
      query.parent_id = null;
    } else if (parentId) {
      const oid = objectId(parentId);
      if (!oid) return res.status(400).json({ error: "parentId is not a valid id" });
      query.parent_id = oid;
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);

    const items = await SavedItem.find(query).sort({ created_at: -1 }).limit(limit).lean();
    res.json(items);
  } catch (err) {
    console.error("saved/list error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/saved/:id  { title?, description?, favorite?, data? }
exports.update = async (req, res) => {
  try {
    const patch = {};
    if (req.body.title !== undefined) patch.title = str(req.body.title);
    if (req.body.description !== undefined) patch.description = str(req.body.description);
    if (req.body.favorite !== undefined) patch.favorite = !!req.body.favorite;
    if (req.body.data !== undefined) patch.data = req.body.data;
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: "nothing to update" });
    }

    const updated = await SavedItem.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user._id },
      { $set: patch },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ error: "Saved item not found" });
    res.json(updated);
  } catch (err) {
    console.error("saved/update error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/saved/:id — deleting a notebook also deletes the notes inside it.
exports.remove = async (req, res) => {
  try {
    const deleted = await SavedItem.findOneAndDelete({
      _id: req.params.id,
      user_id: req.user._id,
    });
    if (!deleted) return res.status(404).json({ error: "Saved item not found" });

    if (deleted.type === "notebook") {
      await SavedItem.deleteMany({ user_id: req.user._id, parent_id: deleted._id });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error("saved/remove error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
