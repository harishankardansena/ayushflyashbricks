/* ============================================================
   FLY ASH BRICKS MANAGEMENT SYSTEM – MAIN JS
   ============================================================ */

const API = window.location.origin.includes('localhost') ? 'http://localhost:5000/api' : '/api';
let token = localStorage.getItem('fabToken');
let currentPage = 'dashboard';
let productionChart = null;
let expenseChart = null;
let confirmCallback = null;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  updateTopbarDate();
  populateYearSelects();
  setDefaultDates();
  setCurrentMonthFilters();

  if (token) {
    verifyAndShow();
  } else {
    showLogin();
  }
});

function updateTopbarDate() {
  const el = document.getElementById('topbarDate');
  if (el) {
    const now = new Date();
    el.textContent = now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  }
}

function populateYearSelects() {
  const year = new Date().getFullYear();
  const selects = ['prodYear', 'expYear', 'billYear', 'reportYear', 'usageYear'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = ''; // Clear existing
    for (let y = year + 1; y >= year - 3; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      if (y === year) opt.selected = true;
      el.appendChild(opt);
    }
  });

  // Months
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthSelects = ['prodMonth', 'expMonth', 'billMonth', 'usageMonth', 'attMonth'];
  monthSelects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'attMonth') el.innerHTML = '';
    else el.innerHTML = '<option value="">All Months</option>';
    months.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1;
      opt.textContent = m;
      el.appendChild(opt);
    });
  });
}

function setCurrentMonthFilters() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();
  ['prodMonth','expMonth','billMonth'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = m;
  });
  ['prodYear','expYear','billYear'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = y;
  });
  // Report defaults
  const rm = document.getElementById('reportMonth');
  if (rm) rm.value = m;
  const am = document.getElementById('attMonth');
  if (am) am.value = m;
}

function setDefaultDates() {
  const today = new Date().toISOString().split('T')[0];
  ['prodDate','expDate','billDate'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = today;
  });
}

// ============================================================
// AUTH
// ============================================================
async function verifyAndShow() {
  try {
    const res = await fetch(`${API}/auth/verify`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      showApp(data.admin);
    } else {
      localStorage.removeItem('fabToken');
      showLogin();
    }
  } catch {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('loginPage').classList.remove('hidden');
  document.getElementById('mainApp').classList.add('hidden');
}

function showApp(admin) {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('mainApp').classList.remove('hidden');
  if (admin?.name) {
    document.getElementById('adminName').textContent = admin.name;
    // Avatar first letter
    document.querySelector('.admin-avatar').textContent = admin.name[0].toUpperCase();
  }
  navigateTo('dashboard');
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  const errEl = document.getElementById('loginError');
  errEl.classList.add('hidden');
  btn.textContent = 'Signing in...';
  btn.disabled = true;

  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      token = data.token;
      localStorage.setItem('fabToken', token);
      showApp(data.admin);
    } else {
      errEl.textContent = data.message || 'Login failed';
      errEl.classList.remove('hidden');
    }
  } catch {
    errEl.textContent = 'Cannot connect to server. Please start the backend.';
    errEl.classList.remove('hidden');
  } finally {
    btn.innerHTML = '<span>Sign In</span>';
    btn.disabled = false;
  }
});

function logout() {
  localStorage.removeItem('fabToken');
  token = null;
  showLogin();
  showToast('Logged out successfully', 'info');
}

function togglePassword() {
  const input = document.getElementById('loginPassword');
  input.type = input.type === 'password' ? 'text' : 'password';
}

