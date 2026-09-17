const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const payslipRoutes = require('./src/routes/payslipRoutes');
const cleanupService = require('./src/services/cleanupService');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure upload and temp directories exist
const uploadsDir = path.join(__dirname, 'uploads');
const tempDir = path.join(__dirname, 'temp');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve temporary logos securely, only if they exist
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/payslips', payslipRoutes);

// Periodic cleanup of temporary files (runs every 10 minutes, cleans files older than 1 hour)
setInterval(() => {
  cleanupService.cleanOldFiles(uploadsDir, 60 * 60 * 1000);
  cleanupService.cleanOldFiles(tempDir, 60 * 60 * 1000);
}, 10 * 60 * 1000);

// Initial cleanup on start
cleanupService.cleanOldFiles(uploadsDir, 60 * 60 * 1000);
cleanupService.cleanOldFiles(tempDir, 60 * 60 * 1000);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
