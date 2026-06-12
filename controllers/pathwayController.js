const Pathway = require("../models/Pathway");
const Course = require("../models/Course");

exports.getPathways = async (req, res) => {
  try {
    const pathways = await Pathway.find()
      .populate("courses", "courseName courseCode image category skill_level published")
      .sort({ order: 1, created_at: 1 });
    res.json(pathways);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPublishedPathways = async (req, res) => {
  try {
    const pathways = await Pathway.find({ published: true })
      .populate({
        path: "courses",
        match: { published: true },
        select: "courseName courseCode image category skill_level courseFee isFree enrolled",
      })
      .sort({ order: 1, created_at: 1 });
    res.json(pathways);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getPathwayById = async (req, res) => {
  try {
    const pathway = await Pathway.findById(req.params.id).populate(
      "courses",
      "courseName courseCode image category skill_level courseFee isFree enrolled published"
    );
    if (!pathway) return res.status(404).json({ message: "Pathway not found" });
    res.json(pathway);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createPathway = async (req, res) => {
  try {
    const pathway = new Pathway(req.body);
    const saved = await pathway.save();
    res.status(201).json(saved);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updatePathway = async (req, res) => {
  try {
    const update = { ...req.body, updated_at: Date.now() };
    const pathway = await Pathway.findByIdAndUpdate(req.params.id, update, {
      new: true,
    }).populate("courses", "courseName courseCode image category skill_level published");
    if (!pathway) return res.status(404).json({ message: "Pathway not found" });
    res.json(pathway);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deletePathway = async (req, res) => {
  try {
    const pathway = await Pathway.findByIdAndDelete(req.params.id);
    if (!pathway) return res.status(404).json({ message: "Pathway not found" });
    // Clear pathway_id from courses that belonged to this pathway
    await Course.updateMany(
      { pathway_id: req.params.id },
      { $unset: { pathway_id: "" } }
    );
    res.json({ message: "Pathway deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