// ============================================================
// NAVIGATION
// ============================================================
function navigateTo(page, filter) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.classList.add('hidden');
  });
  const target = document.getElementById(`page-${page}`);
  if (target) {
    target.classList.remove('hidden');
    target.classList.add('active');
  }
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  const titles = {
    dashboard: 'Dashboard',
    production: 'Production Management',
    inventory: 'Inventory Management',
    expenses: 'Expense Tracker',
    billing: 'Billing System',
    attendance: 'Attendance & Wages',
    reports: 'Monthly Reports'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;

  // Close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');

  // Load page data
  if (page === 'dashboard') loadDashboard();
  else if (page === 'production') loadProduction();
  else if (page === 'inventory') { loadInventory(); loadUsage(); }
  else if (page === 'attendance') loadAttendance();
  else if (page === 'expenses') {
    if (filter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      loadExpenses(1, today);
    } else {
      loadExpenses();
    }
  }
  else if (page === 'billing') {
    if (filter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      loadBilling(1, today);
    } else {
      loadBilling();
    }
  }
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ============================================================
// DASHBOARD
// ============================================================
async function loadDashboard() {
  try {
    const res = await apiFetch('/dashboard');
    const d = await res.json();

    // Stats
    const stockStatus = d.currentStock < 500 ? 'danger' : d.currentStock < 2000 ? 'warning' : '';
    document.getElementById('dashboardStats').innerHTML = `
      <div class="stat-card" style="--card-color: rgba(108,99,255,0.3)">
        <div class="stat-icon">🏭</div>
        <div class="stat-label">Today's Production</div>
        <div class="stat-value">${fmt(d.today.produced)}</div>
        <div class="stat-sub">Bricks produced today</div>
      </div>
      <div class="stat-card" style="--card-color: rgba(16,185,129,0.3)">
        <div class="stat-icon">💰</div>
        <div class="stat-label">Today's Sales</div>
        <div class="stat-value">${fmt(d.today.sold)}</div>
        <div class="stat-sub">Bricks sold today</div>
      </div>
      <div class="stat-card" style="--card-color: rgba(59,130,246,0.3)">
        <div class="stat-icon">📦</div>
        <div class="stat-label">Current Stock</div>
        <div class="stat-value">${fmt(d.currentStock)}</div>
        <div class="stat-sub ${stockStatus ? 'stat-badge ' + stockStatus : ''}">
          ${stockStatus === 'danger' ? '⚠️ Critical' : stockStatus === 'warning' ? '⚠️ Low' : 'Available bricks'}
        </div>
      </div>
      <div class="stat-card" style="--card-color: rgba(239,68,68,0.3); cursor:pointer" onclick="navigateTo('expenses', 'today')">
        <div class="stat-icon">💸</div>
        <div class="stat-label">Today's Expenses</div>
        <div class="stat-value">₹${fmtMoney(d.today.expenses)}</div>
        <div class="stat-sub">Click to view logs</div>
      </div>
      <div class="stat-card" style="--card-color: rgba(16,185,129,0.3); cursor:pointer" onclick="navigateTo('billing', 'today')">
        <div class="stat-icon">💵</div>
        <div class="stat-label">Today's Revenue</div>
        <div class="stat-value">₹${fmtMoney(d.today.revenue)}</div>
        <div class="stat-sub">Click to view logs</div>
      </div>
      <div class="stat-card" style="--card-color: rgba(245,158,11,0.3)">
        <div class="stat-icon">📊</div>
        <div class="stat-label">Monthly Production</div>
        <div class="stat-value">${fmt(d.monthly.produced)}</div>
        <div class="stat-sub">Sold: ${fmt(d.monthly.sold)}</div>
      </div>
      <div class="stat-card" style="--card-color: rgba(239,68,68,0.3)">
        <div class="stat-icon">🧾</div>
        <div class="stat-label">Monthly Expenses</div>
        <div class="stat-value">₹${fmtMoney(d.monthly.expenses)}</div>
        <div class="stat-sub">This month</div>
      </div>
      <div class="stat-card" style="--card-color: rgba(16,185,129,0.3)">
        <div class="stat-icon">💰</div>
        <div class="stat-label">Monthly Revenue</div>
        <div class="stat-value">₹${fmtMoney(d.monthly.revenue)}</div>
        <div class="stat-badge ${d.monthly.profit >= 0 ? '' : 'danger'}">
          ${d.monthly.profit >= 0 ? '📈' : '📉'} Profit: ₹${fmtMoney(Math.abs(d.monthly.profit))}
        </div>
      </div>
    `;

    // Charts
    renderProductionChart(d.chartData);
    renderExpenseChart(d.expenseBreakdown);

    // Alerts
    if (d.lowStockAlerts.length > 0) {
      const badgeEl = document.getElementById('notifBadge');
      badgeEl.textContent = d.lowStockAlerts.length;
      badgeEl.classList.remove('hidden');
      document.getElementById('notifList').innerHTML = d.lowStockAlerts.map(a =>
        `<div class="notif-item">⚠️ <strong>${a.material}</strong> is low — ${a.quantity} ${a.unit} remaining (min: ${a.minimumLevel})</div>`
      ).join('');

      document.getElementById('alertsSection').innerHTML = `
        <div style="font-weight:600; margin-bottom:0.75rem; color: var(--warning)">⚠️ Low Stock Alerts</div>
        ${d.lowStockAlerts.map(a => `
          <div class="alert-item">
            <span class="alert-icon">📦</span>
            <div class="alert-text"><strong>${a.material}</strong> — only ${a.quantity} ${a.unit} left</div>
            <span class="alert-value">Min: ${a.minimumLevel} ${a.unit}</span>
          </div>
        `).join('')}
      `;
    } else {
      document.getElementById('alertsSection').innerHTML = '<div style="color:var(--text3); font-size:0.875rem; padding:0.5rem 0">✅ All inventory levels are adequate.</div>';
    }
  } catch (err) {
    console.error(err);
  }
}

function renderProductionChart(data) {
  const ctx = document.getElementById('productionChart').getContext('2d');
  if (productionChart) productionChart.destroy();
  productionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map(d => {
        const dt = new Date(d.date);
        return dt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      }),
      datasets: [
        {
          label: 'Produced',
          data: data.map(d => d.produced),
          backgroundColor: 'rgba(108,99,255,0.7)',
          borderRadius: 6, borderSkipped: false
        },
        {
          label: 'Sold',
          data: data.map(d => d.sold),
          backgroundColor: 'rgba(16,185,129,0.7)',
          borderRadius: 6, borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: { legend: { labels: { color: '#9ba3b8', font: { family: 'Inter' } } } },
      scales: {
        x: { ticks: { color: '#6b7491' }, grid: { color: 'rgba(255,255,255,0.04)' } },
        y: { ticks: { color: '#6b7491' }, grid: { color: 'rgba(255,255,255,0.04)' } }
      }
    }
  });
}

function renderExpenseChart(data) {
  const ctx = document.getElementById('expenseChart').getContext('2d');
  if (expenseChart) expenseChart.destroy();
  if (!data || data.length === 0) return;
  const colors = ['#6c63ff','#10b981','#f59e0b','#ef4444','#3b82f6','#8b5cf6'];
  expenseChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: data.map(d => d._id),
      datasets: [{
        data: data.map(d => d.total),
        backgroundColor: colors.slice(0, data.length),
        borderWidth: 0, hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#9ba3b8', font: { family: 'Inter' }, padding: 12, boxWidth: 12 }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ₹${fmtMoney(ctx.raw)}`
          }
        }
      }
    }
  });
}

function toggleNotifPanel() {
  document.getElementById('notifPanel').classList.toggle('hidden');
}

