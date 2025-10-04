const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const Expense = require('../models/Expense');
const authMiddleware = require('../middleware/auth');
const {
  ensureDirectories,
  buildReceiptPath,
  buildThumbnailPath,
  removeFileQuietly,
} = require('../utils/fileStorage');

const router = express.Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });

ensureDirectories();

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
];

const serializeReceipt = (req, expenseId, receipt) => ({
  id: receipt._id,
  originalName: receipt.originalName,
  mimeType: receipt.mimeType,
  size: receipt.size,
  uploadedAt: receipt.uploadedAt,
  uploadedBy: receipt.uploadedBy,
  fileUrl: `${req.baseUrl}/receipts/${receipt._id}/file`.replace('/receipts/receipts', '/receipts'),
  thumbnailUrl: receipt.thumbnailPath
    ? `${req.baseUrl}/receipts/${receipt._id}/thumbnail`.replace('/receipts/receipts', '/receipts')
    : null,
});

const findExpense = async (expenseId, user) => {
  const expense = await Expense.findById(expenseId);
  if (!expense) {
    const error = new Error('Expense not found');
    error.status = 404;
    throw error;
  }

  if (!user || expense.company.toString() !== user.company) {
    const error = new Error('Unauthorized to manage receipts for this expense');
    error.status = 403;
    throw error;
  }

  return expense;
};

const processImageBuffer = async (buffer) => {
  const compressed = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  const thumbnail = await sharp(compressed)
    .resize({ width: 320, height: 320, fit: 'inside' })
    .jpeg({ quality: 70 })
    .toBuffer();

  return { compressed, thumbnail };
};

router.get('/:expenseId/receipts', authMiddleware(), async (req, res) => {
  try {
    const expense = await findExpense(req.params.expenseId, req.user);
    const receipts = (expense.receipts || []).map((receipt) =>
      serializeReceipt(req, expense._id, receipt),
    );
    res.json({ receipts });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.post(
  '/:expenseId/receipts',
  authMiddleware(),
  upload.array('receipts', 5),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded.' });
      }

      const files = req.files;
      const invalidFile = files.find(
        (file) => file.size > MAX_FILE_SIZE || !ALLOWED_MIME_TYPES.includes(file.mimetype),
      );

      if (invalidFile) {
        return res.status(400).json({
          message: 'Invalid file uploaded. Ensure type is image/PDF and size below 10 MB.',
        });
      }

      const expense = await findExpense(req.params.expenseId, req.user);

      const newReceipts = [];

      for (const file of files) {
        const receiptId = uuidv4();
        const extension = path.extname(file.originalname).toLowerCase() || '.bin';
        const storagePath = buildReceiptPath(receiptId, extension);
        let dataBuffer = file.buffer;
        let thumbnailPath = null;

        if (file.mimetype.startsWith('image/')) {
          const { compressed, thumbnail } = await processImageBuffer(file.buffer);
          dataBuffer = compressed;
          thumbnailPath = buildThumbnailPath(receiptId);
          await fs.promises.writeFile(thumbnailPath, thumbnail);
        }

        await fs.promises.writeFile(storagePath, dataBuffer);

        const receiptRecord = {
          _id: receiptId,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          extension,
          storagePath,
          thumbnailPath,
          uploadedBy: req.user.sub,
          uploadedAt: new Date(),
        };

        expense.receipts.push(receiptRecord);
        newReceipts.push(receiptRecord);
      }

      await expense.save();

      res.status(201).json({
        receipts: expense.receipts.map((receipt) => serializeReceipt(req, expense._id, receipt)),
      });
    } catch (error) {
      console.error('Receipt upload error:', error);
      res.status(error.status || 500).json({ message: error.message || 'Unable to upload receipts.' });
    }
  },
);

router.get('/:expenseId/receipts/:receiptId/file', authMiddleware(), async (req, res) => {
  try {
    const expense = await findExpense(req.params.expenseId, req.user);
    const receipt = expense.receipts.find((item) => item._id === req.params.receiptId);

    if (!receipt) {
      return res.status(404).json({ message: 'Receipt not found.' });
    }

    res.sendFile(receipt.storagePath);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.get('/:expenseId/receipts/:receiptId/thumbnail', authMiddleware(), async (req, res) => {
  try {
    const expense = await findExpense(req.params.expenseId, req.user);
    const receipt = expense.receipts.find((item) => item._id === req.params.receiptId);

    if (!receipt || !receipt.thumbnailPath) {
      return res.status(404).json({ message: 'Thumbnail not available.' });
    }

    res.sendFile(receipt.thumbnailPath);
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.delete('/:expenseId/receipts/:receiptId', authMiddleware(), async (req, res) => {
  try {
    const expense = await findExpense(req.params.expenseId, req.user);
    const receiptIndex = expense.receipts.findIndex((item) => item._id === req.params.receiptId);

    if (receiptIndex === -1) {
      return res.status(404).json({ message: 'Receipt not found.' });
    }

    const [removedReceipt] = expense.receipts.splice(receiptIndex, 1);
    await expense.save();

    removeFileQuietly(removedReceipt.storagePath);
    removeFileQuietly(removedReceipt.thumbnailPath);

    res.json({
      message: 'Receipt removed successfully.',
      receipts: expense.receipts.map((receipt) => serializeReceipt(req, expense._id, receipt)),
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

router.put('/:expenseId/receipts/:receiptId', authMiddleware(), upload.single('receipt'), async (req, res) => {
  try {
    const expense = await findExpense(req.params.expenseId, req.user);
    const receipt = expense.receipts.find((item) => item._id === req.params.receiptId);

    if (!receipt) {
      return res.status(404).json({ message: 'Receipt not found.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded.' });
    }

    if (req.file.size > MAX_FILE_SIZE || !ALLOWED_MIME_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({
        message: 'Invalid file uploaded. Ensure type is image/PDF and size below 10 MB.',
      });
    }

    removeFileQuietly(receipt.storagePath);
    removeFileQuietly(receipt.thumbnailPath);

    let dataBuffer = req.file.buffer;
    let thumbnailPath = null;

    if (req.file.mimetype.startsWith('image/')) {
      const { compressed, thumbnail } = await processImageBuffer(req.file.buffer);
      dataBuffer = compressed;
      thumbnailPath = buildThumbnailPath(receipt._id);
      await fs.promises.writeFile(thumbnailPath, thumbnail);
    }

    const storagePath = buildReceiptPath(receipt._id, path.extname(req.file.originalname));
    await fs.promises.writeFile(storagePath, dataBuffer);

    receipt.originalName = req.file.originalname;
    receipt.mimeType = req.file.mimetype;
    receipt.size = req.file.size;
    receipt.extension = path.extname(req.file.originalname);
    receipt.storagePath = storagePath;
    receipt.thumbnailPath = thumbnailPath;
    receipt.uploadedBy = req.user.sub;
    receipt.uploadedAt = new Date();

    await expense.save();

    res.json({
      message: 'Receipt replaced successfully.',
      receipts: expense.receipts.map((item) => serializeReceipt(req, expense._id, item)),
    });
  } catch (error) {
    res.status(error.status || 500).json({ message: error.message });
  }
});

module.exports = router;
