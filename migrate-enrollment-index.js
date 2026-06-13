require("dotenv").config();
const mongoose = require("mongoose");

const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/bliit";

async function migrate() {
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log("Connected to MongoDB");

  const col = mongoose.connection.collection("enrollments");

  // Drop old two-field unique index
  try {
    await col.dropIndex("student_id_1_course_id_1");
    console.log("Dropped old index: student_id_1_course_id_1");
  } catch (e) {
    console.log("Old index not found (already dropped or never existed) —", e.message);
  }

  // Let Mongoose recreate the correct three-field index
  const Enrollment = require("./models/Enrollment");
  await Enrollment.syncIndexes();
  console.log("Synced new index: student_id_1_course_id_1_batch_id_1");

  await mongoose.disconnect();
  console.log("Done.");
}

migrate().catch((err) => { console.error(err); process.exit(1); });