// ============================================================
// PRODUCTION
// ============================================================
let prodCurrentPage = 1;

async function loadProduction(page = 1) {
  prodCurrentPage = page;
  const month = document.getElementById('prodMonth').value;
  const year = document.getElementById('prodYear').value;
  let url = `/production?page=${page}&limit=15`;
  if (month) url += `&month=${month}`;
  if (year) url += `&year=${year}`;

  try {
    const res = await apiFetch(url);
    const data = await res.json();
    const tbody = document.getElementById('productionBody');

    if (!data.records || data.records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="empty-icon">🏭</div>No production records found</div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.records.map(r => `
      <tr>
        <td>${formatDate(r.date)}</td>
        <td>${fmt(r.previousStock)}</td>
        <td><strong style="color:var(--primary)">${fmt(r.produced)}</strong></td>
        <td><strong style="color:var(--success)">${fmt(r.sold)}</strong></td>
        <td><strong style="color:var(--text)">${fmt(r.currentStock)}</strong></td>
        <td style="color:var(--text3); font-size:0.8rem">${r.notes || '—'}</td>
        <td>
          <div class="action-btns">
            <button class="btn-icon edit" onclick="editProduction('${r._id}','${r.date}',${r.produced},${r.sold},'${r.notes||''}')">✏️</button>
            <button class="btn-icon delete" onclick="deleteRecord('${r._id}','production','productionBody')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');

    renderPagination('prodPagination', data.page, data.pages, (p) => loadProduction(p));
  } catch (err) {
    console.error(err);
    showToast('Failed to load production data', 'error');
  }
}

document.getElementById('productionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('prodEditId').value;
  const payload = {
    date: document.getElementById('prodDate').value,
    produced: parseInt(document.getElementById('prodProduced').value),
    sold: parseInt(document.getElementById('prodSold').value),
    notes: document.getElementById('prodNotes').value
  };

  try {
    const res = id
      ? await apiFetch(`/production/${id}`, 'PUT', payload)
      : await apiFetch('/production', 'POST', payload);
    if (res.ok) {
      showToast(id ? 'Production updated!' : 'Production entry added!', 'success');
      closeModal('productionModal');
      loadProduction(prodCurrentPage);
      if (currentPage === 'dashboard') loadDashboard();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed to save', 'error');
    }
  } catch { showToast('Server error', 'error'); }
});

function editProduction(id, date, produced, sold, notes) {
  document.getElementById('prodEditId').value = id;
  document.getElementById('prodDate').value = date.split('T')[0];
  document.getElementById('prodProduced').value = produced;
  document.getElementById('prodSold').value = sold;
  document.getElementById('prodNotes').value = notes;
  document.getElementById('prodModalTitle').textContent = 'Edit Production Entry';
  openModal('productionModal');
}

// ============================================================
// INVENTORY
// ============================================================
async function loadInventory() {
  try {
    const res = await apiFetch('/inventory');
    const items = await res.json();
    const grid = document.getElementById('inventoryGrid');

    if (!items || items.length === 0) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">📦</div>No inventory items. Add raw materials.</div>`;
      return;
    }

    grid.innerHTML = items.map(item => {
      const pct = Math.min(100, Math.round((item.quantity / (item.minimumLevel * 3)) * 100));
      const isLow = item.quantity <= item.minimumLevel;
      return `
        <div class="inv-card ${isLow ? 'low-stock' : ''}">
          ${isLow ? '<div class="inv-alert">⚠️ Low Stock</div>' : ''}
          <div class="inv-material">${item.material}</div>
          <div class="inv-qty">${item.quantity.toLocaleString('en-IN')}</div>
          <div class="inv-unit">${item.unit}</div>
          <div class="inv-progress">
            <div class="inv-progress-bar ${isLow ? 'low' : ''}" style="width:${pct}%"></div>
          </div>
          <div class="inv-meta">
            Min Level: ${item.minimumLevel} ${item.unit} &nbsp;·&nbsp;
            Updated: ${formatDate(item.lastUpdated)}
            ${item.notes ? '<br>' + item.notes : ''}
          </div>
          <div class="inv-actions">
            <button class="btn-secondary" style="flex:1; font-size:0.8rem" 
              onclick="editInventory('${item._id}','${item.material}',${item.quantity},'${item.unit}',${item.minimumLevel},'${item.notes||''}')">
              ✏️ Update
            </button>
            <button class="btn-icon delete" onclick="deleteRecord('${item._id}','inventory','inventoryGrid')">🗑️</button>
          </div>
        </div>
      `;
    }).join('');
  } catch { showToast('Failed to load inventory', 'error'); }
}

document.getElementById('inventoryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('invEditId').value;
  const payload = {
    material: document.getElementById('invMaterial').value,
    quantity: parseFloat(document.getElementById('invQty').value),
    unit: document.getElementById('invUnit').value,
    minimumLevel: parseFloat(document.getElementById('invMinLevel').value) || 100,
    notes: document.getElementById('invNotes').value
  };

  try {
    const res = id
      ? await apiFetch(`/inventory/${id}`, 'PUT', payload)
      : await apiFetch('/inventory', 'POST', payload);
    if (res.ok) {
      showToast(id ? 'Inventory updated!' : 'Material added!', 'success');
      closeModal('inventoryModal');
      loadInventory();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed to save', 'error');
    }
  } catch { showToast('Server error', 'error'); }
});

function editInventory(id, material, qty, unit, minLevel, notes) {
  document.getElementById('invEditId').value = id;
  document.getElementById('invMaterial').value = material;
  document.getElementById('invQty').value = qty;
  document.getElementById('invUnit').value = unit;
  document.getElementById('invMinLevel').value = minLevel;
  document.getElementById('invNotes').value = notes;
  document.getElementById('invModalTitle').textContent = 'Update Material';
  document.getElementById('invMaterial').disabled = true;
  openModal('inventoryModal');
}

