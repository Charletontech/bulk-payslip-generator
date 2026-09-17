exports.validateRows = (rawRows, mappingConfig) => {
  const validRows = [];
  const invalidRows = [];
  
  if (rawRows.length === 0) {
    throw new Error("Uploaded CSV is empty.");
  }

  // Ensure minimum mapped fields exist
  const mappedValues = Object.values(mappingConfig);
  if (!mappedValues.includes('employee_id')) {
    throw new Error('You must map at least one column to "Employee ID" (Required for Zoho).');
  }
  if (!mappedValues.includes('employee_name')) {
    throw new Error('You must map at least one column to "Employee Name".');
  }
  if (!mappedValues.includes('gross_pay') && !mappedValues.includes('net_pay')) {
    throw new Error('You must map at least one column to "Gross Pay" or "Net Pay".');
  }

  rawRows.forEach((row, index) => {
    const rowNum = index + 1;
    const errors = [];
    
    // Create a normalized row object based on the mapping
    const mappedRow = {
      earnings: [],
      deductions: [],
      raw: row
    };

    let empName = 'Unknown';

    for (const [originalHeader, type] of Object.entries(mappingConfig)) {
      const val = row[originalHeader] || '';
      const cleanVal = val.toString().trim();
      
      switch (type) {
        case 'employee_id':
          mappedRow.employee_id = cleanVal;
          if (!cleanVal) errors.push("Missing Employee ID (Required for Zoho)");
          break;
        case 'employee_name':
          mappedRow.employee_name = cleanVal;
          empName = cleanVal || empName;
          if (!cleanVal) errors.push("Missing Employee Name");
          break;
        case 'department':
          mappedRow.department = cleanVal;
          break;
        case 'position':
          mappedRow.position = cleanVal;
          break;
        case 'gross_pay':
          mappedRow.gross_pay = cleanVal;
          break;
        case 'net_pay':
          mappedRow.net_pay = cleanVal;
          break;
        case 'earning':
          if (cleanVal) mappedRow.earnings.push({ name: originalHeader, amount: cleanVal });
          break;
        case 'deduction':
          if (cleanVal) mappedRow.deductions.push({ name: originalHeader, amount: cleanVal });
          break;
      }
    }

    // Check financial requirements
    if (!mappedRow.gross_pay && !mappedRow.net_pay) {
      // Check if they have any mapped earnings or deductions to calculate it
      if (mappedRow.earnings.length === 0) {
        errors.push("Missing Gross/Net Pay and no individual Earnings provided to calculate it.");
      }
    }

    if (errors.length > 0) {
      invalidRows.push({
        rowNumber: rowNum,
        employeeName: empName,
        errors: errors.join(', ')
      });
    } else {
      validRows.push(mappedRow);
    }
  });

  return {
    totalRows: rawRows.length,
    validCount: validRows.length,
    invalidCount: invalidRows.length,
    validRows,
    invalidRows
  };
};
