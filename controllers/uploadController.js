const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
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

// ── Streaming upload ───────────────────────────────────────────────────────
//
// PUT /api/upload/video?filename=<name>
//
// The browser PUTs the raw file bytes as the request body (no FormData /
// multipart). Node.js pipes the IncomingMessage stream straight to S3 without
// buffering the file in memory, so large uploads don't exhaust server RAM.
// Progress tracking works via the XHR upload events on the client.

const streamUpload = async (req, res) => {
  try {
    const filename    = req.query.filename || "video.mp4";
    const contentType = req.headers["content-type"] || "video/mp4";

    if (!ALLOWED_MIME.includes(contentType.split(";")[0].trim())) {
      return res.status(400).json({ message: `Unsupported file type: ${contentType}` });
    }

    const contentLength = req.headers["content-length"]
      ? parseInt(req.headers["content-length"], 10)
      : undefined;

    if (!contentLength) {
      return res.status(400).json({ message: "Content-Length header is required" });
    }

    const ext = path.extname(filename) || ".mp4";
    const key = `course-videos/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    // Pipe the request stream directly into S3 — no memory buffer needed.
    await s3.send(new PutObjectCommand({
      Bucket:        BUCKET,
      Key:           key,
      Body:          req,
      ContentType:   contentType,
      ContentLength: contentLength,
      CacheControl:  "private, max-age=86400",
    }));

    const url = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    res.json({ url });
  } catch (err) {
    console.error("[Upload] Stream error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || "Upload failed" });
    }
  }
};

// ── S3 Multipart upload ────────────────────────────────────────────────────
//
// Three-step flow that splits large files into 5 MB chunks on the client so
// each request stays well below any nginx body-size limit while S3 assembles
// the final object.
//
// POST /api/upload/video/multipart/start   → { uploadId, key }
// PUT  /api/upload/video/multipart/part    → { ETag }
// POST /api/upload/video/multipart/complete → { url }

const startMultipart = async (req, res) => {
  try {
    const { filename = "video.mp4", contentType = "video/mp4" } = req.query;
    const ext = path.extname(filename) || ".mp4";
    const key = `course-videos/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    const result = await s3.send(new CreateMultipartUploadCommand({
      Bucket:      BUCKET,
      Key:         key,
      ContentType: contentType,
      CacheControl: "private, max-age=86400",
    }));

    res.json({ uploadId: result.UploadId, key });
  } catch (err) {
    console.error("[Upload] Multipart start error:", err.message);
    res.status(500).json({ message: err.message || "Failed to start upload" });
  }
};

const uploadPart = async (req, res) => {
  try {
    const { uploadId, key, partNumber } = req.query;
    if (!uploadId || !key || !partNumber) {
      return res.status(400).json({ message: "uploadId, key, and partNumber are required" });
    }

    const contentLength = req.headers["content-length"]
      ? parseInt(req.headers["content-length"], 10)
      : undefined;

    const result = await s3.send(new UploadPartCommand({
      Bucket:        BUCKET,
      Key:           key,
      UploadId:      uploadId,
      PartNumber:    parseInt(partNumber, 10),
      Body:          req,
      ContentLength: contentLength,
    }));

    res.json({ ETag: result.ETag });
  } catch (err) {
    console.error("[Upload] Part error:", err.message);
    res.status(500).json({ message: err.message || "Failed to upload part" });
  }
};

const completeMultipart = async (req, res) => {
  const { uploadId, key, parts } = req.body || {};
  if (!uploadId || !key || !Array.isArray(parts)) {
    return res.status(400).json({ message: "uploadId, key, and parts are required" });
  }
  try {
    await s3.send(new CompleteMultipartUploadCommand({
      Bucket:           BUCKET,
      Key:              key,
      UploadId:         uploadId,
      MultipartUpload:  {
        Parts: [...parts].sort((a, b) => a.PartNumber - b.PartNumber),
      },
    }));

    const url = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    res.json({ url });
  } catch (err) {
    console.error("[Upload] Complete error:", err.message);
    // Abort the incomplete multipart upload to avoid orphaned S3 storage.
    await s3.send(new AbortMultipartUploadCommand({ Bucket: BUCKET, Key: key, UploadId: uploadId })).catch(() => {});
    res.status(500).json({ message: err.message || "Failed to complete upload" });
  }
};

// ── Legacy multer upload (kept as reference) ───────────────────────────────

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

// ── Pre-signed upload (requires S3 CORS on the bucket) ────────────────────

const presignUpload = async (req, res) => {
  try {
    const { filename = "video.mp4", contentType = "video/mp4" } = req.query;
    const ext = path.extname(filename) || ".mp4";
    const key = `course-videos/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

    const command = new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    const objectUrl = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;

    res.json({ uploadUrl, objectUrl });
  } catch (err) {
    console.error("[Presign] error:", err.message);
    res.status(500).json({ message: err.message || "Failed to generate upload URL" });
  }
};

// ── Helpers ────────────────────────────────────────────────────────────────

function keyFromUrl(rawUrl) {
  try {
    return new URL(rawUrl).pathname.slice(1);
  } catch {
    return null;
  }
}

// ── Streaming proxy (video playback) ──────────────────────────────────────

const proxyStream = async (req, res) => {
  try {
    const userId = req.headers["x-user-id"] || req.query.uid;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findById(userId).catch(() => null);
    if (!user) return res.status(401).json({ message: "Unauthorized" });

    const rawUrl = req.query.url;
    if (!rawUrl) return res.status(400).json({ message: "url query param required" });

    const key = keyFromUrl(decodeURIComponent(rawUrl));
    if (!key) return res.status(400).json({ message: "Invalid S3 URL" });

    const command   = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });

    res.redirect(302, signedUrl);
  } catch (err) {
    console.error("[Stream] Proxy error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message || "Streaming failed" });
    }
  }
};

module.exports = { streamUpload, startMultipart, uploadPart, completeMultipart, uploadVideo, presignUpload, proxyStream };