// INVENTORY USAGE
let usageCurrentPage = 1;
async function loadUsage(page = 1) {
  usageCurrentPage = page;
  const month = document.getElementById('usageMonth').value;
  const year = document.getElementById('usageYear').value;
  const material = document.getElementById('usageMaterial').value;
  
  let url = `/inventory/usage?page=${page}&limit=10`;
  if (month) url += `&month=${month}`;
  if (year) url += `&year=${year}`;
  
  try {
    const res = await apiFetch(url);
    const data = await res.json();
    const tbody = document.getElementById('usageBody');

    // Filter by material frontend-side if selected
    let records = data.records;
    if (material) {
      records = records.filter(r => r.material === material);
    }

    if (!records || records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state">No usage records found.</div></td></tr>`;
      return;
    }

    tbody.innerHTML = records.map(r => `
      <tr>
        <td>${formatDate(r.date)}</td>
        <td><strong>${r.material}</strong></td>
        <td><strong style="color:var(--danger)">- ${fmt(r.usedQuantity)} ${r.unit}</strong></td>
        <td>${r.purpose}</td>
        <td>${fmt(r.remainingAfter)} ${r.unit}</td>
        <td>
          <button class="btn-icon delete" onclick="deleteRecord('${r._id}','inventory/usage','usageBody')">🗑️</button>
        </td>
      </tr>
    `).join('');

    renderPagination('usagePagination', data.page, data.pages, (p) => loadUsage(p));
  } catch (err) {
    console.error(err);
  }
}

async function populateUsageMaterials() {
  try {
    const res = await apiFetch('/inventory');
    const items = await res.json();
    const select = document.getElementById('usageInvId');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '<option value="">Choose Material</option>';
    items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item._id;
      opt.textContent = `${item.material} (Stock: ${item.quantity} ${item.unit})`;
      select.appendChild(opt);
    });
    select.value = currentVal;
  } catch {}
}

document.getElementById('usageForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    inventoryId: document.getElementById('usageInvId').value,
    usedQuantity: parseFloat(document.getElementById('usageQty').value),
    date: document.getElementById('usageDate').value,
    purpose: document.getElementById('usagePurpose').value,
    notes: document.getElementById('usageNotes').value
  };

  try {
    const res = await apiFetch('/inventory/usage', 'POST', payload);
    const data = await res.json();
    if (res.ok) {
      showToast(data.message || 'Usage logged!', 'success');
      closeModal('usageModal');
      loadUsage();
      loadInventory();
      if (currentPage === 'dashboard') loadDashboard();
    } else {
      showToast(data.message || 'Failed to log usage', 'error');
    }
  } catch {
    showToast('Server error', 'error');
  }
});

function openModal(id) {
  document.getElementById(id).classList.remove('hidden');
  // Reset edit state for production/inventory
  if (id === 'productionModal') {
    if (!document.getElementById('prodEditId').value) {
      document.getElementById('prodModalTitle').textContent = 'Add Production Entry';
      document.getElementById('productionForm').reset();
      setDefaultDates();
    }
  }
  if (id === 'inventoryModal') {
    if (!document.getElementById('invEditId').value) {
      document.getElementById('invModalTitle').textContent = 'Add Raw Material';
      document.getElementById('inventoryForm').reset();
      document.getElementById('invMaterial').disabled = false;
    }
  }
  if (id === 'expenseModal') {
    if (!document.getElementById('expEditId').value) {
      document.getElementById('expModalTitle').textContent = 'Add Expense';
      document.getElementById('expenseForm').reset();
      setDefaultDates();
    }
  }
  if (id === 'usageModal') {
    document.getElementById('usageForm').reset();
    setDefaultDates();
    populateUsageMaterials();
  }
  if (id === 'workerModal') {
    loadWorkers();
  }
}

function closeModal(id) {
  document.getElementById(id).classList.add('hidden');
  // Clear edit IDs
  ['prodEditId','invEditId','expEditId'].forEach(eid => {
    const el = document.getElementById(eid);
    if (el) el.value = '';
  });
  if (document.getElementById('invMaterial')) {
    document.getElementById('invMaterial').disabled = false;
  }
}

// ============================================================
// EXPENSES
// ============================================================
let expCurrentPage = 1;

