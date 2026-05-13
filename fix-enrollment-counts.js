const mongoose = require("mongoose");
const Course = require("./models/Course");
const Enrollment = require("./models/Enrollment");

// MongoDB connection string - update this with your actual connection
const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://bliitenglish:FPHZrnPmTLMpFOLp@cluster.kh29o.mongodb.net/bliit_db?retryWrites=true&w=majority";

async function fixEnrollmentCounts() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    // Get all courses
    const courses = await Course.find();
    console.log(`Found ${courses.length} courses`);

    let fixed = 0;
    let total = 0;

    for (const course of courses) {
      // Count paid enrollments for this course
      const paidCount = await Enrollment.countDocuments({
        course_id: course._id,
        payment_status: "paid",
      });

      total++;

      // Update if different
      if (course.enrolled !== paidCount) {
        console.log(
          `Course ${course.courseCode}: ${course.enrolled || 0} → ${paidCount}`,
        );
        await Course.findByIdAndUpdate(course._id, { enrolled: paidCount });
        fixed++;
      }
    }

    console.log(`\n✅ Fixed ${fixed} out of ${total} courses`);
    console.log("Enrollment counts are now accurate!");

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error fixing enrollment counts:", error);
    process.exit(1);
  }
}

fixEnrollmentCounts();
