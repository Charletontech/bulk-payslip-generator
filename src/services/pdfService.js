const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { formatNaira } = require('../utils/currency');

exports.initBrowser = async () => {
  return await puppeteer.launch({
    headless: true, // "new" is default now
    channel: 'msedge', // Fallback to local Edge since download failed
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  }).catch(async () => {
    // If Edge fails, try Chrome
    return await puppeteer.launch({
      headless: true,
      channel: 'chrome',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });
};

exports.generatePayslipPdf = async (page, employeeData, companyConfig, outputPath) => {
  const templatePath = path.join(__dirname, '../templates/payslip.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  // Calculate fields dynamically from the mapped object
  let grossPay = parseFloat(employeeData.gross_pay?.replace(/,/g, ''));
  let totalDeductions = 0;
  let netPay = parseFloat(employeeData.net_pay?.replace(/,/g, ''));

  let calculatedEarnings = 0;
  let earningsHtml = '';
  
  employeeData.earnings.forEach(earn => {
    const amt = parseFloat(earn.amount?.replace(/,/g, '') || 0);
    calculatedEarnings += amt;
    earningsHtml += `<div class="flex justify-between py-2 px-3 rounded-xl bg-surface-container-low">
            <span class="capitalize">${earn.name}</span>
            <span class="font-semibold text-on-surface">${formatNaira(amt)}</span>
          </div>`;
  });

  if (isNaN(grossPay)) {
    grossPay = calculatedEarnings;
  }

  let deductionsHtml = '';
  employeeData.deductions.forEach(ded => {
    const amt = parseFloat(ded.amount?.replace(/,/g, '') || 0);
    totalDeductions += amt;
    deductionsHtml += `<div class="flex justify-between py-2 px-3 rounded-xl bg-secondary-container/30">
            <span class="capitalize">${ded.name}</span>
            <span class="font-semibold text-secondary">${formatNaira(amt)}</span>
          </div>`;
  });

  if (isNaN(netPay)) {
    netPay = grossPay - totalDeductions;
  }

  // Generate logo HTML if available
  let logoHtml = `<div class="w-14 h-14 rounded-2xl bg-primary text-on-primary font-headline font-bold text-xl flex items-center justify-center shadow-sm">
                    ${companyConfig.companyName ? companyConfig.companyName.substring(0, 2).toUpperCase() : 'CO'}
                  </div>`;
  
  if (companyConfig.logoPath) {
    try {
      const logoFullPath = path.join(__dirname, '../../uploads', companyConfig.logoPath);
      if (fs.existsSync(logoFullPath)) {
        const logoData = fs.readFileSync(logoFullPath);
        const ext = path.extname(companyConfig.logoPath).toLowerCase().substring(1) || 'png';
        const base64Logo = logoData.toString('base64');
        logoHtml = `<img src="data:image/${ext};base64,${base64Logo}" class="w-14 h-14 rounded-2xl object-cover shadow-sm" />`;
      }
    } catch (e) {
      console.error('Failed to inject logo into PDF:', e);
    }
  }
  
  // Replace placeholders
  const replacements = {
    '{{COMPANY_LOGO}}': logoHtml,
    '{{COMPANY_NAME}}': companyConfig.companyName || 'Company Name',
    '{{COMPANY_ADDRESS}}': companyConfig.companyAddress || 'Company Address',
    '{{COMPANY_CONTACT}}': companyConfig.contactEmail || '',
    '{{PAY_PERIOD}}': employeeData.raw?.month || companyConfig.payPeriod || 'Current Month',
    '{{PAY_DATE}}': employeeData.raw?.date || companyConfig.payDate || 'Current Date',
    '{{EMP_NAME}}': employeeData.employee_name,
    '{{EMP_ID}}': employeeData.employee_id || 'N/A',
    '{{DEPARTMENT}}': employeeData.department || 'N/A',
    '{{POSITION}}': employeeData.position || 'N/A',
    '{{EARNINGS_ROWS}}': earningsHtml || '<div class="text-on-surface-variant text-center py-2">No individual earnings itemized</div>',
    '{{DEDUCTIONS_ROWS}}': deductionsHtml || '<div class="text-on-surface-variant text-center py-2">No individual deductions itemized</div>',
    '{{GROSS_PAY}}': formatNaira(grossPay),
    '{{TOTAL_DED}}': formatNaira(totalDeductions),
    '{{NET_PAY}}': formatNaira(netPay)
  };

  for (const [key, value] of Object.entries(replacements)) {
    const regex = new RegExp(key, 'g');
    html = html.replace(regex, value);
  }
  
  // UsesetContent to inject the HTML - optimized without networkidle delay
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  
  // Emulate print media for accurate CSS rendering
  await page.emulateMediaType('print');
  
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' }
  });
};
