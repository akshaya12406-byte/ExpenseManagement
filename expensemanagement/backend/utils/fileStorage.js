const fs = require('fs');
const path = require('path');

const RECEIPTS_DIR = path.join(__dirname, '..', 'uploads', 'receipts');
const THUMBNAILS_DIR = path.join(RECEIPTS_DIR, 'thumbnails');

const ensureDirectories = () => {
  [RECEIPTS_DIR, THUMBNAILS_DIR].forEach((dirPath) => {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  });
};

const buildReceiptPath = (id, extension = '') => {
  const ext = extension.startsWith('.') ? extension : `.${extension}`;
  return path.join(RECEIPTS_DIR, `${id}${ext}`);
};

const buildThumbnailPath = (id) => path.join(THUMBNAILS_DIR, `${id}.jpg`);

const removeFileQuietly = (filePath) => {
  if (!filePath) return;
  fs.promises
    .access(filePath, fs.constants.F_OK)
    .then(() => fs.promises.unlink(filePath))
    .catch(() => undefined);
};

module.exports = {
  ensureDirectories,
  buildReceiptPath,
  buildThumbnailPath,
  removeFileQuietly,
  RECEIPTS_DIR,
  THUMBNAILS_DIR,
};
