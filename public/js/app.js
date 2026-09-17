document.addEventListener('DOMContentLoaded', () => {
  const uploadForm = document.getElementById('uploadForm');
  const csvFileInput = document.getElementById('csvFile');
  const dropZone = document.getElementById('dropZone');
  const fileNameDisplay = document.getElementById('fileNameDisplay');
  const btnUpload = document.getElementById('btnUpload');
  const uploadError = document.getElementById('uploadError');

  // Steps
  const step1 = document.getElementById('step1');
  const step2 = document.getElementById('step2');
  const step3 = document.getElementById('step3');

  // Validation Elements
  const valTotalText = document.getElementById('valTotalText');
  const statParsed = document.getElementById('statParsed');
  const statValid = document.getElementById('statValid');
  const statInvalid = document.getElementById('statInvalid');
  const statInvalidContainer = document.getElementById('statInvalidContainer');
  const valExceptionBadge = document.getElementById('valExceptionBadge');
  const valSuccessBadge = document.getElementById('valSuccessBadge');
  const errorLogContainer = document.getElementById('errorLogContainer');
  const errorList = document.getElementById('errorList');
  const btnGenerate = document.getElementById('btnGenerate');
  const btnGenerateText = document.getElementById('btnGenerateText');
  const btnCancel = document.getElementById('btnCancel');

  // Generation Elements
  const progressTitle = document.getElementById('progressTitle');
  const progressText = document.getElementById('progressText');
  const progressBar = document.getElementById('progressBar');
  const progressDetail = document.getElementById('progressDetail');
  const downloadSection = document.getElementById('downloadSection');
  const btnDownload = document.getElementById('btnDownload');
  const zipNameText = document.getElementById('zipNameText');

  let currentSessionId = null;

  // --- Local Storage Logic ---
  const loadCompanyInfo = () => {
    const dataString = localStorage.getItem('companyInfo');
    if (dataString) {
      const data = JSON.parse(dataString);
      // Check if older than 1 hour
      if (Date.now() - data.timestamp > 60 * 60 * 1000) {
        localStorage.removeItem('companyInfo');
      } else {
        document.getElementById('companyName').value = data.companyName || '';
        document.getElementById('companyAddress').value = data.companyAddress || '';
        document.getElementById('contactEmail').value = data.contactEmail || '';
        document.getElementById('payPeriod').value = data.payPeriod || '';
      }
    }
  };

  const saveCompanyInfo = () => {
    const data = {
      companyName: document.getElementById('companyName').value,
      companyAddress: document.getElementById('companyAddress').value,
      contactEmail: document.getElementById('contactEmail').value,
      payPeriod: document.getElementById('payPeriod').value,
      timestamp: Date.now()
    };
    localStorage.setItem('companyInfo', JSON.stringify(data));
  };

  loadCompanyInfo();

  // --- Toast Logic ---
  let toastTimeout;
  function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.classList.remove('opacity-0', 'translate-y-20');
    toast.classList.add('opacity-100', 'translate-y-0');
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'translate-y-20');
    }, 4000);
  }

  // --- Logo Upload UI Logic ---
  const logoFile = document.getElementById('logoFile');
  const logoDropZone = document.getElementById('logoDropZone');
  const logoNameDisplay = document.getElementById('logoNameDisplay');

  logoDropZone.addEventListener('click', () => logoFile.click());

  logoFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        showToast('Image size is too large (Max 10MB)');
        logoFile.value = ''; // Reset
        logoNameDisplay.textContent = 'Upload Logo Image (Max 10MB)';
        logoNameDisplay.classList.remove('text-primary', 'font-semibold');
      } else {
        logoNameDisplay.textContent = file.name;
        logoNameDisplay.classList.add('text-primary', 'font-semibold');
      }
    }
  });

  // --- File Upload UI Logic ---
  dropZone.addEventListener('click', () => csvFileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-primary', 'bg-primary-fixed/10');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-primary', 'bg-primary-fixed/10');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-primary', 'bg-primary-fixed/10');
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        csvFileInput.files = e.dataTransfer.files;
        updateFileNameDisplay(file.name);
      } else {
        alert('Please upload a valid CSV file.');
      }
    }
  });

  csvFileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      updateFileNameDisplay(e.target.files[0].name);
    }
  });

  function updateFileNameDisplay(name) {
    fileNameDisplay.textContent = name;
    fileNameDisplay.classList.add('text-primary', 'font-semibold');
  }

  // --- Upload and Validate ---
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    uploadError.classList.add('hidden');
    
    if (!csvFileInput.files[0]) {
      uploadError.textContent = 'Please select a CSV file first.';
      uploadError.classList.remove('hidden');
      return;
    }

    saveCompanyInfo();
    btnUpload.disabled = true;
    btnUpload.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">autorenew</span><span>Uploading...</span>';

    const formData = new FormData(uploadForm);
    // Assuming a logo file input exists, though in preview it's just a UI element. 
    // We would append it here if we implemented the file input.
    
    try {
      const response = await fetch('/api/payslips/upload-csv', {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      currentSessionId = data.sessionId;
      renderMappingUI(data.suggestedMapping);
      
    } catch (error) {
      uploadError.textContent = error.message;
      uploadError.classList.remove('hidden');
    } finally {
      btnUpload.disabled = false;
      btnUpload.innerHTML = '<span>Proceed to Validation</span><span class="material-symbols-outlined text-lg">arrow_forward</span>';
    }
  });

  const stepMapping = document.getElementById('stepMapping');
  const mappingContainer = document.getElementById('mappingContainer');
  const btnCancelMapping = document.getElementById('btnCancelMapping');
  const btnConfirmMapping = document.getElementById('btnConfirmMapping');
  const mappingError = document.getElementById('mappingError');

  function renderMappingUI(suggestedMapping) {
    step1.classList.add('opacity-50', 'pointer-events-none');
    stepMapping.classList.remove('hidden');
    mappingContainer.innerHTML = '';
    mappingError.classList.add('hidden');

    const options = [
      { value: 'ignore', label: 'Ignore this column' },
      { value: 'employee_id', label: 'Employee ID (Required for Zoho)' },
      { value: 'employee_name', label: 'Employee Name (Required)' },
      { value: 'department', label: 'Department' },
      { value: 'position', label: 'Position / Role' },
      { value: 'gross_pay', label: 'Gross Pay (Required if no Net)' },
      { value: 'net_pay', label: 'Net Pay (Required if no Gross)' },
      { value: 'earning', label: 'Earning (e.g. Basic, Bonus)' },
      { value: 'deduction', label: 'Deduction (e.g. Tax, Pension)' }
    ];

    suggestedMapping.forEach(item => {
      const row = document.createElement('div');
      row.className = 'flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-surface-container-lowest border border-outline-variant/30 gap-2';
      
      const selectHtml = options.map(opt => 
        `<option value="${opt.value}" ${item.suggestedType === opt.value ? 'selected' : ''}>${opt.label}</option>`
      ).join('');

      row.innerHTML = `
        <span class="font-semibold text-on-surface text-sm truncate" title="${item.originalHeader}">${item.originalHeader}</span>
        <select class="mapping-select p-2 rounded-lg bg-surface-container text-sm border-none focus:ring-2 focus:ring-primary min-w-[250px]" data-header="${item.originalHeader}">
          ${selectHtml}
        </select>
      `;
      mappingContainer.appendChild(row);
    });
    
    stepMapping.scrollIntoView({ behavior: 'smooth' });
  }

  btnCancelMapping.addEventListener('click', () => {
    if (currentSessionId) {
      fetch(`/api/payslips/cancel?sessionId=${currentSessionId}`, { method: 'POST' }).catch(console.error);
    }
    stepMapping.classList.add('hidden');
    step1.classList.remove('opacity-50', 'pointer-events-none');
    csvFileInput.value = '';
    updateFileNameDisplay('No file selected (Max 10MB)');
    currentSessionId = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  btnConfirmMapping.addEventListener('click', async () => {
    mappingError.classList.add('hidden');
    const selects = document.querySelectorAll('.mapping-select');
    const mapping = {};
    selects.forEach(sel => {
      mapping[sel.dataset.header] = sel.value;
    });

    btnConfirmMapping.disabled = true;
    btnConfirmMapping.innerHTML = '<span class="material-symbols-outlined text-lg animate-spin">autorenew</span><span>Validating...</span>';

    try {
      const response = await fetch('/api/payslips/confirm-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: currentSessionId, mapping })
      });
      
      const data = await response.json();
      if (!data.success) throw new Error(data.message);

      stepMapping.classList.add('hidden');
      showValidationResults(data.validation);
    } catch (error) {
      mappingError.textContent = error.message;
      mappingError.classList.remove('hidden');
    } finally {
      btnConfirmMapping.disabled = false;
      btnConfirmMapping.innerHTML = '<span>Confirm Mapping</span><span class="material-symbols-outlined text-sm">check</span>';
    }
  });

  function showValidationResults(validation) {
    step1.classList.add('opacity-50', 'pointer-events-none');
    step2.classList.remove('hidden');

    valTotalText.textContent = `Found ${validation.totalRows} rows`;
    statParsed.textContent = validation.totalRows;
    statValid.textContent = validation.validCount;
    statInvalid.textContent = validation.invalidCount;

    if (validation.invalidCount > 0) {
      valExceptionBadge.classList.remove('hidden');
      valSuccessBadge.classList.add('hidden');
      statInvalidContainer.classList.remove('bg-surface-container-highest', 'border-transparent');
      statInvalidContainer.classList.add('bg-secondary-container/50', 'border-secondary-container');
      
      errorLogContainer.classList.remove('hidden');
      errorList.innerHTML = '';
      validation.invalidRows.forEach(row => {
        const errDiv = document.createElement('div');
        errDiv.className = 'flex items-center justify-between p-3 rounded-lg bg-surface-container text-sm';
        errDiv.innerHTML = `
          <div class="flex items-center gap-3">
            <span class="font-mono font-bold text-secondary text-xs">Row ${row.rowNumber}</span>
            <span class="text-on-surface">${row.errors}</span>
          </div>
          <span class="text-xs text-on-surface-variant">${row.employeeName}</span>
        `;
        errorList.appendChild(errDiv);
      });

      btnGenerateText.textContent = `Continue with ${validation.validCount} Valid Rows`;
    } else {
      valExceptionBadge.classList.add('hidden');
      valSuccessBadge.classList.remove('hidden');
      statInvalidContainer.classList.add('bg-surface-container-highest', 'border-transparent');
      statInvalidContainer.classList.remove('bg-secondary-container/50', 'border-secondary-container');
      errorLogContainer.classList.add('hidden');
      btnGenerateText.textContent = `Start Generating Payslips`;
    }

    if (validation.validCount === 0) {
      btnGenerate.disabled = true;
      btnGenerate.classList.add('opacity-50', 'cursor-not-allowed');
    } else {
      btnGenerate.disabled = false;
      btnGenerate.classList.remove('opacity-50', 'cursor-not-allowed');
    }

    step2.scrollIntoView({ behavior: 'smooth' });
  }

  btnCancel.addEventListener('click', () => {
    if (currentSessionId) {
      fetch(`/api/payslips/cancel?sessionId=${currentSessionId}`, { method: 'POST' }).catch(console.error);
    }
    step2.classList.add('hidden');
    step3.classList.add('hidden');
    step1.classList.remove('opacity-50', 'pointer-events-none');
    csvFileInput.value = '';
    fileNameDisplay.textContent = 'No file selected (Max 10MB)';
    fileNameDisplay.classList.remove('text-primary', 'font-semibold');
    currentSessionId = null;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // --- Generation via SSE ---
  btnGenerate.addEventListener('click', () => {
    if (!currentSessionId) return;

    step2.classList.add('opacity-50', 'pointer-events-none');
    step3.classList.remove('hidden');
    step3.scrollIntoView({ behavior: 'smooth' });

    // Reset progress UI
    progressTitle.textContent = 'Generating PDF Payslips...';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    progressDetail.textContent = 'Starting engine...';
    downloadSection.classList.add('hidden');

    const eventSource = new EventSource(`/api/payslips/generate-stream?sessionId=${currentSessionId}`);

    eventSource.addEventListener('start', (e) => {
      const data = JSON.parse(e.data);
      progressDetail.textContent = data.message;
    });

    eventSource.addEventListener('progress', (e) => {
      const data = JSON.parse(e.data);
      if (data.message) {
        progressDetail.textContent = data.message;
      } else {
        const percentage = Math.round((data.completed / data.total) * 100);
        progressBar.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}% (${data.completed} / ${data.total})`;
        progressDetail.textContent = `Rendered: ${data.currentEmployee} ${data.employeeId ? '(' + data.employeeId + ')' : ''}`;
      }
    });

    eventSource.addEventListener('complete', (e) => {
      const data = JSON.parse(e.data);
      progressTitle.textContent = 'Generation Complete';
      progressDetail.textContent = 'All payslips generated successfully.';
      
      zipNameText.textContent = data.zipFilename;
      btnDownload.href = data.downloadUrl;
      
      downloadSection.classList.remove('hidden');
      eventSource.close();
    });

    eventSource.addEventListener('error', (e) => {
      let data = {};
      try { data = JSON.parse(e.data); } catch (err) {}
      progressTitle.textContent = 'Generation Failed';
      progressTitle.classList.add('text-secondary');
      progressDetail.textContent = data.message || 'An error occurred during PDF generation.';
      progressBar.classList.add('bg-secondary');
      eventSource.close();
    });
  });
});
