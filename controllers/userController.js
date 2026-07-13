const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" });
};

const str = (v) => (v == null ? "" : String(v).trim());

// E.164: +<country_code><number>, 8–15 chars total
const isValidPhone = (phone) => /^\+[1-9]\d{6,14}$/.test(phone);

const phoneInvalid = (phone) => !phone || !isValidPhone(phone);

// DELETE /api/users/me — permanently delete the signed-in user's account and
// everything they created. Irreversible; the app confirms before calling this.
exports.deleteMe = async (req, res) => {
  try {
    const userId = req.user._id;

    // Remove the user's own content. Each model is optional at runtime, so a
    // deployment missing one of them still deletes the account.
    const collections = [
      ["../models/SavedItem", { user_id: userId }],
      ["../models/Timetable", { user_id: userId }],
      ["../models/StudyPlan", { user_id: userId }],
      ["../models/StudyPlanResult", { user_id: userId }],
    ];
    for (const [path, filter] of collections) {
      try {
        await require(path).deleteMany(filter);
      } catch (err) {
        console.error(`deleteMe: could not clear ${path}:`, err.message);
      }
    }

    await User.findByIdAndDelete(userId);
    res.json({ ok: true });
  } catch (err) {
    console.error("users/deleteMe error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

/** The shape the app expects for the signed-in user. */
const publicUser = (u) => ({
  _id: u._id,
  name: u.name,
  email: u.email,
  profile_image: u.profile_image,
  role: u.role,
  phone_number: u.phone_number,
  gender: u.gender || "",
  date_of_birth: u.date_of_birth || null,
  level: u.level || "",
  profile_completed: !!u.profile_completed,
});

// Return the currently authenticated user (used by math canvas SSO)
exports.getMe = (req, res) => {
  res.json(publicUser(req.user));
};

// PATCH /api/users/me/profile
// { name, gender, dateOfBirth, phoneNumber, level, profileImage }
//
// Saves the details collected by the app's onboarding flow and marks the
// profile complete, so onboarding is never shown again. `profileImage` may be a
// base64 data URI (the student's cropped photo) or a URL.
exports.updateMyProfile = async (req, res) => {
  try {
    const b = req.body || {};
    const patch = {};

    const name = str(b.name);
    if (name) patch.name = name;

    const gender = str(b.gender).toLowerCase();
    if (gender === "male" || gender === "female") patch.gender = gender;

    if (b.dateOfBirth) {
      const dob = new Date(b.dateOfBirth);
      if (!isNaN(dob.getTime())) patch.date_of_birth = dob;
    }

    const phone = str(b.phoneNumber);
    if (phone) patch.phone_number = phone;

    const level = str(b.level);
    if (level) patch.level = level;

    const image = str(b.profileImage);
    if (image) patch.profile_image = image;

    // The student may skip optional steps, so completing is always allowed.
    patch.profile_completed = true;
    patch.updated_at = new Date();

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: patch },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json(publicUser(user));
  } catch (err) {
    console.error("users/updateMyProfile error:", err.message);
    res.status(500).json({ error: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.createUser = async (req, res) => {
  const user = new User(req.body);
  try {
    const newUser = await user.save();
    res.status(201).json(newUser);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getUserByEmail = async (req, res) => {
  try {
    const user = await User.findOne({ email: req.params.email });
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
// Login with email and password
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      token,
      requiresPhone: phoneInvalid(user.phone_number),
      user: publicUser(user),
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Update phone number
exports.updatePhone = async (req, res) => {
  try {
    const { phone_number } = req.body;
    if (phoneInvalid(phone_number)) {
      return res.status(400).json({ message: "Phone number must include country code (e.g. +94771234567)" });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { phone_number },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "User not found" });

    // Also update student/teacher record
    if (user.role === "student") {
      const Student = require("../models/Student");
      await Student.findOneAndUpdate({ user_id: user._id }, { phone_number });
    } else if (user.role === "teacher") {
      const Teacher = require("../models/Teacher");
      await Teacher.findOneAndUpdate({ user_id: user._id }, { phone_number });
    }

    res.json({ message: "Phone number updated", user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, phone_number } = req.body;

    if (phoneInvalid(phone_number)) {
      return res.status(400).json({ message: "Phone number must include country code (e.g. +94771234567)" });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "User already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: role || "student",
      phone_number,
      is_approved: role === "teacher" ? false : true,
    });

    const newUser = await user.save();

    // Create student or teacher record based on role
    if (newUser.role === "student") {
      const Student = require("../models/Student");
      const student = new Student({
        user_id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone_number,
      });
      await student.save();
    } else if (newUser.role === "teacher") {
      const Teacher = require("../models/Teacher");
      const teacher = new Teacher({
        user_id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        phone_number,
      });
      await teacher.save();
    }

    // Generate token
    const token = generateToken(newUser._id);

    res.status(201).json({
      token,
      user: publicUser(newUser),
    });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

// Google OAuth authentication
exports.googleAuth = async (req, res) => {
  try {
    const { credential, role } = req.body;

    // Verify Google token
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, picture } = payload;

    // Check if user exists
    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      // If no role is provided, this is just a check - don't create user yet
      if (!role) {
        return res.json({
          isNewUser: true,
          requiresRole: true,
        });
      }

      // Create new user with the specified role
      user = new User({
        name,
        email,
        profile_image: picture,
        role: role,
        googleId: payload.sub,
        is_approved: role === "teacher" ? false : true,
      });
      await user.save();
      isNewUser = true;
    } else {
      // Update profile image if needed
      if (picture && !user.profile_image) {
        user.profile_image = picture;
        await user.save();
      }
    }

    // Create student or teacher record for new users
    if (isNewUser) {
      console.log("Creating record for new user with role:", user.role);
      if (user.role === "student") {
        const Student = require("../models/Student");
        const existingStudent = await Student.findOne({ user_id: user._id });
        if (!existingStudent) {
          console.log("Creating new student record");
          const student = new Student({
            user_id: user._id,
            name: user.name,
            email: user.email,
          });
          await student.save();
          console.log("Student record created:", student._id);
        }
      } else if (user.role === "teacher") {
        const Teacher = require("../models/Teacher");
        const existingTeacher = await Teacher.findOne({ user_id: user._id });
        if (!existingTeacher) {
          console.log("Creating new teacher record");
          const teacher = new Teacher({
            user_id: user._id,
            name: user.name,
            email: user.email,
          });
          await teacher.save();
          console.log("Teacher record created:", teacher._id);
        }
      }
    } else {
      console.log("Not a new user, skipping student/teacher record creation");
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      token,
      isNewUser,
      requiresPhone: phoneInvalid(user.phone_number),
      user: publicUser(user),
    });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ message: "Google authentication failed" });
  }
};
