const csvService = require('../services/csvService');
const validationService = require('../services/validationService');
const pdfService = require('../services/pdfService');
const zipService = require('../services/zipService');
const fs = require('fs');
const path = require('path');
const { sanitizeFilename } = require('../utils/filenames');

// In-memory store to pass data from validation to generation.
// In a production app, this would be backed by Redis or a database.
const sessionStore = new Map();

const mappingService = require('../services/mappingService');

exports.uploadCsv = async (req, res) => {
  try {
    const csvFile = req.files['csvFile'] ? req.files['csvFile'][0] : null;
    const logoFile = req.files['logoFile'] ? req.files['logoFile'][0] : null;

    if (!csvFile) {
      return res.status(400).json({ success: false, message: 'CSV file is required.' });
    }

    // Read and parse CSV
    const csvData = await csvService.parseCsv(csvFile.path);
    
    if (csvData.length === 0) {
      return res.status(400).json({ success: false, message: 'Uploaded CSV is empty.' });
    }

    // Generate intelligent column mapping
    const headers = Object.keys(csvData[0]);
    const suggestedMapping = mappingService.autoMapColumns(headers);

    const sessionId = Date.now().toString();
    const companyConfig = {
      companyName: req.body.companyName || '',
      companyAddress: req.body.companyAddress || '',
      contactEmail: req.body.contactEmail || '',
      logoPath: logoFile ? logoFile.filename : null,
      payPeriod: req.body.payPeriod || '',
      payDate: req.body.payDate || ''
    };

    // Store raw data in session
    sessionStore.set(sessionId, {
      rawCsvData: csvData,
      companyConfig,
      csvFilePath: csvFile.path
    });

    res.json({
      success: true,
      sessionId,
      suggestedMapping
    });
  } catch (error) {
    console.error('Error in uploadCsv:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error during upload.' });
  }
};

exports.confirmMapping = (req, res) => {
  try {
    const { sessionId, mapping } = req.body; // mapping is an object: { "Original Header": "employee_id", ... }

    if (!sessionId || !sessionStore.has(sessionId)) {
      return res.status(400).json({ success: false, message: 'Invalid or expired session.' });
    }

    const sessionData = sessionStore.get(sessionId);
    
    // Validate rows using the provided mapping
    const validationResult = validationService.validateRows(sessionData.rawCsvData, mapping);

    // Save valid rows and mapping to session for generation
    sessionData.validRows = validationResult.validRows;
    sessionData.mapping = mapping;
    // Clear raw data to save memory
    delete sessionData.rawCsvData;

    res.json({
      success: true,
      validation: validationResult
    });
  } catch (error) {
    console.error('Error in confirmMapping:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error during mapping validation.' });
  }
};

