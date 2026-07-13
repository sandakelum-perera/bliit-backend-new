const mongoose = require("mongoose");

// A student's weekly study timetable. One active timetable per user: creating a
// new one (or regenerating) replaces the previous document.
//
// `sessions` is the generated week — each entry is pinned to a weekday, not to
// a calendar date, so the same week repeats. Completion is tracked separately in
// `completions`, keyed by the real calendar date the student ticked it off, so
// progress can be reviewed day by day across the month.

const slotSchema = new mongoose.Schema(
  {
    // Minutes from midnight, e.g. 6:00 AM = 360.
    start: { type: Number, required: true },
    end: { type: Number, required: true },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    // Stable id used by completions and by the notification scheduler.
    id: { type: String, required: true },
    // 1 = Monday … 7 = Sunday (matches Dart's DateTime.weekday).
    weekday: { type: Number, required: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
    subject: { type: String, default: "" },
    topic: { type: String, default: "" },
    // "study" | "break"
    kind: { type: String, default: "study" },
  },
  { _id: false }
);

const completionSchema = new mongoose.Schema(
  {
    // Calendar day the session was completed, as "YYYY-MM-DD".
    date: { type: String, required: true },
    sessionId: { type: String, required: true },
  },
  { _id: false }
);

const timetableSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true,
  },
  // Level id the subjects were picked from (e.g. "8", "degree").
  level: { type: String, default: "" },
  // Chosen subjects, in the order the student picked them.
  subjects: { type: [String], default: [] },
  // Availability per weekday: { "1": [ {start,end} ], … "7": [...] }.
  availability: { type: mongoose.Schema.Types.Mixed, default: {} },
  // Share of study time per subject: { "Mathematics": 30, … } summing to 100.
  allocation: { type: mongoose.Schema.Types.Mixed, default: {} },
  sessions: { type: [sessionSchema], default: [] },
  completions: { type: [completionSchema], default: [] },
  // Minutes before a session that its reminder fires (0 disables reminders).
  reminderMinutes: { type: Number, default: 10 },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

timetableSchema.index({ user_id: 1, "completions.date": 1 });

module.exports = mongoose.model("Timetable", timetableSchema);
