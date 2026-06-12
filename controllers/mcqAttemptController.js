const McqAttempt = require("../models/McqAttempt");
const CourseContent = require("../models/CourseContent");

// Fisher-Yates shuffle — returns a new shuffled copy
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

exports.submitAttempt = async (req, res) => {
  try {
    const { user_id, course_id, content_id, selectedIndices, answers } = req.body;

    const content = await CourseContent.findById(content_id);
    if (!content || content.type !== "quiz" || !content.mcq) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const { maxAttempts, questions } = content.mcq;

    const existingCount = await McqAttempt.countDocuments({ user_id, content_id });
    if (existingCount >= maxAttempts) {
      return res.status(400).json({ message: "Maximum attempts reached" });
    }

    // Validate that all submitted indices are within bounds
    const bankSize = questions.length;
    const validIndices = selectedIndices.filter(
      (i) => Number.isInteger(i) && i >= 0 && i < bankSize,
    );
    if (validIndices.length !== selectedIndices.length) {
      return res.status(400).json({ message: "Invalid question indices" });
    }

    // Score: answers[i] must match correctIndex of questions[selectedIndices[i]]
    let score = 0;
    validIndices.forEach((qIdx, ansIdx) => {
      if (answers[ansIdx] === questions[qIdx].correctIndex) score++;
    });

    const attempt = new McqAttempt({
      user_id,
      course_id,
      content_id,
      selectedIndices: validIndices,
      answers,
      score,
      total: validIndices.length,
      attempt_number: existingCount + 1,
    });

    await attempt.save();
    res.status(201).json({
      score,
      total: validIndices.length,
      attempt_number: existingCount + 1,
      attempts_used: existingCount + 1,
      max_attempts: maxAttempts,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Returns random question indices for a new attempt (without revealing correct answers)
exports.getQuizQuestions = async (req, res) => {
  try {
    const { userId, contentId } = req.params;

    const content = await CourseContent.findById(contentId);
    if (!content || content.type !== "quiz" || !content.mcq) {
      return res.status(404).json({ message: "Quiz not found" });
    }

    const { maxAttempts, questions, questionsPerAttempt } = content.mcq;

    const existingCount = await McqAttempt.countDocuments({
      user_id: userId,
      content_id: contentId,
    });
    if (existingCount >= maxAttempts) {
      return res.status(400).json({ message: "Maximum attempts reached", attemptsUsed: existingCount, maxAttempts });
    }

    const allIndices = questions.map((_, i) => i);
    const n = questionsPerAttempt > 0 && questionsPerAttempt < questions.length
      ? questionsPerAttempt
      : questions.length;

    const selectedIndices = shuffle(allIndices).slice(0, n);

    // Return questions WITHOUT correctIndex
    const selectedQuestions = selectedIndices.map((i) => ({
      index: i,
      question: questions[i].question,
      options:  questions[i].options,
    }));

    res.json({
      selectedIndices,
      questions: selectedQuestions,
      questionsPerAttempt: n,
      totalInBank: questions.length,
      attemptsUsed: existingCount,
      maxAttempts,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAttemptsByUserAndCourse = async (req, res) => {
  try {
    const { userId, courseId } = req.params;
    const attempts = await McqAttempt.find({ user_id: userId, course_id: courseId })
      .sort({ content_id: 1, attempt_number: 1 });
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getAttemptsByUserAndContent = async (req, res) => {
  try {
    const { userId, contentId } = req.params;
    const attempts = await McqAttempt.find({ user_id: userId, content_id: contentId })
      .sort({ attempt_number: 1 });
    res.json(attempts);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
