const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const path   = require("path");
const User   = require("../models/User");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId:     process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET        = process.env.AWS_S3_BUCKET;
const ALLOWED_MIME  = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

// ── Upload ─────────────────────────────────────────────────────────────────

const upload = multer({
  storage:    multer.memoryStorage(),
  limits:     { fileSize: MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type: ${file.mimetype}`));
  },
});

const uploadVideo = [
  upload.single("video"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No video file provided" });

      const ext = path.extname(req.file.originalname) || ".mp4";
      const key = `course-videos/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

      await s3.send(new PutObjectCommand({
        Bucket:      BUCKET,
        Key:         key,
        Body:        req.file.buffer,
        ContentType: req.file.mimetype,
        // Tell browsers they can cache for a day
        CacheControl: "private, max-age=86400",
      }));

      const url = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      res.json({ url });
    } catch (err) {
      console.error("[Upload] S3 error:", err.message);
      res.status(500).json({ message: err.message || "Upload failed" });
    }
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function keyFromUrl(rawUrl) {
  try {
    return new URL(rawUrl).pathname.slice(1); // strip leading '/'
  } catch {
    return null;
  }
}

// ── Streaming proxy ────────────────────────────────────────────────────────
//
// GET /api/stream/video?url=<encoded-s3-url>&uid=<user-id>
//
// Authenticates via `uid` query param (or `x-user-id` header) so the native
// <video> element can stream without custom headers.
// Forwards Range requests so browsers can seek and buffer ahead freely.
// Sets Cache-Control so the browser can re-use downloaded segments without
// hitting the server again.

const proxyStream = async (req, res) => {
  try {
    // ── Auth ──
    const userId = req.headers["x-user-id"] || req.query.uid;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).catch(() => null);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    // ── Resolve S3 key ──
    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).json({ message: "url query param required" });

    const key = keyFromUrl(decodeURIComponent(rawUrl));
    if (!key) return res.status(400).json({ message: "Invalid S3 URL" });

    // ── Forward Range header so S3 returns the right chunk ──
    const range      = req.headers.range;
    const cmdParams  = { Bucket: BUCKET, Key: key };
    if (range) cmdParams.Range = range;

    const s3Res = await s3.send(new GetObjectCommand(cmdParams));

    // ── Response headers ──
    res.setHeader("Content-Type",  s3Res.ContentType  || "video/mp4");
    res.setHeader("Accept-Ranges", "bytes");
    // Private cache — 24 h so the browser re-uses segments for the whole session
    res.setHeader("Cache-Control", "private, max-age=86400");

    if (s3Res.ContentLength !== undefined) {
      res.setHeader("Content-Length", s3Res.ContentLength);
    }

    if (range && s3Res.ContentRange) {
      res.setHeader("Content-Range", s3Res.ContentRange);
      res.status(206); // Partial Content
    } else {
      res.status(200);
    }

    // ── Pipe S3 body stream straight to the HTTP response ──
    s3Res.Body.pipe(res);

    // Clean up if the client disconnects early
    req.on("close", () => {
      if (!res.writableEnded) s3Res.Body.destroy();
    });

  } catch (err) {
    console.error("[Stream] Proxy error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || "Streaming failed" });
    }
  }
};

module.exports = { uploadVideo, proxyStream };
