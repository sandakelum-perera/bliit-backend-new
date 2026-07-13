/**
 * Study Timetable — one active weekly timetable per student.
 *
 * The app generates the week client-side from the subjects, availability slots
 * and per-subject allocation the student chose, then persists the result here so
 * it survives reinstalls and can be reviewed day by day. Every route is scoped
 * to the signed-in user (req.user._id).
 */

const Timetable = require("../models/Timetable");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v) => (v == null ? "" : String(v).trim());
const int = (v, fallback = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

// GET /api/timetable — the student's timetable, or null when they have none.
exports.get = async (req, res) => {
  try {
    const doc = await Timetable.findOne({ user_id: req.user._id }).lean();
    res.json(doc || null);
  } catch (err) {
    console.error("timetable/get error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/timetable
// { subjects, availability, allocation, sessions, reminderMinutes }
// Creates the timetable, or replaces it on regenerate. Completions are cleared
// because the session ids they referenced no longer exist.
exports.save = async (req, res) => {
  try {
    const subjects = Array.isArray(req.body.subjects)
      ? req.body.subjects.map(str).filter(Boolean)
      : [];
    if (subjects.length === 0) {
      return res.status(400).json({ error: "at least one subject is required" });
    }

    const sessions = Array.isArray(req.body.sessions)
      ? req.body.sessions
          .filter((s) => s && str(s.id))
          .map((s) => ({
            id: str(s.id),
            weekday: int(s.weekday, 1),
            start: int(s.start),
            end: int(s.end),
            subject: str(s.subject),
            topic: str(s.topic),
            kind: str(s.kind) === "break" ? "break" : "study",
          }))
      : [];
    if (sessions.length === 0) {
      return res.status(400).json({ error: "the timetable has no sessions" });
    }

    const doc = await Timetable.findOneAndUpdate(
      { user_id: req.user._id },
      {
        $set: {
          user_id: req.user._id,
          level: str(req.body.level),
          subjects,
          availability: req.body.availability || {},
          allocation: req.body.allocation || {},
          sessions,
          completions: [], // session ids changed, so old ticks are meaningless
          reminderMinutes: int(req.body.reminderMinutes, 10),
          updated_at: new Date(),
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    res.json(doc);
  } catch (err) {
    console.error("timetable/save error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// PATCH /api/timetable/complete  { date: "YYYY-MM-DD", sessionId, done }
// Ticks (or unticks) one session on one calendar day.
exports.complete = async (req, res) => {
  try {
    const date = str(req.body.date);
    const sessionId = str(req.body.sessionId);
    if (!DATE_RE.test(date)) {
      return res.status(400).json({ error: "date must be YYYY-MM-DD" });
    }
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

    const done = req.body.done !== false; // default true
    const update = done
      ? { $addToSet: { completions: { date, sessionId } } }
      : { $pull: { completions: { date, sessionId } } };

    const doc = await Timetable.findOneAndUpdate({ user_id: req.user._id }, update, {
      new: true,
    }).lean();
    if (!doc) return res.status(404).json({ error: "No timetable to update" });
    res.json(doc);
  } catch (err) {
    console.error("timetable/complete error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/timetable
exports.remove = async (req, res) => {
  try {
    await Timetable.findOneAndDelete({ user_id: req.user._id });
    res.json({ ok: true });
  } catch (err) {
    console.error("timetable/remove error:", err.message);
    res.status(500).json({ error: err.message });
  }
};