async function loadExpenses(page = 1, filterDate = '') {
  expCurrentPage = page;
  const month = document.getElementById('expMonth').value;
  const year = document.getElementById('expYear').value;
  const cat = document.getElementById('expCategory').value;
  let url = `/expenses?page=${page}&limit=15`;
  if (filterDate) {
    url += `&date=${filterDate}`;
    // Clear other filters to avoid visual confusion
    document.getElementById('expMonth').value = '';
    document.getElementById('expCategory').value = '';
  } else {
    if (month) url += `&month=${month}`;
    if (year) url += `&year=${year}`;
    if (cat) url += `&category=${encodeURIComponent(cat)}`;
  }

  try {
    const res = await apiFetch(url);
    const data = await res.json();

    document.getElementById('expenseSummary').innerHTML = `
      <div class="exp-sum-card">
        <div class="exp-sum-label">Total Records</div>
        <div class="exp-sum-value">${data.total}</div>
      </div>
      <div class="exp-sum-card">
        <div class="exp-sum-label">Total Amount</div>
        <div class="exp-sum-value" style="color:var(--danger)">₹${fmtMoney(data.totalAmount)}</div>
      </div>
    `;

    const tbody = document.getElementById('expenseBody');
    if (!data.records || data.records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">💸</div>No expense records found</div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.records.map(e => {
      const catClass = 'cat-' + e.category.toLowerCase().replace(' ', '');
      return `
        <tr>
          <td>${formatDate(e.date)}</td>
          <td><span class="cat-badge ${catClass}">${e.category}</span></td>
          <td>${e.description}</td>
          <td><strong style="color:var(--danger)">₹${fmtMoney(e.amount)}</strong></td>
          <td><span class="status-badge status-paid">${e.paymentMode}</span></td>
          <td>
            <div class="action-btns">
              <button class="btn-icon edit" onclick="editExpense('${e._id}','${e.date}','${e.category}','${e.description}',${e.amount},'${e.paymentMode}')">✏️</button>
              <button class="btn-icon delete" onclick="deleteRecord('${e._id}','expenses','expenseBody')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    renderPagination('expPagination', data.page, data.pages, (p) => loadExpenses(p));
  } catch { showToast('Failed to load expenses', 'error'); }
}

document.getElementById('expenseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('expEditId').value;
  const payload = {
    date: document.getElementById('expDate').value,
    category: document.getElementById('expCat').value,
    description: document.getElementById('expDesc').value,
    amount: parseFloat(document.getElementById('expAmount').value),
    paymentMode: document.getElementById('expPayMode').value
  };

  try {
    const res = id
      ? await apiFetch(`/expenses/${id}`, 'PUT', payload)
      : await apiFetch('/expenses', 'POST', payload);
    if (res.ok) {
      showToast(id ? 'Expense updated!' : 'Expense added!', 'success');
      closeModal('expenseModal');
      loadExpenses(expCurrentPage);
      if (currentPage === 'dashboard') loadDashboard();
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed to save', 'error');
    }
  } catch { showToast('Server error', 'error'); }
});

function editExpense(id, date, category, description, amount, paymentMode) {
  document.getElementById('expEditId').value = id;
  document.getElementById('expDate').value = date.split('T')[0];
  document.getElementById('expCat').value = category;
  document.getElementById('expDesc').value = description;
  document.getElementById('expAmount').value = amount;
  document.getElementById('expPayMode').value = paymentMode;
  document.getElementById('expModalTitle').textContent = 'Edit Expense';
  openModal('expenseModal');
}

// ============================================================
// BILLING
// ============================================================
let billCurrentPage = 1;

function toggleGstFields() {
  const enabled = document.getElementById('billGstEnabled').checked;
  document.getElementById('gstFields').classList.toggle('hidden', !enabled);
}

function calcBillTotal() {
  const bricks = parseFloat(document.getElementById('billBricks').value) || 0;
  const rate = parseFloat(document.getElementById('billRate').value) || 0;
  const worker = parseFloat(document.getElementById('billWorker').value) || 0;
  const transport = parseFloat(document.getElementById('billTransport').value) || 0;
  const gstEnabled = document.getElementById('billGstEnabled').checked;
  const cgstRate = parseFloat(document.getElementById('billCgst').value) || 0;
  const sgstRate = parseFloat(document.getElementById('billSgst').value) || 0;
  const discount = parseFloat(document.getElementById('billDiscount').value) || 0;

  const itemTotal = bricks * rate;
  const otherCharges = worker + transport;
  const taxableAmount = itemTotal + otherCharges - discount;

  let finalAmount = taxableAmount;
  if (gstEnabled) {
    const cgst = taxableAmount * (cgstRate / 100);
    const sgst = taxableAmount * (sgstRate / 100);
    finalAmount = taxableAmount + cgst + sgst;
  }

  document.getElementById('calcTotal').textContent = `₹${fmtMoney(itemTotal + otherCharges)}`;
  document.getElementById('calcDiscount').textContent = `₹${fmtMoney(discount)}`;
  document.getElementById('calcFinal').textContent = `₹${fmtMoney(Math.max(0, finalAmount))}`;
}

async function loadBilling(page = 1, filterDate = '') {
  billCurrentPage = page;
  const month = document.getElementById('billMonth').value;
  const year = document.getElementById('billYear').value;
  const search = document.getElementById('billSearch').value;
  let url = `/billing?page=${page}&limit=15`;
  if (filterDate) {
    url += `&date=${filterDate}`;
    document.getElementById('billMonth').value = '';
    document.getElementById('billSearch').value = '';
  } else {
    if (month) url += `&month=${month}`;
    if (year) url += `&year=${year}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;
  }

  try {
    const res = await apiFetch(url);
    const data = await res.json();

    document.getElementById('billingTotals').innerHTML = `
      <div class="billing-total-card">
        <span class="label">Total Bills</span>
        <span class="value" style="color:var(--info)">${data.total}</span>
      </div>
      <div class="billing-total-card">
        <span class="label">Total Revenue</span>
        <span class="value">₹${fmtMoney(data.totalRevenue)}</span>
      </div>
    `;

    const tbody = document.getElementById('billingBody');
    if (!data.records || data.records.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state"><div class="empty-icon">🧾</div>No bills found</div></td></tr>`;
      return;
    }

    tbody.innerHTML = data.records.map(b => {
      const statusClass = `status-${b.paymentStatus.toLowerCase()}`;
      return `
        <tr>
          <td><strong style="color:var(--primary)">${b.billNumber}</strong></td>
          <td>${formatDate(b.date)}</td>
          <td><strong>${b.customer.name}</strong></td>
          <td>${b.customer.phone}</td>
          <td>${fmt(b.bricks)}</td>
          <td><strong style="color:var(--success)">₹${fmtMoney(b.finalAmount)}</strong></td>
          <td><span class="status-badge ${statusClass}">${b.paymentStatus}</span></td>
          <td>
            <div class="action-btns">
              <button class="btn-icon view" onclick="viewBill('${b._id}')">👁️</button>
              <button class="btn-icon delete" onclick="deleteRecord('${b._id}','billing','billingBody')">🗑️</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    renderPagination('billPagination', data.page, data.pages, (p) => loadBilling(p));
  } catch { showToast('Failed to load billing records', 'error'); }
}

document.getElementById('billingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    customer: {
      name: document.getElementById('billCustName').value,
      phone: document.getElementById('billCustPhone').value,
      address: document.getElementById('billCustAddr').value
    },
    date: document.getElementById('billDate').value,
    bricks: parseInt(document.getElementById('billBricks').value),
    ratePerBrick: parseFloat(document.getElementById('billRate').value),
    workerCharge: parseFloat(document.getElementById('billWorker').value) || 0,
    transportCharge: parseFloat(document.getElementById('billTransport').value) || 0,
    gstEnabled: document.getElementById('billGstEnabled').checked,
    cgstRate: parseFloat(document.getElementById('billCgst').value) || 0,
    sgstRate: parseFloat(document.getElementById('billSgst').value) || 0,
    discount: parseFloat(document.getElementById('billDiscount').value) || 0,
    paymentStatus: document.getElementById('billPayStatus').value,
    notes: document.getElementById('billNotes').value
  };

  try {
    const res = await apiFetch('/billing', 'POST', payload);
    if (res.ok) {
      const bill = await res.json();
      showToast(`Bill ${bill.billNumber} generated!`, 'success');
      closeModal('billingModal');
      document.getElementById('billingForm').reset();
      setDefaultDates();
      loadBilling(billCurrentPage);
    } else {
      const d = await res.json();
      showToast(d.message || 'Failed to generate bill', 'error');
    }
  } catch { showToast('Server error', 'error'); }
});

async function viewBill(id) {
  try {
    const res = await apiFetch(`/billing/${id}`);
    const b = await res.json();
    document.getElementById('billViewContent').innerHTML = `
      <div class="bill-print-area">
        <div class="bp-header">
          <div class="bp-company">Ayush Fly Ash Bricks</div>
          <div class="bp-subtitle">Official Sales Invoice</div>
          <div class="bp-billno">Bill No: ${b.billNumber}</div>
          <div style="font-size:0.8rem; color:var(--text3); margin-top:0.25rem">Date: ${new Date(b.date).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })}</div>
        </div>
        <div class="bp-grid">
          <div>
            <div class="bp-label">Customer Name</div>
            <div class="bp-value">${b.customer.name}</div>
          </div>
          <div>
            <div class="bp-label">Phone</div>
            <div class="bp-value">${b.customer.phone}</div>
          </div>
          <div style="grid-column:1/-1">
            <div class="bp-label">Address</div>
            <div class="bp-value">${b.customer.address}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr><th>Description</th><th>Quantity</th><th>Rate</th><th>Amount</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Fly Ash Bricks</td>
              <td>${b.bricks.toLocaleString('en-IN')} bricks</td>
              <td>₹${b.ratePerBrick}/brick</td>
              <td>₹${fmtMoney(b.bricks * b.ratePerBrick)}</td>
            </tr>
            ${b.workerCharge > 0 ? `<tr><td colspan="3">Worker Charges</td><td>₹${fmtMoney(b.workerCharge)}</td></tr>` : ''}
            ${b.transportCharge > 0 ? `<tr><td colspan="3">Transport Charges</td><td>₹${fmtMoney(b.transportCharge)}</td></tr>` : ''}
          </tbody>
        </table>
        <div class="bp-total-box">
          <div style="display:flex;justify-content:space-between;margin-bottom:0.375rem;font-size:0.875rem;color:var(--text2)">
            <span>Taxable Amount</span><span>₹${fmtMoney((b.bricks * b.ratePerBrick) + (b.workerCharge || 0) + (b.transportCharge || 0) - (b.discount || 0))}</span>
          </div>
          ${b.gstEnabled ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:0.375rem;font-size:0.875rem;color:var(--text2)">
              <span>CGST (${b.cgstRate}%)</span><span>₹${fmtMoney(((b.bricks * b.ratePerBrick) + (b.workerCharge || 0) + (b.transportCharge || 0) - (b.discount || 0)) * (b.cgstRate / 100))}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:0.375rem;font-size:0.875rem;color:var(--text2)">
              <span>SGST (${b.sgstRate}%)</span><span>₹${fmtMoney(((b.bricks * b.ratePerBrick) + (b.workerCharge || 0) + (b.transportCharge || 0) - (b.discount || 0)) * (b.sgstRate / 100))}</span>
            </div>
          ` : ''}
          ${b.discount > 0 ? `<div style="display:flex;justify-content:space-between;margin-bottom:0.375rem;font-size:0.875rem;color:var(--text2)">
            <span>Discount Applied</span><span>- ₹${fmtMoney(b.discount)}</span>
          </div>` : ''}
          <div style="display:flex;justify-content:space-between;border-top:1px solid var(--border2);padding-top:0.5rem;margin-top:0.25rem">
            <span style="font-weight:700">Final Amount</span>
            <span class="bp-final-amount">₹${fmtMoney(b.finalAmount)}</span>
          </div>
          <div style="margin-top:0.5rem;font-size:0.8rem;color:var(--text3)">
            Payment: <strong style="color:${b.paymentStatus === 'Paid' ? 'var(--success)' : b.paymentStatus === 'Pending' ? 'var(--warning)' : 'var(--info)'}">${b.paymentStatus}</strong>
          </div>
        </div>
        ${b.notes ? `<div style="margin-top:0.875rem;font-size:0.8rem;color:var(--text3)">Notes: ${b.notes}</div>` : ''}
        <div style="margin-top:1.25rem;text-align:center;font-size:0.75rem;color:var(--text3);border-top:1px dashed var(--border2);padding-top:0.875rem">
          Thank you for your business! 🧱
        </div>
      </div>
    `;
    openModal('billViewModal');
  } catch { showToast('Failed to load bill', 'error'); }
}

function printBill() {
  const content = document.getElementById('billViewContent').innerHTML;
  const win = window.open('', '_blank');
  win.document.write(`
    <html><head>
    <title>Bill - Fly Ash Bricks</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
      table { width: 100%; border-collapse: collapse; margin: 12px 0; }
      th, td { padding: 8px 12px; border: 1px solid #ddd; text-align: left; }
      th { background: #f5f5f5; }
      .bp-company { font-size: 1.4rem; font-weight: 800; color: #6c63ff; }
      .bp-final-amount { font-size: 1.2rem; font-weight: 800; color: #10b981; }
    </style>
    </head><body>${content}</body></html>
  `);
  win.document.close();
  win.print();
}

// ============================================================
// REPORTS
// ============================================================
async function downloadReport() {
  const month = document.getElementById('reportMonth').value;
  const year = document.getElementById('reportYear').value;
  if (!month || !year) { showToast('Please select month and year', 'error'); return; }

  try {
    const response = await fetch(`${API}/reports/excel?month=${month}&year=${year}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) { showToast('Failed to generate report', 'error'); return; }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    a.href = url;
    a.download = `FlyAshBricks_${months[month-1]}_${year}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Report downloaded successfully! 📊', 'success');
  } catch { showToast('Download failed', 'error'); }
}

// ============================================================
// DELETE CONFIRM
// ============================================================
function deleteRecord(id, type, refreshTarget) {
  document.getElementById('confirmMessage').textContent = `Are you sure you want to delete this ${type.replace('y','y')} record? This action cannot be undone.`;
  openModal('confirmModal');
  confirmCallback = async () => {
    try {
      const res = await apiFetch(`/${type}/${id}`, 'DELETE');
      if (res.ok) {
        showToast('Record deleted', 'success');
        closeModal('confirmModal');
        if (type === 'production') loadProduction(prodCurrentPage);
        else if (type === 'inventory') loadInventory();
        else if (type === 'expenses') loadExpenses(expCurrentPage);
        else if (type === 'billing') loadBilling(billCurrentPage);
        if (currentPage === 'dashboard') loadDashboard();
      } else showToast('Failed to delete', 'error');
    } catch { showToast('Server error', 'error'); }
  };
}

document.getElementById('confirmBtn').addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
});

// ============================================================
// PAGINATION
// ============================================================
function renderPagination(containerId, current, total, callback) {
  const el = document.getElementById(containerId);
  if (total <= 1) { el.innerHTML = ''; return; }
  let html = `<button class="page-btn" ${current === 1 ? 'disabled' : ''} onclick="(${callback.toString()})(${current - 1})">←</button>`;
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || Math.abs(i - current) <= 1) {
      html += `<button class="page-btn ${i === current ? 'active' : ''}" onclick="(${callback.toString()})(${i})">${i}</button>`;
    } else if (Math.abs(i - current) === 2) {
      html += `<span style="color:var(--text3)">…</span>`;
    }
  }
  html += `<button class="page-btn" ${current === total ? 'disabled' : ''} onclick="(${callback.toString()})(${current + 1})">→</button>`;
  el.innerHTML = html;
}

