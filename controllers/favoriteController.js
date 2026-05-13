const Favorite = require("../models/Favorite");

// Get all favorites
exports.getFavorites = async (req, res) => {
  try {
    const favorites = await Favorite.find()
      .populate("user_id")
      .populate({
        path: "course_id",
        populate: [
          { path: "coordinator" },
          {
            path: "instructor_id",
            populate: { path: "user_id" },
          },
        ],
      });
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Create a new favorite
exports.createFavorite = async (req, res) => {
  try {
    // Check if favorite already exists
    const existingFavorite = await Favorite.findOne({
      user_id: req.body.user_id,
      course_id: req.body.course_id,
    });

    if (existingFavorite) {
      return res.status(400).json({ message: "Course already favorited" });
    }

    const favorite = new Favorite(req.body);
    const newFavorite = await favorite.save();
    const populatedFavorite = await Favorite.findById(newFavorite._id)
      .populate("user_id")
      .populate({
        path: "course_id",
        populate: {
          path: "instructor_id",
          populate: { path: "user_id" },
        },
      });
    res.status(201).json(populatedFavorite);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Get favorite by ID
exports.getFavoriteById = async (req, res) => {
  try {
    const favorite = await Favorite.findById(req.params.id)
      .populate("user_id")
      .populate({
        path: "course_id",
        populate: {
          path: "instructor_id",
          populate: { path: "user_id" },
        },
      });
    if (!favorite)
      return res.status(404).json({ message: "Favorite not found" });
    res.json(favorite);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Delete a favorite
exports.deleteFavorite = async (req, res) => {
  try {
    const favorite = await Favorite.findByIdAndDelete(req.params.id);
    if (!favorite)
      return res.status(404).json({ message: "Favorite not found" });
    res.json({ message: "Favorite removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get favorites by user ID
exports.getFavoritesByUserId = async (req, res) => {
  try {
    const favorites = await Favorite.find({ user_id: req.params.userId })
      .populate("user_id")
      .populate({
        path: "course_id",
        populate: [
          { path: "coordinator" },
          {
            path: "instructor_id",
            populate: { path: "user_id" },
          },
        ],
      });
    res.json(favorites);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Remove favorite by user and course ID
exports.removeFavoriteByUserAndCourse = async (req, res) => {
  try {
    const favorite = await Favorite.findOneAndDelete({
      user_id: req.params.userId,
      course_id: req.params.courseId,
    });
    if (!favorite)
      return res.status(404).json({ message: "Favorite not found" });
    res.json({ message: "Favorite removed" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Check if user has favorited a course
exports.checkFavorite = async (req, res) => {
  try {
    const favorite = await Favorite.findOne({
      user_id: req.params.userId,
      course_id: req.params.courseId,
    });
    res.json({ isFavorited: !!favorite, favorite });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
