const ALIASES = {
  employee_id: ['id', 'emp id', 'employee id', 'staff id', 'staff no', 'employee no', 'employeeid', 'staffid'],
  employee_name: ['name', 'full name', 'employee name', 'staff name', 'employee', 'fullname'],
  department: ['dept', 'department', 'unit', 'division'],
  position: ['role', 'title', 'position', 'designation', 'job title'],
  gross_pay: ['gross', 'gross pay', 'gross salary', 'total earnings', 'grosspay', 'total gross'],
  net_pay: ['net', 'net pay', 'net salary', 'take home', 'take home pay', 'netpay', 'total net', 'final pay'],
};

const EARNING_KEYWORDS = ['basic', 'salary', 'housing', 'transport', 'allowance', 'bonus', 'commission', 'overtime', 'earnings', 'pay', 'arrears', 'leave'];
const DEDUCTION_KEYWORDS = ['tax', 'paye', 'pension', 'nhf', 'nhis', 'deduction', 'loan', 'penalty', 'surcharge', 'absent'];

const cleanHeader = (header) => {
  return header.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
};

const cleanHeaderTight = (header) => {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
};

exports.autoMapColumns = (csvHeaders) => {
  const mapping = [];

  csvHeaders.forEach(header => {
    const clean = cleanHeader(header);
    const tight = cleanHeaderTight(header);
    
    let suggestedType = 'ignore';
    let matched = false;

    // 1. Check strict fixed aliases
    for (const [key, aliases] of Object.entries(ALIASES)) {
      if (aliases.includes(clean) || aliases.includes(tight)) {
        suggestedType = key;
        matched = true;
        break;
      }
    }

    // 2. Check Earnings/Deductions keywords if no strict match
    if (!matched) {
      const words = clean.split(' ');
      
      const hasDeduction = words.some(w => DEDUCTION_KEYWORDS.includes(w));
      const hasEarning = words.some(w => EARNING_KEYWORDS.includes(w));

      if (hasDeduction) {
        suggestedType = 'deduction';
      } else if (hasEarning) {
        // "pay" is tricky, but usually an earning if not net/gross
        suggestedType = 'earning';
      } else {
        // Try substring match just in case
        if (DEDUCTION_KEYWORDS.some(k => tight.includes(k))) {
          suggestedType = 'deduction';
        } else if (EARNING_KEYWORDS.some(k => tight.includes(k))) {
          suggestedType = 'earning';
        }
      }
    }

    // Avoid mapping empty headers
    if (!tight) suggestedType = 'ignore';

    mapping.push({
      originalHeader: header,
      suggestedType: suggestedType
    });
  });

  return mapping;
};
