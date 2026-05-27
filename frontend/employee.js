// ============================================================
// EMPLOYEE MANAGEMENT
// ============================================================

let currentEmployees = [];
let selectedEmployee = null;

async function loadEmployees() {
  try {
    const res = await apiFetch('/employees');
    if (res.ok) {
      let data = await res.json();
      
      const filterSelect = document.getElementById('empStatusFilter');
      const selectedStatus = filterSelect ? filterSelect.value : 'Active';
      
      if (selectedStatus !== 'All') {
        data = data.filter(emp => emp.status === selectedStatus);
      }
      
      currentEmployees = data;
      renderEmployeeTable();
    }
  } catch (err) {
    console.error('Failed to load employees:', err);
    showToast('Failed to load employees', 'error');
  }
}

function renderEmployeeTable() {
  const container = document.getElementById('empGridContainer');
  if (!currentEmployees || currentEmployees.length === 0) {
    container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1;">No employees found. Add one to get started.</div>`;
    return;
  }

  container.innerHTML = currentEmployees.map(emp => {
    const statusClass = emp.status === 'Active' ? 'success' : (emp.status === 'On Leave' ? 'warning' : 'danger');
    const avatar = emp.profilePictureUrl || 'icon.png';
    return `
      <div class="emp-card-item" style="padding: 0; display: flex; flex-direction: column; overflow: hidden;">
        <!-- Large Portrait Photo Container -->
        <div style="width: 100%; aspect-ratio: 1/1; position: relative; background: var(--surface2); overflow: hidden;">
           <!-- Blurred Background layer (fills empty space) -->
           <div style="position: absolute; inset: -20px; background-image: url('${avatar}'); background-size: cover; background-position: center; filter: blur(15px); opacity: 0.5; z-index: 0;"></div>
           
           <!-- Uncropped Actual Photo -->
           <img src="${avatar}" style="position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; object-position: bottom; z-index: 1;" alt="Avatar" onerror="this.src='icon.png'" />
           
           <!-- Status Badge overlay -->
           <span class="emp-status-badge ${statusClass}" style="position: absolute; top: 10px; right: 10px; padding: 4px 10px; font-size: 0.75rem; box-shadow: 0 4px 12px rgba(0,0,0,0.5); z-index: 2; border-radius: 20px;">${emp.status}</span>
        </div>
        
        <!-- Info Body -->
        <div class="emp-card-body" style="padding: 1rem 1rem 0.75rem 1rem; text-align: center; flex: 1;">
          <div class="emp-card-name" style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.1rem;">${emp.name}</div>
          <div class="emp-card-id" style="font-size: 0.8rem; color: var(--text3); margin-bottom: 0.5rem;">${emp.employeeId}</div>
          <div class="emp-card-role" style="font-size: 0.95rem; color: var(--primary); margin-bottom: 0.3rem; font-weight: 600;">${emp.jobTitle} &bull; <span style="color:var(--text2); font-weight:400">${emp.department}</span></div>
          <div class="emp-card-contact" style="color: var(--text3); font-size: 0.85rem;">📞 ${emp.phone || 'N/A'}</div>
        </div>
        
        <!-- Footer -->
        <div class="emp-card-footer" style="padding: 0.75rem 1rem; border-top: 1px solid var(--border); background: var(--surface);">
          <button class="btn-secondary btn-full" style="font-size: 0.9rem; padding: 0.5rem;" onclick="viewEmployee('${emp._id}')">View Full Profile</button>
        </div>
      </div>
    `;
  }).join('');
}

