const mongoose = require("mongoose");

/**
 * A student's rating of the Bliit Smart Notebook app itself (stars + comment),
 * captured by the in-app "Rate us" prompt.
 *
 * Distinct from Review, which rates a course. One rating per user — rating
 * again updates the existing row rather than stacking duplicates.
 */
const appRatingSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true, maxlength: 1000 },
    platform: { type: String, default: "" }, // "android" | "ios"
    appVersion: { type: String, default: "" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } },
);

module.exports = mongoose.model("AppRating", appRatingSchema);