// ============================================================
// UTILITIES
// ============================================================
async function apiFetch(url, method = 'GET', body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    }
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(`${API}${url}`, opts);
}

function fmt(n) { return (n || 0).toLocaleString('en-IN'); }
function fmtMoney(n) { return (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }); }
function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

let toastTimeout;
function showToast(msg, type = 'info') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  el.classList.remove('hidden');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => el.classList.add('hidden'), 3500);
}

// Close modals on backdrop click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.add('hidden');
      ['prodEditId','invEditId','expEditId'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    }
  });
});

// Close notification panel on outside click
});

// ============================================================
// ATTENDANCE & PERSONNEL
// ============================================================
let attendanceView = 'weekly'; // 'weekly' or 'monthly'

async function loadAttendance() {
    switchAttView(attendanceView);
}

function switchAttView(view) {
    attendanceView = view;
    const btnW = document.getElementById('btnWeekly');
    const btnM = document.getElementById('btnMonthly');
    const monSel = document.getElementById('attMonth');
    const yrSel = document.getElementById('attYear');
    const rangeInfo = document.getElementById('weeklyDateRange');

    if (view === 'weekly') {
        btnW.classList.add('active');
        btnM.classList.remove('active');
        monSel.classList.add('hidden');
        yrSel.classList.add('hidden');
        rangeInfo.classList.remove('hidden');
    } else {
        btnW.classList.remove('active');
        btnM.classList.add('active');
        monSel.classList.remove('hidden');
        yrSel.classList.remove('hidden');
        rangeInfo.classList.add('hidden');
    }
    loadAttendanceReport();
}

