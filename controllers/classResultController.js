const ClassResult    = require('../models/ClassResult');
const McqAttempt     = require('../models/McqAttempt');
const ActivityAttempt = require('../models/ActivityAttempt');
const Enrollment     = require('../models/Enrollment');
const Batch          = require('../models/Batch');
const CourseContent  = require('../models/CourseContent');

// Compute max possible score for an activity content item from its structure
const activityTotal = (content) => {
  const a = content.activity;
  if (!a) return 0;
  switch (a.activityType) {
    case 'fill-blank': return (a.fillBlanks || []).reduce((s, fb) => s + (fb.blanks?.length || 0), 0);
    case 'matching':
    case 'drag-drop':  return (a.pairs || []).length;
    case 'ordering':   return (a.orderItems || []).length;
    case 'word-puzzle':return (a.sentences || []).length;
    default:           return 0;
  }
};

exports.getBatchSummary = async (req, res) => {
  try {
    const { batchId } = req.params;

    const batch = await Batch.findById(batchId);
    if (!batch) return res.status(404).json({ message: 'Batch not found' });
    const courseId = batch.course_id;

    // Enrolled students
    const enrollments = await Enrollment.find({ batch_id: batchId })
      .populate('user_id', 'name email');

    // All content for this course
    const contents = await CourseContent.find({ course_id: courseId });
    const mcqContents = contents.filter(c => c.type === 'quiz' && c.mcq?.questions?.length > 0);
    const actContents = contents.filter(c => c.type === 'activity' && c.activity?.activityType);

    // Total possible marks
    const mcqPossible = mcqContents.reduce((s, c) => {
      const qpa = c.mcq.questionsPerAttempt;
      return s + (qpa > 0 ? qpa : c.mcq.questions.length);
    }, 0);
    const actPossible = actContents.reduce((s, c) => s + activityTotal(c), 0);
    const totalPossible = mcqPossible + actPossible;

    // Per-student aggregation
    const results = await Promise.all(enrollments.map(async (enrollment) => {
      const userId = enrollment.user_id?._id || enrollment.user_id;
      if (!userId) return null;

      // Best MCQ score per content item
      const mcqAttempts = await McqAttempt.find({ user_id: userId, course_id: courseId });
      const bestMcq = {};
      mcqAttempts.forEach(a => {
        const cid = a.content_id.toString();
        if (!bestMcq[cid] || a.score > bestMcq[cid]) bestMcq[cid] = a.score;
      });
      const mcqScore = Object.values(bestMcq).reduce((s, v) => s + v, 0);

      // Best activity score per content item
      const actAttempts = await ActivityAttempt.find({ user_id: userId, course_id: courseId });
      const bestAct = {};
      actAttempts.forEach(a => {
        const cid = a.content_id.toString();
        if (!bestAct[cid] || a.score > bestAct[cid]) bestAct[cid] = a.score;
      });
      const actScore = Object.values(bestAct).reduce((s, v) => s + v, 0);

      const totalScore = mcqScore + actScore;
      const percentage = totalPossible > 0
        ? Math.round((totalScore / totalPossible) * 100 * 10) / 10
        : 0;

      return {
        user:              enrollment.user_id,
        payment_status:    enrollment.payment_status,
        mcqScore,
        mcqPossible,
        actScore,
        actPossible,
        totalScore,
        totalPossible,
        percentage,
        mcqAttempted:  Object.keys(bestMcq).length,
        actAttempted:  Object.keys(bestAct).length,
        mcqTotal:      mcqContents.length,
        actTotal:      actContents.length,
      };
    }));

    res.json({
      batchId,
      courseId,
      mcqPossible,
      actPossible,
      totalPossible,
      results: results.filter(Boolean),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getResults = async (req, res) => {
  try {
    const results = await ClassResult.find()
      .populate('class_id', 'title scheduledDate')
      .populate('batch_id', 'batchName batchCode')
      .populate('course_id', 'courseName courseCode')
      .populate('user_id', 'name email');
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createResult = async (req, res) => {
  const result = new ClassResult(req.body);
  try {
    const saved = await result.save();
    res.status(201).json(saved);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Result already exists for this student in this class' });
    }
    res.status(400).json({ message: err.message });
  }
};

exports.upsertResult = async (req, res) => {
  try {
    const { class_id, user_id, ...rest } = req.body;
    const result = await ClassResult.findOneAndUpdate(
      { class_id, user_id },
      { ...rest, class_id, user_id, updated_at: new Date() },
      { new: true, upsert: true }
    );
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getResultById = async (req, res) => {
  try {
    const result = await ClassResult.findById(req.params.id)
      .populate('class_id').populate('user_id', 'name email');
    if (!result) return res.status(404).json({ message: 'Result not found' });
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getResultsByClass = async (req, res) => {
  try {
    const results = await ClassResult.find({ class_id: req.params.classId })
      .populate('user_id', 'name email')
      .populate('student_id', 'name');
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getResultsByBatch = async (req, res) => {
  try {
    const results = await ClassResult.find({ batch_id: req.params.batchId })
      .populate('class_id', 'title scheduledDate')
      .populate('user_id', 'name email');
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateResult = async (req, res) => {
  try {
    const result = await ClassResult.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updated_at: new Date() },
      { new: true }
    );
    if (!result) return res.status(404).json({ message: 'Result not found' });
    res.json(result);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.deleteResult = async (req, res) => {
  try {
    const result = await ClassResult.findByIdAndDelete(req.params.id);
    if (!result) return res.status(404).json({ message: 'Result not found' });
    res.json({ message: 'Result deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
