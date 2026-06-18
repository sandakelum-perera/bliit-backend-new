const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

console.log("[Server] Starting BLIIT backend...");
console.log("[Server] Environment:", process.env.NODE_ENV || "development");

// Middleware - Enable CORS first
const corsOptions = {
  origin: [
    "https://www.bliit.lk",
    "https://bliit.lk",
    "https://canvas.bliit.lk",
    "http://localhost:5173",
    "http://localhost:8081",
    "http://localhost:8080",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-user-id"],
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

console.log("[Server] CORS configured for origins:", corsOptions.origin);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get("/", (req, res) => {
  res.json({
    message: "BLIIT API Server",
    status: "running",
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint to verify server is running
app.get("/api/test-cors", (req, res) => {
  console.log("[Test] CORS test endpoint hit from:", req.headers.origin);
  res.json({
    message: "CORS is configured",
    origin: req.headers.origin,
    allowedOrigins: corsOptions.origin,
    timestamp: new Date().toISOString(),
  });
});

// Connect to MongoDB (don't block server startup)
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/bliit";
console.log("[Server] Connecting to MongoDB...");

mongoose
  .connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(async () => {
    console.log("[Server] MongoDB connected successfully");
    try {
      await mongoose.connection.collection("enrollments").dropIndex("student_id_1_course_id_1");
      console.log("[Server] Migrated enrollment index to (student_id, course_id, batch_id)");
    } catch (_) {
      // Already dropped or never existed — safe to ignore
    }
  })
  .catch((err) => {
    console.error("[Server] MongoDB connection error:", err.message);
    // Don't exit - server can still handle requests
  });

// Routes - wrap in try-catch to prevent crashes
console.log("[Server] Loading routes...");
try {
  const router = require("./router");
  app.use(router);
  console.log("[Server] Routes loaded successfully");
} catch (error) {
  console.error("[Server] Router loading error:", error.message);
  console.error("[Server] Stack:", error.stack);
  // Add fallback route
  app.use("/api/*", (req, res) => {
    res.status(503).json({
      message: "API routes not available - server configuration error",
      error: error.message,
    });
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("[Server] Error:", err.message);
  console.error("[Server] Stack:", err.stack);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// Export for Passenger or start standalone server
if (require.main === module) {
  // Running directly with node
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT}`);
    console.log(`[Server] Local: http://localhost:${PORT}`);
  });
} else {
  // Being imported by Passenger or another module
  console.log("[Server] Exporting app for Passenger");
}

module.exports = app;