async function loadAttendanceReport() {
    const month = document.getElementById('attMonth').value;
    const year = document.getElementById('attYear').value;
    
    let start, end;
    if (attendanceView === 'weekly') {
        const today = new Date();
        // Start of current week (Monday)
        const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1)));
        startOfWeek.setHours(0,0,0,0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23,59,59,999);
        start = startOfWeek.toISOString();
        end = endOfWeek.toISOString();
        document.getElementById('weeklyDateRange').textContent = `${formatDate(start)} to ${formatDate(end)}`;
    } else {
        start = new Date(year, month - 1, 1).toISOString();
        end = new Date(year, month, 0, 23, 59, 59, 999).toISOString();
    }

    try {
        const statsRes = await apiFetch(`/attendance/stats?start=${start}&end=${end}`);
        const stats = await statsRes.json();
        
        // Summary Cards
        const totalWages = stats.reduce((s, r) => s + r.totalWages, 0);
        const totalOT = stats.reduce((s, r) => s + r.totalOvertime, 0);
        document.getElementById('attendanceSummaryGrid').innerHTML = `
            <div class="att-sum-card">
                <div class="att-sum-label">TOTAL WORKERS</div>
                <div class="att-sum-value">${stats.length}</div>
            </div>
            <div class="att-sum-card">
                <div class="att-sum-label">ESTIMATED WAGES</div>
                <div class="att-sum-value">₹${fmtMoney(totalWages)}</div>
            </div>
            <div class="att-sum-card">
                <div class="att-sum-label">TOTAL OVERTIME</div>
                <div class="att-sum-value">${totalOT} Hrs</div>
            </div>
        `;

        // Table Headers
        const head = document.getElementById('attTableHead');
        head.innerHTML = `<th>Worker Detail</th><th>Category</th><th>Presence</th><th>OT (Hrs)</th><th>Total Wage (₹)</th>`;

        // Table Body
        const body = document.getElementById('attTableBody');
        if (stats.length === 0) {
            body.innerHTML = '<tr><td colspan="5"><div class="empty-state">No attendance records for this period</div></td></tr>';
            return;
        }

        body.innerHTML = stats.map(s => `
            <tr>
                <td><strong>${s.workerInfo.name}</strong><br><small style="color:var(--text3)">₹${s.workerInfo.dailyWage}/day</small></td>
                <td><span class="cat-badge cat-${s.workerInfo.category.toLowerCase()}">${s.workerInfo.category}</span></td>
                <td>${s.daysPresent} Present ${s.daysHalf > 0 ? `, ${s.daysHalf} Half` : ''}</td>
                <td>${s.totalOvertime}</td>
                <td><strong class="worker-row-wages">₹${fmtMoney(s.totalWages)}</strong></td>
            </tr>
        `).join('');

    } catch (err) {
        console.error(err);
        showToast('Failed to load attendance report', 'error');
    }
}

