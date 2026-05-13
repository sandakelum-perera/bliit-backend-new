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
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profile_image: user.profile_image,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Register new user
exports.register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

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
    });

    const newUser = await user.save();

    // Create student or teacher record based on role
    if (newUser.role === "student") {
      const Student = require("../models/Student");
      const student = new Student({
        user_id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      });
      await student.save();
    } else if (newUser.role === "teacher") {
      const Teacher = require("../models/Teacher");
      const teacher = new Teacher({
        user_id: newUser._id,
        name: newUser.name,
        email: newUser.email,
      });
      await teacher.save();
    }

    // Generate token
    const token = generateToken(newUser._id);

    res.status(201).json({
      token,
      user: {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        profile_image: newUser.profile_image,
        role: newUser.role,
      },
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
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        profile_image: user.profile_image,
        role: user.role,
      },
    });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(401).json({ message: "Google authentication failed" });
  }
};
