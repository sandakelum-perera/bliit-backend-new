const AppRating = require("../models/AppRating");

/** The rating as the app wants to read it back. */
function publicRating(doc) {
  if (!doc) return null;
  return {
    rating: doc.rating,
    comment: doc.comment || "",
    updatedAt: doc.updated_at,
  };
}

// POST /api/app-rating  { rating, comment?, platform?, appVersion? }
//
// One rating per student: submitting again edits their existing one, so the
// average never drifts because somebody tapped the stars twice.
exports.submit = async (req, res) => {
  try {
    const rating = Number(req.body && req.body.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Please choose a rating from 1 to 5 stars." });
    }

    const doc = await AppRating.findOneAndUpdate(
      { user_id: req.user._id },
      {
        $set: {
          rating: Math.round(rating),
          comment: String((req.body && req.body.comment) || "").trim().slice(0, 1000),
          platform: String((req.body && req.body.platform) || ""),
          appVersion: String((req.body && req.body.appVersion) || ""),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.json({ ok: true, review: publicRating(doc) });
  } catch (err) {
    console.error("app-rating submit error:", err.message);
    res.status(500).json({ error: "Could not save your rating." });
  }
};

// GET /api/app-rating/me  →  the student's own rating, or null
exports.mine = async (req, res) => {
  try {
    const doc = await AppRating.findOne({ user_id: req.user._id }).lean();
    res.json({ review: publicRating(doc) });
  } catch (err) {
    console.error("app-rating mine error:", err.message);
    res.status(500).json({ error: "Could not load your rating." });
  }
};

// GET /api/app-rating/summary  →  { average, count }  (public)
exports.summary = async (req, res) => {
  try {
    const [agg] = await AppRating.aggregate([
      { $group: { _id: null, average: { $avg: "$rating" }, count: { $sum: 1 } } },
    ]);
    res.json({
      average: agg ? Math.round(agg.average * 10) / 10 : 0,
      count: agg ? agg.count : 0,
    });
  } catch (err) {
    console.error("app-rating summary error:", err.message);
    res.status(500).json({ error: "Could not load ratings." });
  }
};