// === WORKER MANAGEMENT ===
async function loadWorkers() {
    try {
        const res = await apiFetch('/attendance');
        const workers = await res.json();
        const body = document.getElementById('workerListBody');
        body.innerHTML = workers.map(w => `
            <tr>
                <td><strong>${w.name}</strong><br><small>${w.phone || ''}</small></td>
                <td>${w.category}</td>
                <td>₹${w.dailyWage}</td>
                <td>
                    <button class="btn-icon delete" onclick="deleteWorker('${w._id}')">🗑️</button>
                </td>
            </tr>
        `).join('');
    } catch { }
}

document.getElementById('workerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('workerName').value,
        dailyWage: parseFloat(document.getElementById('workerWage').value),
        phone: document.getElementById('workerPhone').value,
        category: document.getElementById('workerCat').value
    };
    try {
        const res = await apiFetch('/attendance', 'POST', payload);
        if (res.ok) {
            showToast('Worker added successfully', 'success');
            document.getElementById('workerForm').reset();
            loadWorkers();
        }
    } catch { showToast('Error saving worker', 'error'); }
});

async function deleteWorker(id) {
    if (!confirm('Are you sure you want to remove this worker?')) return;
    try {
        const res = await apiFetch(`/attendance/${id}`, 'DELETE');
        if (res.ok) {
            showToast('Worker removed');
            loadWorkers();
            loadAttendanceReport();
        }
    } catch { }
}

// === ATTENDANCE LOGGING ===
async function openAttendanceLogger() {
    const res = await apiFetch('/attendance');
    const workers = await res.json();
    if (workers.length === 0) {
        showToast('Please add workers first', 'warning');
        openModal('workerModal');
        return;
    }

    document.getElementById('attLogDate').value = new Date().toISOString().split('T')[0];
    const body = document.getElementById('attLogBody');
    body.innerHTML = workers.map(w => `
        <tr data-worker-id="${w._id}">
            <td><strong>${w.name}</strong><br><small>₹${w.dailyWage}/day</small></td>
            <td>
                <select class="att-status-select" required>
                    <option value="Present">Present</option>
                    <option value="Half-Day">Half-Day</option>
                    <option value="Absent">Absent</option>
                </select>
            </td>
            <td>
                <input type="number" class="att-ot-input" value="0" min="0" step="0.5" style="max-width:80px" />
            </td>
        </tr>
    `).join('');
    openModal('attendanceLoggerModal');
}

document.getElementById('attendanceLoggerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const date = document.getElementById('attLogDate').value;
    const entries = [];
    document.querySelectorAll('#attLogBody tr').forEach(tr => {
        entries.push({
            workerId: tr.dataset.workerId,
            status: tr.querySelector('.att-status-select').value,
            overtimeHours: parseFloat(tr.querySelector('.att-ot-input').value) || 0
        });
    });

    try {
        const res = await apiFetch('/attendance/bulk', 'POST', { date, entries });
        if (res.ok) {
            showToast('Attendance records saved', 'success');
            closeModal('attendanceLoggerModal');
            loadAttendanceReport();
        }
    } catch { showToast('Error saving attendance', 'error'); }
}

