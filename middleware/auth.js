const User = require("../models/User");

// Authentication middleware - verifies user is logged in
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const userId = req.headers["x-user-id"];

    if (!authHeader && !userId) {
      return res.status(401).json({ message: "Authentication required" });
    }

    // If userId is provided, fetch user
    if (userId) {
      const user = await User.findById(userId);
      if (!user) {
        return res.status(401).json({ message: "Invalid user" });
      }
      req.user = user;
      return next();
    }

    // If using Bearer token
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      // Add JWT verification here if you implement JWT tokens
      // For now, we'll rely on x-user-id header
      return res.status(401).json({ message: "Invalid token format" });
    }

    return res.status(401).json({ message: "Authentication required" });
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({ message: "Authentication failed" });
  }
};

// Authorization middleware - checks if user has required role
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(" or ")}`,
      });
    }

    next();
  };
};

// Admin only middleware
const adminOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }

  next();
};

// Teacher only middleware
const teacherOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (req.user.role !== "teacher" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Teacher access required" });
  }

  next();
};

// Student only middleware
const studentOnly = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }

  if (req.user.role !== "student" && req.user.role !== "admin") {
    return res.status(403).json({ message: "Student access required" });
  }

  next();
};

module.exports = {
  authenticate,
  authorize,
  adminOnly,
  teacherOnly,
  studentOnly,
};
