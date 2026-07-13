/**
 * S3 storage for Smart Notebook images (generated note images and scans).
 *
 * Deliberately its own client and bucket, separate from the course-video S3 in
 * uploadController: different region, different IAM user, different bucket.
 * Credentials come from AWS_NOTEBOOK_* env vars and never leave the server.
 *
 * The bucket is treated as private. Nothing here hands out a public URL —
 * objects are read back through a short-lived presigned GET, requested by the
 * app through the authenticated view route.
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } =
  require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const REGION = process.env.AWS_NOTEBOOK_REGION;
const BUCKET = process.env.AWS_NOTEBOOK_S3_BUCKET;

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_NOTEBOOK_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_NOTEBOOK_SECRET_ACCESS_KEY,
  },
});

/** False when the notebook bucket isn't configured, so callers can fall back. */
function configured() {
  return Boolean(
    REGION &&
      BUCKET &&
      process.env.AWS_NOTEBOOK_ACCESS_KEY_ID &&
      process.env.AWS_NOTEBOOK_SECRET_ACCESS_KEY,
  );
}

const EXT = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

/** True for the image types a note image may be stored as. */
function allowedMime(mime) {
  return Object.prototype.hasOwnProperty.call(EXT, mime);
}

/**
 * Stores one note image and returns its object key. Keys are namespaced by
 * user, which is also what the view route checks before signing a URL.
 */
async function putNoteImage(userId, buffer, mimeType = "image/png") {
  const ext = EXT[mimeType] || ".png";
  const key = `note-images/${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}${ext}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
      CacheControl: "private, max-age=31536000",
    }),
  );
  return key;
}

/** A temporary URL the app can load the image from. */
function signedGetUrl(key, expiresIn = 3600) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: BUCKET, Key: key }), { expiresIn });
}

async function deleteNoteImage(key) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Guards every read/delete: a key must live under the caller's own prefix. */
function ownsKey(userId, key) {
  return typeof key === "string" && key.startsWith(`note-images/${userId}/`);
}

module.exports = {
  configured,
  allowedMime,
  putNoteImage,
  signedGetUrl,
  deleteNoteImage,
  ownsKey,
};
