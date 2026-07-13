/**
 * Note images (generated image notes and saved scans) live in S3, not in
 * MongoDB. They used to be stored as base64 inside the saved note, which bloats
 * every document and every list response; the note now carries only the S3 key.
 */

const s3 = require("../services/notebookS3");

// POST /api/note-image  { imageBase64, mimeType? }  →  { key, url }
exports.upload = async (req, res) => {
  try {
    if (!s3.configured()) {
      return res.status(503).json({ error: "Image storage is not configured on the server." });
    }
    const { imageBase64, mimeType = "image/png" } = req.body || {};
    if (!imageBase64) return res.status(400).json({ error: "imageBase64 is required" });
    if (!s3.allowedMime(mimeType)) {
      return res.status(400).json({ error: `Unsupported image type: ${mimeType}` });
    }

    // Accept a bare base64 payload or a full data: URI.
    const comma = String(imageBase64).indexOf(",");
    const payload = String(imageBase64).startsWith("data:") && comma >= 0
      ? String(imageBase64).slice(comma + 1)
      : String(imageBase64);

    const buffer = Buffer.from(payload, "base64");
    if (!buffer.length) return res.status(400).json({ error: "That image could not be decoded." });

    const key = await s3.putNoteImage(req.user._id, buffer, mimeType);
    const url = await s3.signedGetUrl(key);
    res.json({ key, url });
  } catch (err) {
    console.error("note-image upload error:", err.message);
    res.status(500).json({ error: "Could not save the image." });
  }
};

// GET /api/note-image?key=...  →  302 to a short-lived presigned S3 URL
//
// A redirect rather than a proxied body: the app's <Image> follows it, S3 does
// the serving, and the bucket stays private.
exports.view = async (req, res) => {
  try {
    if (!s3.configured()) return res.status(503).json({ error: "Image storage is not configured." });

    const key = req.query.key;
    if (!key) return res.status(400).json({ error: "key is required" });
    // A user may only read images filed under their own prefix.
    if (!s3.ownsKey(req.user._id, key)) return res.status(403).json({ error: "Not your image." });

    res.redirect(302, await s3.signedGetUrl(key));
  } catch (err) {
    console.error("note-image view error:", err.message);
    res.status(500).json({ error: "Could not load the image." });
  }
};

// DELETE /api/note-image?key=...
exports.remove = async (req, res) => {
  try {
    if (!s3.configured()) return res.status(503).json({ error: "Image storage is not configured." });

    const key = req.query.key;
    if (!key) return res.status(400).json({ error: "key is required" });
    if (!s3.ownsKey(req.user._id, key)) return res.status(403).json({ error: "Not your image." });

    await s3.deleteNoteImage(key);
    res.json({ ok: true });
  } catch (err) {
    console.error("note-image delete error:", err.message);
    res.status(500).json({ error: "Could not delete the image." });
  }
};
