const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { HttpError } = require('../utils/helpers');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
const MAX_FILES = 8;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ALLOWED[file.mimetype]}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_FILES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED[file.mimetype]) return cb(new HttpError(400, 'Only JPG, PNG and WebP images can be uploaded.'));
    cb(null, true);
  },
});

/** Accept up to MAX_FILES images in the "images" field and turn multer errors into clear messages. */
function propertyImages(req, res, next) {
  upload.array('images', MAX_FILES)(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? 'Each image must be 5 MB or smaller.'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE' ? `You can upload up to ${MAX_FILES} images.`
          : err.message;
      return next(new HttpError(400, msg));
    }
    next(err);
  });
}

function removeUploaded(url) {
  if (!url || !url.startsWith('/uploads/') || url.startsWith('/uploads/seed/')) return;
  const file = path.join(UPLOAD_DIR, path.basename(url));
  fs.promises.unlink(file).catch(() => {});
}

module.exports = { propertyImages, removeUploaded, UPLOAD_DIR, MAX_FILES };
