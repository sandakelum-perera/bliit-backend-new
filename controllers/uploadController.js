const { S3Client, PutObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const multer = require("multer");
const path = require("path");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET;
const ALLOWED_MIME = ["video/mp4", "video/webm", "video/ogg", "video/quicktime", "video/x-msvideo"];
const MAX_SIZE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed: mp4, webm, ogg, mov, avi`));
  }
};

const upload = multer({ storage, fileFilter, limits: { fileSize: MAX_SIZE_BYTES } });

const uploadVideo = [
  upload.single("video"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No video file provided" });
      }

      const ext = path.extname(req.file.originalname) || ".mp4";
      const key = `course-videos/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`;

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET,
          Key: key,
          Body: req.file.buffer,
          ContentType: req.file.mimetype,
        })
      );

      const url = `https://${BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
      res.json({ url });
    } catch (err) {
      console.error("[Upload] S3 upload error:", err.message);
      res.status(500).json({ message: err.message || "Upload failed" });
    }
  },
];

// Extract the S3 object key from a full S3 URL
function keyFromUrl(url) {
  // e.g. https://bliit-video-bucket.s3.eu-north-1.amazonaws.com/course-videos/...
  try {
    const parsed = new URL(url);
    // pathname starts with '/'
    return parsed.pathname.slice(1); // strip leading '/'
  } catch {
    return null;
  }
}

const signVideo = async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ message: "url query param required" });

    const key = keyFromUrl(decodeURIComponent(url));
    if (!key) return res.status(400).json({ message: "Invalid S3 URL" });

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    // Signed URL valid for 1 hour; supports Range requests for video seeking
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
    res.json({ signedUrl });
  } catch (err) {
    console.error("[Stream] Sign error:", err.message);
    res.status(500).json({ message: err.message || "Failed to generate stream URL" });
  }
};

module.exports = { uploadVideo, signVideo };
