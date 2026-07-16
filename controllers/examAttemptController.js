const ExamAttempt = require("../models/ExamAttempt");

function str(v) {
  return v == null ? "" : String(v);
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function strList(v) {
  return Array.isArray(v) ? v.map(str).filter(Boolean).slice(0, 20) : [];
}

// POST /api/exam-attempts  (auth)
// Body: { exam, examLabel, subject, medium, score, total, timeTakenSec,
//         timeLimitSec, areas:[{area,correct,total}], strengths, weaknesses,
//         improvements }
exports.submit = async (req, res) => {
  try {
    const b = req.body || {};
    const score = num(b.score);
    const total = num(b.total);
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;

    const areas = Array.isArray(b.areas)
      ? b.areas.slice(0, 60).map((a) => ({
          area: str(a.area),
          correct: num(a.correct),
          total: num(a.total),
        }))
      : [];

    const attempt = await ExamAttempt.create({
      user_id: req.user._id,
      exam: str(b.exam),
      examLabel: str(b.examLabel),
      subject: str(b.subject),
      medium: b.medium === "si" ? "si" : "en",
      score,
      total,
      percentage,
      timeTakenSec: num(b.timeTakenSec),
      timeLimitSec: num(b.timeLimitSec),
      areas,
      strengths: strList(b.strengths),
      weaknesses: strList(b.weaknesses),
      improvements: strList(b.improvements),
    });

    res.status(201).json({ _id: attempt._id, percentage, created_at: attempt.created_at });
  } catch (err) {
    console.error("exam-attempts submit error:", err.message);
    res.status(500).json({ error: "Could not save your exam result." });
  }
};

// GET /api/exam-attempts/me  (auth) — history + a small summary
exports.getMine = async (req, res) => {
  try {
    const attempts = await ExamAttempt.find({ user_id: req.user._id })
      .sort({ created_at: -1 })
      .limit(50)
      .lean();

    const count = attempts.length;
    const avg =
      count > 0
        ? Math.round(attempts.reduce((s, a) => s + (a.percentage || 0), 0) / count)
        : 0;

    res.json({
      summary: { attempts: count, averageScore: avg },
      attempts,
    });
  } catch (err) {
    console.error("exam-attempts list error:", err.message);
    res.status(500).json({ error: "Could not load your exam results." });
  }
};