exports.generateStream = async (req, res) => {
  const sessionId = req.query.sessionId;
  
  if (!sessionId || !sessionStore.has(sessionId)) {
    return res.status(400).json({ error: 'Invalid or missing session ID.' });
  }

  const { validRows, companyConfig } = sessionStore.get(sessionId);

  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const sendEvent = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  try {
    sendEvent('start', { message: 'Starting PDF generation...' });
    
    // Create a unique temporary directory for this session's PDFs
    const sessionTempDir = path.join(__dirname, '../../temp', `session_${sessionId}`);
    if (!fs.existsSync(sessionTempDir)) {
      fs.mkdirSync(sessionTempDir, { recursive: true });
    }

    const generatedPdfPaths = [];
    
    // Initialize Puppeteer browser
    const browser = await pdfService.initBrowser();

    // SAFE CONCURRENCY LIMIT: 5 tabs at a time
    const CONCURRENCY_LIMIT = 5;
    const pages = [];
    for (let i = 0; i < CONCURRENCY_LIMIT; i++) {
      pages.push(await browser.newPage());
    }

    let completedCount = 0;

    // Process rows in chunks based on concurrency limit
    for (let i = 0; i < validRows.length; i += CONCURRENCY_LIMIT) {
      const chunk = validRows.slice(i, i + CONCURRENCY_LIMIT);
      
      await Promise.all(chunk.map(async (row, index) => {
        const page = pages[index]; // Reuse the pooled page
        const empName = row.employee_name || row.full_name || 'Employee';
        const safeName = sanitizeFilename(empName);
        const safeEmpId = row.employee_id ? sanitizeFilename(row.employee_id) : '';
        const period = sanitizeFilename(companyConfig.payPeriod || 'Payslip');
        
        const empIdPart = safeEmpId ? `${safeEmpId}-` : '';
        const namePart = safeName.toUpperCase();
        const pdfFilename = `${empIdPart}${namePart} PAYSLIP.pdf`;
        const pdfPath = path.join(sessionTempDir, pdfFilename);

        await pdfService.generatePayslipPdf(page, row, companyConfig, pdfPath);
        generatedPdfPaths.push(pdfPath);

        completedCount++;
        // Send progress update
        sendEvent('progress', {
          completed: completedCount,
          total: validRows.length,
          currentEmployee: empName,
          employeeId: row.employee_id
        });
      }));
    }

    // Clean up all pages and the browser
    await Promise.all(pages.map(page => page.close()));
    await browser.close();

    sendEvent('progress', { message: 'Zipping files...' });

    // Zip the files
    const zipFilename = `Payslips_${sanitizeFilename(companyConfig.companyName || 'Company')}_${sessionId}.zip`;
    const zipPath = path.join(__dirname, '../../temp', zipFilename);

    await zipService.createZip(sessionTempDir, zipPath);

    // Clean up individual PDFs and the session temp dir as they are now in the ZIP
    fs.rmSync(sessionTempDir, { recursive: true, force: true });
    
    // Send completion event
    sendEvent('complete', { 
      zipFilename,
      downloadUrl: `/api/payslips/download-zip/${zipFilename}`
    });

  } catch (error) {
    console.error('Error during generation:', error);
    sendEvent('error', { message: 'Failed to generate payslips. ' + error.message });
  } finally {
    // End the stream
    res.end();
    
    // Clean up uploaded files now that generation is complete
    const sessionData = sessionStore.get(sessionId);
    if (sessionData) {
      if (sessionData.csvFilePath && fs.existsSync(sessionData.csvFilePath)) {
        try { fs.unlinkSync(sessionData.csvFilePath); } catch (e) { console.error('Failed to delete CSV:', e); }
      }
      if (sessionData.companyConfig && sessionData.companyConfig.logoPath) {
        const logoFullPath = path.join(__dirname, '../../uploads', sessionData.companyConfig.logoPath);
        if (fs.existsSync(logoFullPath)) {
          try { fs.unlinkSync(logoFullPath); } catch (e) { console.error('Failed to delete logo:', e); }
        }
      }
    }

    // Clean up session store to free memory
    sessionStore.delete(sessionId);
  }
};

exports.downloadZip = (req, res) => {
  const zipFilename = req.params.zipFilename;
  // Prevent path traversal
  const safeFilename = path.basename(zipFilename);
  const zipPath = path.join(__dirname, '../../temp', safeFilename);

  if (fs.existsSync(zipPath)) {
    res.download(zipPath, safeFilename, (err) => {
      if (err) {
        console.error('Error downloading zip:', err);
      }
      // Note: We leave the zip on the server so the user can re-download if the browser fails,
      // it will be cleaned up automatically by the cleanupService after 1 hour.
    });
  } else {
    res.status(404).send('ZIP file not found or has expired.');
  }
};

exports.cancelSession = (req, res) => {
  const sessionId = req.query.sessionId;
  if (sessionId && sessionStore.has(sessionId)) {
    const sessionData = sessionStore.get(sessionId);
    if (sessionData.csvFilePath && fs.existsSync(sessionData.csvFilePath)) {
      try { fs.unlinkSync(sessionData.csvFilePath); } catch (e) {}
    }
    if (sessionData.companyConfig && sessionData.companyConfig.logoPath) {
      const logoFullPath = path.join(__dirname, '../../uploads', sessionData.companyConfig.logoPath);
      if (fs.existsSync(logoFullPath)) {
        try { fs.unlinkSync(logoFullPath); } catch (e) {}
      }
    }
    sessionStore.delete(sessionId);
  }
  res.json({ success: true });
};
