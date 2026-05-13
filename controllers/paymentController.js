const crypto = require("crypto");
const Enrollment = require("../models/Enrollment");
const Course = require("../models/Course");
const Student = require("../models/Student");

// PayHere merchant credentials (replace with your actual credentials)
const MERCHANT_ID = process.env.PAYHERE_MERCHANT_ID || "1227569";
const MERCHANT_SECRET =
  process.env.PAYHERE_MERCHANT_SECRET || "your_merchant_secret";
const PAYHERE_MODE = process.env.PAYHERE_MODE || "sandbox"; // 'sandbox' or 'live'

console.log("=== PayHere Configuration Loaded ===");
console.log("Merchant ID:", MERCHANT_ID);
console.log(
  "Merchant Secret:",
  MERCHANT_SECRET ? "****" + MERCHANT_SECRET.slice(-4) : "NOT SET",
);
console.log("PayHere Mode:", PAYHERE_MODE);
console.log("====================================");

// Generate PayHere payment hash
exports.generatePaymentHash = (req, res) => {
  try {
    const { merchant_id, order_id, amount, currency } = req.body;

    console.log("=== PayHere Hash Generation ===");
    console.log("Merchant ID:", merchant_id);
    console.log("Order ID:", order_id);
    console.log("Amount:", amount);
    console.log("Currency:", currency);
    console.log("Merchant Secret (from env):", MERCHANT_SECRET);

    const hashedSecret = crypto
      .createHash("md5")
      .update(MERCHANT_SECRET)
      .digest("hex")
      .toUpperCase();

    console.log("Hashed Secret:", hashedSecret);

    // Format amount to 2 decimal places without commas
    const amountFormatted = parseFloat(amount).toFixed(2);

    console.log("Amount Formatted:", amountFormatted);

    const hashString =
      merchant_id + order_id + amountFormatted + currency + hashedSecret;
    console.log("Hash String:", hashString);

    const hash = crypto
      .createHash("md5")
      .update(hashString)
      .digest("hex")
      .toUpperCase();

    console.log("Generated Hash:", hash);
    console.log("================================");

    res.json({ hash });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Verify payment notification from PayHere
exports.verifyPayment = async (req, res) => {
  try {
    console.log("=== PayHere Payment Verification ===");
    console.log("Request body:", req.body);

    const {
      merchant_id,
      order_id,
      payhere_amount,
      payhere_currency,
      status_code,
      md5sig,
    } = req.body;

    // Verify the hash
    const hashedSecret = crypto
      .createHash("md5")
      .update(MERCHANT_SECRET)
      .digest("hex")
      .toUpperCase();

    const localHash = crypto
      .createHash("md5")
      .update(
        merchant_id +
          order_id +
          payhere_amount +
          payhere_currency +
          status_code +
          hashedSecret,
      )
      .digest("hex")
      .toUpperCase();

    console.log("Local Hash:", localHash);
    console.log("PayHere Hash:", md5sig);
    console.log("Status Code:", status_code);
    console.log("Hash Match:", localHash === md5sig);
    console.log("===================================");

    if (localHash === md5sig && status_code === "2") {
      // Payment successful - extract enrollment info from order_id
      // Format: ENROLL_{userId}_{courseId}_{timestamp}
      const [prefix, userId, courseId, timestamp] = order_id.split("_");

      if (prefix === "ENROLL") {
        console.log(
          "Processing enrollment for userId:",
          userId,
          "courseId:",
          courseId,
        );

        // Find or create enrollment
        let enrollment = await Enrollment.findOne({
          user_id: userId,
          course_id: courseId,
        });

        if (enrollment) {
          console.log("Found existing enrollment:", enrollment._id);
          // Only update if not already paid
          if (enrollment.payment_status !== "paid") {
            enrollment.payment_status = "paid";
            enrollment.payment_date = new Date();
            enrollment.status = "active";
            await enrollment.save();
            console.log("Updated enrollment to paid status");

            // Increment course enrollment count
            await Course.findByIdAndUpdate(courseId, { $inc: { enrolled: 1 } });
            console.log("Incremented course enrollment count");
          } else {
            console.log("Enrollment already paid, skipping update");
          }
        } else {
          console.log("No existing enrollment found, creating new one");
          // Create new enrollment if it doesn't exist
          // Get student_id from user_id
          const student = await Student.findOne({ user_id: userId });

          if (student) {
            console.log("Found student:", student._id);
            enrollment = new Enrollment({
              student_id: student._id,
              user_id: userId,
              course_id: courseId,
              status: "active",
              payment_status: "paid",
              payment_date: new Date(),
              progress: 0,
              enrollment_date: new Date(),
            });
            await enrollment.save();
            console.log("Created new enrollment:", enrollment._id);

            // Increment course enrollment count
            await Course.findByIdAndUpdate(courseId, { $inc: { enrolled: 1 } });
            console.log("Incremented course enrollment count");
          } else {
            console.log("ERROR: Student not found for user_id:", userId);
          }
        }

        res.status(200).send("Payment verified");
      } else {
        console.log("ERROR: Invalid order ID format:", order_id);
        res.status(400).send("Invalid order ID format");
      }
    } else {
      console.log("ERROR: Payment verification failed");
      console.log("Hash mismatch or invalid status code");
      res.status(400).send("Payment verification failed");
    }
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Create payment-pending enrollment
exports.createPaymentPendingEnrollment = async (req, res) => {
  try {
    const { student_id, user_id, course_id } = req.body;

    // Check if already enrolled
    const existingEnrollment = await Enrollment.findOne({
      user_id,
      course_id,
    });

    if (existingEnrollment && existingEnrollment.payment_status === "paid") {
      return res
        .status(400)
        .json({ message: "Already enrolled in this course" });
    }

    // Create or update enrollment
    let enrollment;
    if (existingEnrollment) {
      enrollment = existingEnrollment;
    } else {
      enrollment = new Enrollment({
        student_id,
        user_id,
        course_id,
        status: "pending",
        payment_status: "pending",
        progress: 0,
        enrollment_date: new Date(),
      });
      await enrollment.save();
    }

    res.status(201).json(enrollment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get payment details for a course
exports.getPaymentDetails = async (req, res) => {
  try {
    const { courseId, userId } = req.params;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const student = await Student.findOne({ user_id: userId }).populate(
      "user_id",
    );
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Calculate final price (use limited time offer if available)
    const amount =
      course.limitedTimeOffer && course.limitedTimeOfferPrice
        ? course.limitedTimeOfferPrice
        : course.courseFee;

    const paymentDetails = {
      merchant_id: MERCHANT_ID,
      return_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/course/${courseId}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/course/${courseId}?payment=cancel`,
      notify_url: `${process.env.BACKEND_URL || "http://localhost:3000"}/api/payments/verify`,
      order_id: `ENROLL_${userId}_${courseId}_${Date.now()}`,
      items: course.courseName,
      currency: "LKR",
      amount: amount,
      first_name: student.name?.split(" ")[0] || "Student",
      last_name: student.name?.split(" ").slice(1).join(" ") || "",
      email: student.email,
      phone: student.phone_number || "",
      address: student.address || "",
      city: "Colombo",
      country: "Sri Lanka",
      sandbox: PAYHERE_MODE === "sandbox",
    };

    res.json(paymentDetails);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Manual payment confirmation (for testing or fallback)
exports.confirmPayment = async (req, res) => {
  try {
    const { order_id } = req.body;

    console.log("=== Manual Payment Confirmation ===");
    console.log("Order ID:", order_id);

    // Extract enrollment info from order_id
    // Format: ENROLL_{userId}_{courseId}_{timestamp}
    const [prefix, userId, courseId, timestamp] = order_id.split("_");

    if (prefix !== "ENROLL") {
      return res.status(400).json({ message: "Invalid order ID format" });
    }

    // Find enrollment
    let enrollment = await Enrollment.findOne({
      user_id: userId,
      course_id: courseId,
    });

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    if (enrollment.payment_status === "paid") {
      return res.status(200).json({
        message: "Already confirmed",
        enrollment,
        alreadyPaid: true,
      });
    }

    // Update enrollment to paid
    enrollment.payment_status = "paid";
    enrollment.payment_date = new Date();
    enrollment.status = "active";
    await enrollment.save();

    // Increment course enrollment count
    await Course.findByIdAndUpdate(courseId, { $inc: { enrolled: 1 } });

    console.log("Payment confirmed for enrollment:", enrollment._id);
    console.log("===================================");

    res.status(200).json({
      message: "Payment confirmed",
      enrollment,
      alreadyPaid: false,
    });
  } catch (error) {
    console.error("Manual payment confirmation error:", error);
    res.status(500).json({ message: error.message });
  }
};
