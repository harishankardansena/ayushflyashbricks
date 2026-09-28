// --- Global Fetch Override for Loading & Locks ---
const originalFetch = window.fetch;
window.fetch = async function(...args) {
  const url = args[0];
  const options = args[1] || {};
  const method = (options.method || 'GET').toUpperCase();
  
  if (['POST', 'PUT', 'DELETE'].includes(method)) {
    const loader = document.getElementById('global-loader');
    const btn = document.activeElement;
    const isButton = btn && (btn.tagName === 'BUTTON' || btn.type === 'submit');
    
    if (isButton) {
      btn.disabled = true;
      btn.dataset.originalText = btn.innerHTML;
      btn.innerHTML = 'Processing...';
    }
    if (loader) loader.classList.add('active');
    
    try {
      return await originalFetch.apply(this, args);
    } finally {
      if (isButton) {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.originalText;
      }
      if (loader) loader.classList.remove('active');
    }
  }
  return originalFetch.apply(this, args);
};

const EMP_API_URL = window.location.origin.includes('localhost') ? "http://localhost:5000/api" : "/api";
const API_BASE = EMP_API_URL;

// DOM Elements
const empLoginPage = document.getElementById("empLoginPage");
const empMainApp = document.getElementById("empMainApp");
const empLoginForm = document.getElementById("empLoginForm");
const empLoginError = document.getElementById("empLoginError");
const orderRequestForm = document.getElementById("orderRequestForm");

// State
let currentEmployee = JSON.parse(localStorage.getItem("currentEmployee"));
let empToken = localStorage.getItem("empToken");

// Initial check
function checkAuth() {
  if (empToken && currentEmployee) {
    empLoginPage.classList.add("hidden");
    empMainApp.classList.remove("hidden");

    // Set Sidebar info
    document.getElementById("empSidebarName").textContent =
      currentEmployee.name;
    document.getElementById("empSidebarAvatar").textContent =
      currentEmployee.name.charAt(0).toUpperCase();

    // Set Date in topbar
    const dateOpts = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    document.getElementById("empTopbarDate").textContent =
      new Date().toLocaleDateString("en-US", dateOpts);

    // Default page
    empNavigateTo("dashboard", document.querySelector(".nav-item.active"));
  } else {
    empLoginPage.classList.remove("hidden");
    empMainApp.classList.add("hidden");
  }
}

// Login
empLoginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const employeeId = document.getElementById("loginEmpId").value;
  const password = document.getElementById("loginEmpPass").value;

  try {
    const res = await fetch(`${API_BASE}/auth/employee/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employeeId, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Login failed");

    empToken = data.token;
    currentEmployee = data.employee;
    localStorage.setItem("empToken", empToken);
    localStorage.setItem("currentEmployee", JSON.stringify(currentEmployee));

    empLoginError.classList.add("hidden");
    checkAuth();
  } catch (err) {
    empLoginError.textContent = err.message;
    empLoginError.classList.remove("hidden");
  }
});

// Logout
window.empLogout = function () {
  localStorage.removeItem("empToken");
  localStorage.removeItem("currentEmployee");
  empToken = null;
  currentEmployee = null;
  checkAuth();
};

// Navigation
window.empNavigateTo = function (pageId, navElement) {
  // Update sidebar active state
  document
    .querySelectorAll(".emp-sidebar .nav-item")
    .forEach((el) => el.classList.remove("active"));
  if (navElement) navElement.classList.add("active");

  // Hide all pages
  document.querySelectorAll(".emp-main .page").forEach((page) => {
    page.classList.add("hidden");
    page.classList.remove("active");
  });

  // Show target page
  const targetPage = document.getElementById(`page-emp-${pageId}`);
  if (targetPage) {
    targetPage.classList.remove("hidden");
    targetPage.classList.add("active");

    // Set Page Title
    const titleMap = {
      dashboard: "Dashboard",
      quotas: "Quotas & Billing",
      requests: "My Requests",
      attendance: "My Attendance",
      payout: "My Payout",
      profile: "My Profile",
    };
    document.getElementById("empPageTitle").textContent =
      titleMap[pageId] || "Portal";
  }

  // Close sidebar on mobile
  document.getElementById("empSidebar").classList.remove("active");

  // Fetch specific data for pages
  if (pageId === "dashboard") loadDashboard();
  if (pageId === "requests") fetchMyRequests();
  if (pageId === "attendance") loadAttendance();
  if (pageId === "payout") loadPayout();
  if (pageId === "profile") loadProfile();
};

// ==========================================
// Dashboard Logic
// ==========================================
async function loadDashboard() {
  document.getElementById("empDashboardName").textContent =
    currentEmployee.name.split(" ")[0];
  if (!currentEmployee) return;

  try {
    const res = await fetch(
      `${API_BASE}/orders/employee/${currentEmployee.id}`,
      {
        headers: { Authorization: `Bearer ${empToken}` },
      },
    );
    if (res.ok) {
      const requests = await res.json();
      let activeCount = 0;
      let remainingBricks = 0;
      requests.forEach((r) => {
        if (r.status === "Accepted" && r.remainingValue > 0) {
          activeCount++;
          remainingBricks += r.remainingValue;
        }
      });
      document.getElementById("dashTotalQuotas").textContent = requests.length;
      document.getElementById("dashActiveQuotas").textContent = activeCount;
      document.getElementById("dashRemainingBricks").textContent =
        remainingBricks;
    }
  } catch (err) {
    console.error("Error loading dashboard stats:", err);
  }
}

// ==========================================
// Quotas & Billing Logic
// ==========================================
orderRequestForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const requestedValue = document.getElementById("reqValue").value;
  const notes = document.getElementById("reqNotes").value;

  try {
    const res = await fetch(`${API_BASE}/orders/request`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${empToken}`,
      },
      body: JSON.stringify({
        employeeId: currentEmployee.id,
        requestedValue,
        notes,
      }),
    });
    if (!res.ok) throw new Error("Failed to submit request");
    orderRequestForm.reset();
    alert("Request submitted successfully!");
    empNavigateTo("requests", document.querySelector(".nav-item:nth-child(3)")); // Go to requests tab
  } catch (err) {
    alert(err.message);
  }
});

