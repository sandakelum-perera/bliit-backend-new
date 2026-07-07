const AiQuizAttempt = require("../models/AiQuizAttempt");

// POST /api/ai-quiz-attempts  (auth)
// Body: { topic, title, questions:[{question,options,correctIndex,chosenIndex,explanation}] }
// The server re-computes the score from correctIndex/chosenIndex so the client
// can't inflate it.
exports.submitAttempt = async (req, res) => {
  try {
    const { topic = "", title = "", questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ message: "questions are required" });
    }

    const cleaned = questions.map((q) => {
      const options = Array.isArray(q.options) ? q.options.map(String) : [];
      const correctIndex = Number.isInteger(q.correctIndex) ? q.correctIndex : -1;
      const chosenIndex = Number.isInteger(q.chosenIndex) ? q.chosenIndex : -1;
      return {
        question: String(q.question || ""),
        options,
        correctIndex,
        chosenIndex,
        explanation: String(q.explanation || ""),
      };
    });

    const total = cleaned.length;
    let score = 0;
    cleaned.forEach((q) => {
      if (q.chosenIndex >= 0 && q.chosenIndex === q.correctIndex) score++;
    });
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

    const attempt = await AiQuizAttempt.create({
      user_id: req.user._id,
      topic,
      title,
      questions: cleaned,
      score,
      total,
      percentage,
    });

    res.status(201).json({
      _id: attempt._id,
      score,
      total,
      percentage,
      created_at: attempt.created_at,
    });
  } catch (err) {
    console.error("ai-quiz-attempts submit error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// GET /api/ai-quiz-attempts/me  (auth) — this student's history + summary
exports.getMyAttempts = async (req, res) => {
  try {
    const attempts = await AiQuizAttempt.find({ user_id: req.user._id })
      .sort({ created_at: -1 })
      .limit(100)
      .lean();

    const count = attempts.length;
    const avg =
      count > 0
        ? Math.round(attempts.reduce((s, a) => s + (a.percentage || 0), 0) / count)
        : 0;
    const totalAnswered = attempts.reduce((s, a) => s + (a.total || 0), 0);

    res.json({
      summary: { attempts: count, averageScore: avg, questionsPracticed: totalAnswered },
      attempts,
    });
  } catch (err) {
    console.error("ai-quiz-attempts list error:", err.message);
    res.status(500).json({ message: err.message });
  }
};
