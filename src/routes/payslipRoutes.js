const express = require('express');
const multer = require('multer');
const path = require('path');
const payslipController = require('../controllers/payslipController');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    // Generate a unique filename to prevent collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Routes
// 1. Upload CSV and Company Logo, Parse, and Return Column Mapping Guesses
router.post('/upload-csv', upload.fields([
  { name: 'csvFile', maxCount: 1 },
  { name: 'logoFile', maxCount: 1 }
]), payslipController.uploadCsv);

// 1.5. Confirm Mapping and Validate Data
router.post('/confirm-mapping', payslipController.confirmMapping);

// 2. Generate PDFs and ZIP via Server-Sent Events (SSE) for progress
router.get('/generate-stream', payslipController.generateStream);

// 3. Cancel and cleanup files
router.post('/cancel', payslipController.cancelSession);

// 4. Download the generated ZIP file
router.get('/download-zip/:zipFilename', payslipController.downloadZip);

module.exports = router;