// Submitting Employee Form (supports file upload)
document.getElementById('employeeForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const id = document.getElementById('empEditId').value;
  const formData = new FormData();

  formData.append('name', document.getElementById('empName').value);
  formData.append('employeeId', document.getElementById('empId').value);
  formData.append('jobTitle', document.getElementById('empJobTitle').value);
  formData.append('department', document.getElementById('empDept').value);
  formData.append('email', document.getElementById('empEmail').value);
  formData.append('phone', document.getElementById('empPhone').value);
  formData.append('dob', document.getElementById('empDob').value);
  formData.append('bloodGroup', document.getElementById('empBlood').value);
  formData.append('aadharNumber', document.getElementById('empAadhar').value);
  formData.append('address', document.getElementById('empAddress').value);
  formData.append('doj', document.getElementById('empDoj').value);
  formData.append('employmentType', document.getElementById('empType').value);
  formData.append('salary', document.getElementById('empSalary').value || 0);
  formData.append('status', document.getElementById('empStatus').value);

  const fileInput = document.getElementById('empPicture');
  if (fileInput && fileInput.files.length > 0) {
    formData.append('profilePicture', fileInput.files[0]);
  }

  const docInput = document.getElementById('empDocument');
  if (docInput && docInput.files.length > 0) {
    formData.append('document', docInput.files[0]);
  }

  try {
    const url = id ? `${API}/employees/${id}` : `${API}/employees`;
    const method = id ? 'PUT' : 'POST';

    // We can't use our standard apiFetch for FormData directly if it sets Content-Type to application/json
    // So we fetch directly
    const options = {
      method,
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    };

    const res = await fetch(url, options);
    if (res.ok) {
      showToast(id ? 'Employee updated!' : 'Employee added!', 'success');
      closeModal('employeeModal');
      loadEmployees();
      if (selectedEmployee && selectedEmployee._id === id) {
        viewEmployee(id); // Reload detail view if it's open
      }
    } else {
      const d = await res.json();
      showToast(d.error || 'Failed to save employee', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Server error', 'error');
  }
});

// Detail View & Tabs
async function viewEmployee(id) {
  try {
    const res = await apiFetch(`/employees/${id}`);
    const emp = await res.json();
    selectedEmployee = emp;

    // Populate Header
    document.getElementById('empDocUploadId').value = emp._id;
    document.getElementById('empDetImg').src = emp.profilePictureUrl || 'icon.png';
    document.getElementById('empDetName').textContent = emp.name;
    document.getElementById('empDetId').textContent = emp.employeeId;
    document.getElementById('empDetDept').textContent = emp.jobTitle + ' - ' + emp.department;

    const statusEl = document.getElementById('empDetStatus');
    statusEl.textContent = emp.status;
    statusEl.className = 'emp-status-badge ' + (emp.status === 'Active' ? 'active' : (emp.status === 'On Leave' ? 'warning' : 'danger'));

    // Populate Tab Content
    document.getElementById('empDetEmail').textContent = emp.email || '-';
    document.getElementById('empDetPhone').textContent = emp.phone || '-';
    document.getElementById('empDetAddr').textContent = emp.address || '-';
    document.getElementById('empDetDob').textContent = emp.dob ? new Date(emp.dob).toLocaleDateString() : '-';
    document.getElementById('empDetEmerg').textContent = emp.emergencyContact || '-';
    document.getElementById('empDetBlood').textContent = emp.bloodGroup || '-';
    document.getElementById('empDetAadhar').textContent = emp.aadharNumber || '-';

    if (emp.documentUrl) {
      document.getElementById('empDetDoc').innerHTML = `<a href="${emp.documentUrl}" target="_blank" class="btn-secondary btn-sm" style="text-decoration:none">📄 View Document</a>`;
    } else {
      document.getElementById('empDetDoc').textContent = '-';
    }

    document.getElementById('empDetDoj').textContent = emp.doj ? new Date(emp.doj).toLocaleDateString() : '-';
    document.getElementById('empDetMgr').textContent = emp.reportingManager || '-';
    document.getElementById('empDetType').textContent = emp.employmentType || '-';
    document.getElementById('empDetLoc').textContent = emp.location || '-';
    document.getElementById('empDetTz').textContent = emp.timezone || '-';

    document.getElementById('empDetSalary').textContent = emp.salary ? '₹' + emp.salary.toLocaleString('en-IN') : '-';
    document.getElementById('empDetTax').textContent = emp.taxBracket || '-';
    document.getElementById('empDetBank').textContent = emp.bankDetails || '-';

    document.getElementById('empDetPerf').textContent = emp.performanceRating || '-';

    // Show Detail View
    document.getElementById('empListView').classList.add('hidden');
    document.getElementById('empDetailView').classList.remove('hidden');
  } catch (err) {
    showToast('Failed to load employee details', 'error');
  }
}

function closeEmpDetail() {
  document.getElementById('empDetailView').classList.add('hidden');
  document.getElementById('empListView').classList.remove('hidden');
  selectedEmployee = null;
}

function switchEmpTab(tabName) {
  document.querySelectorAll('.emp-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.emp-tab-content').forEach(content => content.classList.add('hidden'));
  document.querySelectorAll('.emp-tab-content').forEach(content => content.classList.remove('active'));

  event.target.classList.add('active');
  const targetContent = document.getElementById('empTab-' + tabName);
  if (targetContent) {
    targetContent.classList.remove('hidden');
    targetContent.classList.add('active');
  }
}

function editCurrentEmp() {
  if (!selectedEmployee) return;
  const emp = selectedEmployee;

  document.getElementById('empEditId').value = emp._id;
  document.getElementById('empName').value = emp.name || '';
  document.getElementById('empId').value = emp.employeeId || '';
  document.getElementById('empJobTitle').value = emp.jobTitle || '';
  document.getElementById('empDept').value = emp.department || '';
  document.getElementById('empEmail').value = emp.email || '';
  document.getElementById('empPhone').value = emp.phone || '';
  document.getElementById('empAadhar').value = emp.aadharNumber || '';
  document.getElementById('empDob').value = emp.dob ? emp.dob.split('T')[0] : '';
  document.getElementById('empBlood').value = emp.bloodGroup || '';
  document.getElementById('empAddress').value = emp.address || '';
  document.getElementById('empDoj').value = emp.doj ? emp.doj.split('T')[0] : '';
  document.getElementById('empType').value = emp.employmentType || 'Full-time';
  document.getElementById('empSalary').value = emp.salary || 0;
  document.getElementById('empStatus').value = emp.status || 'Active';

  document.getElementById('empModalTitle').textContent = 'Edit Employee';
  openModal('employeeModal');
}

async function terminateCurrentEmp() {
  if (!selectedEmployee) return;
  if (!confirm(`Are you sure you want to terminate ${selectedEmployee.name}?`)) return;

  try {
    const res = await fetch(`${API}/employees/${selectedEmployee._id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'Terminated' })
    });

    if (res.ok) {
      showToast('Employee terminated.', 'success');
      viewEmployee(selectedEmployee._id); // Refresh
      loadEmployees();
    }
  } catch (err) {
    showToast('Error terminating employee', 'error');
  }
}
// Upload Document in Detail View
document.getElementById('empDocUploadForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('empDocUploadId').value;
  if (!id) return;
  
  const fileInput = document.getElementById('empNewDoc');
  const typeSelect = document.getElementById('empDocType').value;
  
  if (fileInput.files.length === 0) return;
  
  const formData = new FormData();
  formData.append(typeSelect, fileInput.files[0]);
  
  try {
    const res = await fetch(`${API}/employees/${id}`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });
    
    if (res.ok) {
      showToast('File uploaded successfully!', 'success');
      fileInput.value = ''; // clear input
      viewEmployee(id); // refresh detail view
      loadEmployees();
    } else {
      const d = await res.json();
      showToast(d.error || 'Failed to upload file', 'error');
    }
  } catch (err) {
    console.error(err);
    showToast('Server error uploading file', 'error');
  }
});

// Initial Load
loadEmployees();
