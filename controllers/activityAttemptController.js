const ActivityAttempt = require("../models/ActivityAttempt");
const CourseContent   = require("../models/CourseContent");

function norm(s) {
  return String(s || "").trim().toLowerCase();
}

exports.submitAttempt = async (req, res) => {
  try {
    const { user_id, course_id, content_id, answers } = req.body;

    const content = await CourseContent.findById(content_id);
    if (!content || content.type !== "activity" || !content.activity) {
      return res.status(404).json({ message: "Activity not found" });
    }

    const { activityType, maxAttempts, fillBlanks, pairs, orderItems, sentences } = content.activity;

    const existingCount = await ActivityAttempt.countDocuments({ user_id, content_id });
    if (existingCount >= maxAttempts) {
      return res.status(400).json({ message: "Maximum attempts reached" });
    }

    let score = 0, total = 0;
    const feedback = [];

    if (activityType === "fill-blank") {
      // answers.fillBlankAnswers: string[][]  [questionIdx][blankIdx]
      const fba = answers.fillBlankAnswers || [];
      (fillBlanks || []).forEach((item, qi) => {
        (item.blanks || []).forEach((correct, bi) => {
          total++;
          const ok = norm(fba[qi]?.[bi]) === norm(correct);
          feedback.push(ok);
          if (ok) score++;
        });
      });

    } else if (activityType === "matching" || activityType === "drag-drop") {
      // answers.matchedRightIndices: number[]
      // matchedRightIndices[i] = original index of right item matched to left item i
      // Correct when matchedRightIndices[i] === i (pairs[i].right belongs to pairs[i].left)
      const mri = answers.matchedRightIndices || [];
      (pairs || []).forEach((_, i) => {
        total++;
        const ok = mri[i] === i;
        feedback.push(ok);
        if (ok) score++;
      });

    } else if (activityType === "ordering") {
      // answers.orderedItems: string[]  — student's order
      const oi = answers.orderedItems || [];
      (orderItems || []).forEach((correct, i) => {
        total++;
        const ok = norm(oi[i]) === norm(correct);
        feedback.push(ok);
        if (ok) score++;
      });

    } else if (activityType === "word-puzzle") {
      // answers.sentenceAnswers: string[][]  [sentenceIdx][wordIdx] — student's word order
      // sentences stores correct sentences; we split into words to compare
      const sa = answers.sentenceAnswers || [];
      (sentences || []).forEach((sentence, si) => {
        const correctWords = sentence.trim().split(/\s+/);
        const studentWords = sa[si] || [];
        correctWords.forEach((cw, wi) => {
          total++;
          const ok = norm(studentWords[wi]) === norm(cw);
          feedback.push(ok);
          if (ok) score++;
        });
      });
    }

    const attempt = new ActivityAttempt({
      user_id,
      course_id,
      content_id,
      activity_type: activityType,
      score,
      total,
      feedback,
      attempt_number: existingCount + 1,
    });
    await attempt.save();

    res.status(201).json({
      score,
      total,
      feedback,
      attempt_number: existingCount + 1,
      attempts_used: existingCount + 1,
      max_attempts: maxAttempts,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAttemptsByUserAndCourse = async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const attempts = await ActivityAttempt.find({ user_id: userId, course_id: courseId })
      .sort({ content_id: 1, attempt_number: 1 });
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAttemptsByUserAndContent = async (req, res) => {
  try {
    const { userId, contentId } = req.params;
    const attempts = await ActivityAttempt.find({ user_id: userId, content_id: contentId })
      .sort({ attempt_number: 1 });
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