async function fetchMyRequests() {
  if (!currentEmployee) return;
  try {
    const res = await fetch(
      `${API_BASE}/orders/employee/${currentEmployee.id}`,
      {
        headers: { Authorization: `Bearer ${empToken}` },
      },
    );
    if (!res.ok) throw new Error("Failed to fetch requests");
    const requests = await res.json();

    const tbody = document.querySelector("#empRequestsTable tbody");
    tbody.innerHTML = "";

    if (requests.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="6" style="text-align: center; color: rgba(255,255,255,0.5);">No requests found.</td></tr>';
      return;
    }

    requests.forEach((req) => {
      const statusColor =
        req.status === "Accepted"
          ? "#4CAF50"
          : req.status === "Rejected"
            ? "#F44336"
            : "#FF9800";

      let actionsHtml = "-";
      if (req.status === "Accepted" && req.remainingValue > 0) {
        actionsHtml = `
          <button class="btn-primary" style="padding: 4px 8px; font-size: 0.8rem; margin-right: 4px;" onclick="openBillingModal('${req._id}', ${req.remainingValue})">Generate Bill</button>
          <button class="btn-secondary" style="padding: 4px 8px; font-size: 0.8rem;" onclick="editQuota('${req._id}', ${req.remainingValue})">Edit Quota</button>
        `;
      }

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${new Date(req.createdAt).toLocaleDateString()}</td>
        <td>${req.requestedValue}</td>
        <td><span style="color: ${statusColor}; background: rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 12px; font-size: 0.85rem; font-weight: bold;">${req.status}</span></td>
        <td style="font-weight: bold; color: ${req.remainingValue > 0 ? "#6c63ff" : "white"};">${req.remainingValue}</td>
        <td style="color: rgba(255,255,255,0.7);">${req.notes || "-"}</td>
        <td>${actionsHtml}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

window.editQuota = async function (orderId, currentRemaining) {
  const newVal = prompt(
    `Edit remaining quota (current: ${currentRemaining}):`,
    currentRemaining,
  );
  if (newVal === null || newVal === "") return;
  const parsedVal = parseInt(newVal);
  if (isNaN(parsedVal) || parsedVal < 0) {
    return alert("Invalid quota amount");
  }

  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${empToken}`,
      },
      body: JSON.stringify({ remainingValue: parsedVal }),
    });
    if (!res.ok) throw new Error("Failed to update quota");
    alert("Quota updated successfully");
    fetchMyRequests();
    loadDashboard(); // update dash stats
  } catch (err) {
    alert(err.message);
  }
};

window.openBillingModal = function (orderId, remainingValue) {
  document.getElementById("empBillOrderId").value = orderId;
  document.getElementById("empBillingForm").reset();
  document.getElementById("empBillBricks").max = remainingValue;
  document.getElementById("empBillBricks").placeholder =
    `Max: ${remainingValue}`;
  document.getElementById("empBillingModal").classList.remove("hidden");
};

document
  .getElementById("empBillingForm")
  .addEventListener("submit", async (e) => {
    e.preventDefault();

    const orderRequestId = document.getElementById("empBillOrderId").value;
    const payload = {
      orderRequestId,
      customer: {
        name: document.getElementById("empBillCustomerName").value,
        phone: document.getElementById("empBillCustomerPhone").value,
        address: document.getElementById("empBillCustomerAddress").value,
      },
      bricks: parseInt(document.getElementById("empBillBricks").value),
      ratePerBrick: parseFloat(document.getElementById("empBillRate").value),
      workerCharge:
        parseFloat(document.getElementById("empBillWorker").value) || 0,
      transportCharge:
        parseFloat(document.getElementById("empBillTransport").value) || 0,
      paymentStatus:
        document.getElementById("empBillPaymentStatus").value || "Pending",
      amountPaid:
        parseFloat(document.getElementById("empBillAmountPaid").value) || 0,
    };

    try {
      const res = await fetch(`${API_BASE}/billing`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${empToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to generate bill");
      }

      alert("Bill request submitted for admin approval! Quota deducted.");
      document.getElementById("empBillingModal").classList.add("hidden");
      fetchMyRequests();
      loadDashboard();
    } catch (err) {
      alert(err.message);
    }
  });

// ==========================================
// Attendance & Payout
// ==========================================
async function loadAttendance() {
  if (!currentEmployee) return;
  try {
    const res = await fetch(
      `${API_BASE}/attendance/worker/${currentEmployee.id}`,
      {
        headers: { Authorization: `Bearer ${empToken}` },
      },
    );
    if (!res.ok) throw new Error("Failed to fetch attendance");
    const records = await res.json();

    const tbody = document.querySelector("#empAttendanceTable tbody");
    tbody.innerHTML = "";

    if (records.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="4" style="text-align: center; color: rgba(255,255,255,0.5);">No attendance records found.</td></tr>';
      return;
    }

    records.forEach((r) => {
      const tr = document.createElement("tr");
      const statColor =
        r.status === "Present"
          ? "#4CAF50"
          : r.status === "Half-Day"
            ? "#FF9800"
            : "#F44336";
      tr.innerHTML = `
        <td>${new Date(r.date).toLocaleDateString()}</td>
        <td><span style="color: ${statColor}; font-weight: bold;">${r.status}</span></td>
        <td>-</td>
        <td>-</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
  }
}

async function loadPayout() {
  if (!currentEmployee) return;
  try {
    const res = await fetch(
      `${API_BASE}/attendance/worker/${currentEmployee.id}`,
      {
        headers: { Authorization: `Bearer ${empToken}` },
      },
    );
    if (!res.ok) throw new Error("Failed to fetch payout details");
    const records = await res.json();

    const tbody = document.querySelector("#empPayoutTable tbody");
    tbody.innerHTML = "";

    if (records.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="3" style="text-align: center; color: rgba(255,255,255,0.5);">No payout records found.</td></tr>';
      return;
    }

    let totalPayout = 0;
    records.forEach((r) => {
      if (r.wageEarned) {
        totalPayout += r.wageEarned;
        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td>${new Date(r.date).toLocaleDateString()}</td>
          <td>Wage for ${r.status} (Overtime: ${r.overtimeHours || 0} hrs)</td>
          <td style="color: var(--success); font-weight: bold;">₹${r.wageEarned.toFixed(2)}</td>
        `;
        tbody.appendChild(tr);
      }
    });
    document.getElementById("empEstimatedPayout").textContent =
      `₹${totalPayout.toFixed(2)}`;
  } catch (err) {
    console.error(err);
  }
}

// ==========================================
// Profile Logic
// ==========================================
async function loadProfile() {
  if (!currentEmployee) return;
  try {
    const res = await fetch(`${API_BASE}/employees/${currentEmployee.id}`, {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    if (!res.ok) throw new Error("Failed to fetch profile");
    const profile = await res.json();

    document.getElementById("profName").textContent = profile.name;
    document.getElementById("profRole").textContent =
      `${profile.jobTitle || "Staff"} / ${profile.department || "Operations"}`;
    document.getElementById("profId").textContent = profile.employeeId;
    document.getElementById("profPhone").textContent = profile.phone || "N/A";
    document.getElementById("profEmail").textContent = profile.email || "N/A";
    document.getElementById("profSalary").textContent = profile.salary
      ? `₹${profile.salary} / month`
      : "N/A";

    if (profile.profilePictureUrl) {
      document.getElementById("profImage").src = profile.profilePictureUrl;
    }
  } catch (err) {
    console.error(err);
  }
}

// Start
checkAuth();
