const API_BASE = 'https://tambayan-cafe-backend.onrender.com/api';
const cardsConfig = [
  { key: 'totalOrders', title: 'Total Orders', icon: '<i class="ri-shopping-bag-line"></i>', color: '#2EC4B6', formatter: v => v.toLocaleString() },
  { key: 'totalRevenue', title: 'Total Revenue', icon: '<i class="ri-money-dollar-circle-line"></i>', color: '#FF9F1C', formatter: v => `₱${Number(v).toFixed(2)}` },
  { key: 'pendingOrders', title: 'Pending Orders', icon: '<i class="ri-time-line"></i>', color: '#2A9D8F', formatter: v => v.toLocaleString() },
  { key: 'lowStockAlerts', title: 'Low Stock Alerts', icon: '<i class="ri-alert-line"></i>', color: '#E76F51', formatter: v => v.toLocaleString() }
];
const overviewContainer = document.getElementById('overviewCards');
let allInventoryItems = [];
let allSuppliers = [];
let allMenuItems = [];
let allUsers = [];
let allCustomers = [];

function getAuthToken() {
  const userData = JSON.parse(localStorage.getItem('userData'));
  if (userData && (userData.role === 'admin' || userData.role === 'staff')) {
    return userData.id;
  }
  return null;
}

async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const userData = JSON.parse(localStorage.getItem('userData'));
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (userData && (userData.role === 'admin' || userData.role === 'staff')) {
    headers.Authorization = `Bearer ${userData.id}`;
  }
  const config = { ...options, headers };
  const res = await fetch(url, config);
  if (res.status === 401 || res.status === 403) {
    alert('Access denied. Please log in as admin or staff.');
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    let errorText = 'Unknown error';
    try {
      const errorJson = await res.json();
      errorText = errorJson.message || JSON.stringify(errorJson);
    } catch {
      errorText = await res.text() || `HTTP ${res.status}`;
    }
    throw new Error(`HTTP ${res.status}: ${errorText}`);
  }
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await res.json();
  } else {
    return { success: true };
  }
}

// ===== USER & CUSTOMER MANAGEMENT =====
async function loadUsers() {
  const el = document.getElementById('usersList');
  el.innerHTML = '<p>Loading users...</p>';
  try {
    const users = await apiCall('/admin/users');
    allUsers = Array.isArray(users) ? users : [];
    renderUsersList();
  } catch (err) {
    el.innerHTML = `<p style="color:#e74c3c;">Error: ${err.message}</p>`;
  }
}
async function loadCustomers() {
  const el = document.getElementById('customersList');
  el.innerHTML = '<p>Loading customers...</p>';
  try {
    const customers = await apiCall('/admin/customers');
    allCustomers = Array.isArray(customers) ? customers : [];
    renderCustomersList();
  } catch (err) {
    el.innerHTML = `<p style="color:#e74c3c;">Error: ${err.message}</p>`;
  }
}
function renderUsersList(searchTerm = '') {
  const container = document.getElementById('usersList');
  let filtered = allUsers;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(u =>
      u.name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term)
    );
  }
  filtered = filtered.filter(u => u.role === 'admin' || u.role === 'staff');
  if (filtered.length === 0) {
    container.innerHTML = '<p>No users found.</p>';
    return;
  }
  let html = '';
  filtered.forEach(user => {
    const roleClass = user.role === 'admin' ? 'admin' : 'staff';
    const roleText = user.role.charAt(0).toUpperCase() + user.role.slice(1);
    const roleBadge = `<span class="role-badge ${roleClass}">${roleText}</span>`;
    const statusIcon = user.isActive
      ? '<i class="ri-checkbox-circle-fill" style="color:#2ecc71;"></i> Active'
      : '<i class="ri-close-circle-fill" style="color:#e74c3c;"></i> Inactive';
    html += `
      <div class="menu-item">
        <div>
          <strong>${user.name || '—'}</strong><br>
          ${user.email} | ${roleBadge}<br>
          Status: ${statusIcon}
        </div>
        <div class="menu-actions">
          <button class="edit-user-btn" data-id="${user.id}"><i class="ri-edit-line"></i></button>
          <button class="delete-user-btn" data-id="${user.id}" data-name="${user.name}"><i class="ri-delete-bin-line"></i></button>
          <button class="reset-pw-btn" data-id="${user.id}"><i class="ri-key-line"></i></button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
  document.querySelectorAll('.edit-user-btn').forEach(btn => 
    btn.addEventListener('click', openEditUserModal)
  );
  document.querySelectorAll('.delete-user-btn').forEach(btn => 
    btn.addEventListener('click', openDeleteUserConfirm)
  );
  document.querySelectorAll('.reset-pw-btn').forEach(btn => 
    btn.addEventListener('click', resetUserPassword)
  );
}
function renderCustomersList(searchTerm = '') {
  const container = document.getElementById('customersList');
  let filtered = allCustomers;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(c =>
      c.name?.toLowerCase().includes(term) ||
      c.email?.toLowerCase().includes(term)
    );
  }
  filtered = filtered.filter(c => c.role === 'customer');
  if (filtered.length === 0) {
    container.innerHTML = '<p>No customers found.</p>';
    return;
  }
  let html = '';
  filtered.forEach(cust => {
    const statusIcon = cust.isActive
      ? '<i class="ri-checkbox-circle-fill" style="color:#2ecc71;"></i> Active'
      : '<i class="ri-close-circle-fill" style="color:#e74c3c;"></i> Inactive';
    html += `
      <div class="menu-item">
        <div>
          <strong>${cust.name || '—'}</strong><br>
          ${cust.email}<br>
          Orders: ${cust.orderCount || 0}
        </div>
        <div class="menu-actions">
          <button class="view-orders-btn" data-id="${cust.id}"><i class="ri-file-list-3-line"></i></button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
  document.querySelectorAll('.view-orders-btn').forEach(btn =>
    btn.addEventListener('click', () => viewCustomerOrders(btn.dataset.id))
  );
}
async function resetUserPassword(e) {
  const userId = e.target.closest('.reset-pw-btn').dataset.id;
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  if (!confirm(`Send password reset to ${user.email}?`)) return;
  try {
    await apiCall(`/admin/users/${userId}/reset-password`, { method: 'POST' });
    alert('Password reset email sent!');
  } catch (err) {
    alert('Failed to send reset: ' + err.message);
  }
}
function openAddUserModal() {
  document.getElementById('addUserModal').classList.remove('hidden');
}
async function handleAddUserSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('newUserName').value.trim();
  const email = document.getElementById('newUserEmail').value.trim();
  const role = document.getElementById('newUserRole').value;
  if (!name || !email || !['admin', 'staff'].includes(role)) {
    alert('Please fill in all fields correctly.');
    return;
  }
  function generateUsername(fullName) {
    const parts = fullName.trim().toLowerCase().split(/\s+/);
    const first = parts[0] || 'user';
    const last = parts.length > 1 ? parts[parts.length - 1] : '';
    let base = (first + (last ? last.substring(0, 3) : '')).substring(0, 6) || 'user';
    return base;
  }
  function generateStrongPassword() {
    const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lower = 'abcdefghijklmnopqrstuvwxyz';
    const digits = '0123456789';
    const symbols = '!@#$%^&*';
    const all = upper + lower + digits + symbols;
    let password = '';
    password += upper[Math.floor(Math.random() * upper.length)];
    password += lower[Math.floor(Math.random() * lower.length)];
    password += digits[Math.floor(Math.random() * digits.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    for (let i = 4; i < 12; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }
    return password
      .split('')
      .sort(() => 0.5 - Math.random())
      .join('');
  }
  const username = generateUsername(name);
  const password = generateStrongPassword();
  const formData = {
    name,
    email,
    role,
    username,
    password,
    isActive: true
  };
  try {
    await apiCall('/user/admin/users', { method: 'POST', body: JSON.stringify(formData) });
    alert('User added successfully! A welcome email with login instructions has been sent.');
    document.getElementById('addUserForm').reset();
    closeAddUserModal();
    loadUsers();
  } catch (err) {
    alert('Failed to add user: ' + err.message);
  }
}
function openEditUserModal(e) {
  const btn = e.target.closest('.edit-user-btn');
  const userId = btn.dataset.id;
  const user = allUsers.find(u => u.id === userId);
  if (!user) return;
  document.getElementById('editUserId').value = user.id;
  document.getElementById('editUserName').value = user.name;
  document.getElementById('editUserEmail').value = user.email;
  document.getElementById('editUserRole').value = user.role;
  document.getElementById('editUserActive').checked = user.isActive;
  document.getElementById('editUserModal').classList.remove('hidden');
}
async function handleEditUserSubmit(e) {
  e.preventDefault();
  const updated = {
    name: document.getElementById('editUserName').value.trim(),
    email: document.getElementById('editUserEmail').value.trim(),
    role: document.getElementById('editUserRole').value,
    isActive: document.getElementById('editUserActive').checked
  };
  const id = document.getElementById('editUserId').value;
  try {
    await apiCall(`/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(updated) });
    alert('User updated!');
    closeEditUserModal();
    loadUsers();
  } catch (err) {
    alert('Update failed: ' + err.message);
  }
}
function openDeleteUserConfirm(e) {
  const btn = e.target.closest('.delete-user-btn');
  document.getElementById('deleteUserId').value = btn.dataset.id;
  document.getElementById('deleteUserName').textContent = btn.dataset.name;
  document.getElementById('deleteUserConfirmModal').classList.remove('hidden');
}
async function handleDeleteUserConfirm() {
  const id = document.getElementById('deleteUserId').value;
  try {
    await apiCall(`/admin/users/${id}`, { method: 'DELETE' });
    alert('User deleted!');
    closeDeleteUserModal();
    loadUsers();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}
function viewCustomerOrders(id) {
  alert(`Order history for customer ID ${id} will appear here once implemented.`);
}
function closeAddUserModal() {
  document.getElementById('addUserModal').classList.add('hidden');
}
function closeEditUserModal() {
  document.getElementById('editUserModal').classList.add('hidden');
}
function closeDeleteUserModal() {
  document.getElementById('deleteUserConfirmModal').classList.add('hidden');
}

// ===== REPORTS, INVENTORY, ETC. (UNCHANGED) =====
async function loadReportHistory() {
  const el = document.getElementById('reportHistoryList');
  el.innerHTML = '<p>Loading...</p>';
  try {
    const history = await apiCall('/admin/reports/history');
    if (!Array.isArray(history) || history.length === 0) {
      el.innerHTML = '<p>No report history.</p>';
      return;
    }
    let html = '';
    history.forEach(rep => {
      html += `
        <div class="report-history-item">
          <div class="history-meta">
            <span>${rep.title}</span>
            <span>${new Date(rep.generatedAt).toLocaleDateString()}</span>
          </div>
          <div class="history-actions">
            Type: ${rep.type} | Format: ${rep.format}
          </div>
        </div>
      `;
    });
    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<p style="color:#e74c3c;">Error loading history: ${err.message}</p>`;
  }
}
function generateCSV(data, headers) {
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(h => {
        const val = row[h] ?? '';
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentReportTitle.replace(/\s+/g, '_')}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function generatePDF(data, headers, title) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(title, 14, 20);
  const tableData = data.map(row =>
    headers.map(h => row[h] ?? '')
  );
  doc.autoTable({
    head: [headers],
    body: tableData,
    startY: 30,
    theme: 'grid',
    styles: { fontSize: 10 },
    headStyles: { fillColor: [107, 74, 58] }
  });
  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}
let currentReportData = null;
let currentReportTitle = '';
async function generateReport() {
  const type = document.getElementById('reportType').value;
  const startDate = document.getElementById('startDate').value;
  const endDate = document.getElementById('endDate').value;
  const output = document.getElementById('reportOutput');
  const tableContainer = document.getElementById('reportTableContainer');
  const reportTitleEl = document.getElementById('reportTitle');
  output.style.display = 'block';
  tableContainer.innerHTML = '<p>Generating report...</p>';
  try {
    let data, headers, title;
    if (type === 'sales') {
      const payload = startDate && endDate ? { startDate, endDate } : {};
      const res = await apiCall('/admin/reports/sales-report', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      data = res.sales || [];
      headers = ['date', 'orderId', 'items', 'totalAmount', 'status'];
      title = startDate && endDate 
        ? `Sales Report (${startDate} to ${endDate})`
        : 'Sales Report (All Time)';
    } else if (type === 'inventory') {
      const res = await apiCall('/admin/reports/inventory-report');
      data = res.inventory || [];
      headers = ['name', 'category', 'currentStock', 'unit', 'reorderLevel'];
      title = 'Inventory Report';
    }
    currentReportData = data;
    currentReportTitle = title;
    reportTitleEl.textContent = title;
    await apiCall('/admin/reports/history', {
      method: 'POST',
      body: JSON.stringify({ 
        type, 
        title, 
        format: 'generated',
        generatedAt: new Date().toISOString()
      })
    });
    if (data.length === 0) {
      tableContainer.innerHTML = '<p>No data available for this report.</p>';
      return;
    }
    let tableHTML = `<table class="report-table"><thead><tr>`;
    headers.forEach(h => {
      tableHTML += `<th>${h.charAt(0).toUpperCase() + h.slice(1)}</th>`;
    });
    tableHTML += `</tr></thead><tbody>`;
    data.forEach(row => {
      tableHTML += '<tr>';
      headers.forEach(h => {
        let cell = row[h] ?? '—';
        if (h === 'totalAmount') cell = `₱${Number(cell).toFixed(2)}`;
        if (h === 'items' && Array.isArray(cell)) cell = cell.map(i => i.name).join(', ');
        tableHTML += `<td>${cell}</td>`;
      });
      tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';
    tableContainer.innerHTML = tableHTML;
    document.getElementById('exportCSV').onclick = () => {
      generateCSV(data, headers);
      apiCall('/admin/reports/history', {
        method: 'POST',
        body: JSON.stringify({ 
          type, 
          title, 
          format: 'CSV',
          generatedAt: new Date().toISOString()
        })
      });
    };
    document.getElementById('exportPDF').onclick = () => {
      generatePDF(data, headers, title);
      apiCall('/admin/reports/history', {
        method: 'POST',
        body: JSON.stringify({ 
          type, 
          title, 
          format: 'PDF',
          generatedAt: new Date().toISOString()
        })
      });
    };
    loadReportHistory(); 
  } catch (err) {
    console.error('Report generation failed:', err);
    tableContainer.innerHTML = `<p style="color:#e74c3c;">Error: ${err.message}</p>`;
  }
}
async function loadDetailedTopSelling() {
  const el = document.getElementById('detailedTopSellingList');
  el.innerHTML = '<p>Loading...</p>';
  try {
    const items = await apiCall('/admin/top-selling-detailed');
    if (!Array.isArray(items) || items.length === 0) {
      el.innerHTML = '<p>No detailed sales data.</p>';
      return;
    }
    let html = '<ul style="padding-left:20px;">';
    items.forEach(item => {
      html += `
        <li style="margin-bottom:12px;">
          <strong>${item.name}</strong><br>
          Sold: ${item.quantitySold} units | Revenue: ₱${Number(item.totalRevenue).toFixed(2)}<br>
          ${item.avgRating ? `Avg. Rating: ${item.avgRating.toFixed(1)} ⭐` : ''}
        </li>
      `;
    });
    html += '</ul>';
    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<p style="color:#e74c3c;">Error: ${err.message}</p>`;
  }
}
async function loadCustomerInsights() {
  const el = document.getElementById('customerInsights');
  el.innerHTML = '<p>Loading...</p>';
  try {
    const data = await apiCall('/admin/customer-insights');
    el.innerHTML = `
      <p><strong>New Customers:</strong> ${data.newCustomers || 0}</p>
      <p><strong>Repeat Customers:</strong> ${data.repeatCustomers || 0}</p>
      <p><strong>Retention Rate:</strong> ${(data.retentionRate ? (data.retentionRate * 100).toFixed(1) : '0.0')}%</p>
    `;
  } catch (err) {
    el.innerHTML = `<p style="color:#e74c3c;">Error: ${err.message}</p>`;
  }
}
async function loadExpenses() {
  const el = document.getElementById('expenseTracker');
  el.innerHTML = '<p>Loading...</p>';
  try {
    const expenses = await apiCall('/admin/expenses');
    if (!Array.isArray(expenses) || expenses.length === 0) {
      el.innerHTML = '<p>No recorded expenses.</p>';
      return;
    }
    let total = 0;
    let html = '<ul style="padding-left:20px;">';
    expenses.forEach(e => {
      total += e.amount;
      html += `<li>${e.description || 'N/A'}: ₱${Number(e.amount).toFixed(2)} on ${new Date(e.date).toLocaleDateString()}</li>`;
    });
    html += `</ul><p><strong>Total Expenses:</strong> ₱${total.toFixed(2)}</p>`;
    el.innerHTML = html;
  } catch (err) {
    el.innerHTML = `<p style="color:#e74c3c;">Error: ${err.message}</p>`;
  }
}
async function loadProfitLossReport() {
  const el = document.getElementById('profitLossReport');
  el.innerHTML = '<p>Loading...</p>';
  try {
    const report = await apiCall('/admin/profit-loss');
    el.innerHTML = `
      <p><strong>Total Revenue:</strong> ₱${Number(report.totalRevenue || 0).toFixed(2)}</p>
      <p><strong>Total Expenses:</strong> ₱${Number(report.totalExpenses || 0).toFixed(2)}</p>
      <p><strong>Net Profit:</strong> 
        <span style="color:${(report.netProfit || 0) >= 0 ? '#2ECC71' : '#E74C3C'}">
          ₱${Number(report.netProfit || 0).toFixed(2)}
        </span>
      </p>
      <p><strong>Profit Margin:</strong> ${(report.profitMargin ? (report.profitMargin * 100).toFixed(1) : '0.0')}%</p>
    `;
  } catch (err) {
    el.innerHTML = `<p style="color:#e74c3c;">Error: ${err.message}</p>`;
  }
}
async function loadTopSellingItems() {
  const container = document.getElementById('topSellingList');
  container.innerHTML = '<p>Loading top sellers...</p>';
  try {
    const items = await apiCall('/admin/top-selling');
    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = '<p>No sales data yet.</p>';
      return;
    }
    let html = '';
    items.slice(0, 5).forEach(item => {
      html += `
        <div class="item-row">
          <div class="item-info">${item.name}</div>
          <div class="item-quantity">${item.quantitySold} sold</div>
        </div>
      `;
    });
    container.innerHTML = html;
  } catch (err) {
    console.error('Failed to load top-selling items:', err);
    container.innerHTML = '<p style="color: #e74c3c;">Failed to load top sellers.</p>';
  }
}
async function loadDashboardData() {
  overviewContainer.innerHTML = '<p>Loading...</p>';
  try {
    const data = await apiCall('/admin/dashboard');
    renderOverviewCards(data);
  } catch (err) {
    console.error('Dashboard load error:', err);
    overviewContainer.innerHTML = `<p class="no-data">Error loading dashboard: ${err.message}</p>`;
  }
}
function renderOverviewCards(data) {
  overviewContainer.innerHTML = '';
  cardsConfig.forEach(cfg => {
    const val = data[cfg.key];
    if (typeof val === 'number' && !isNaN(val)) {
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <div class="card-header">
          <div class="card-icon" style="background:${cfg.color};">${cfg.icon}</div>
          <span>${cfg.title}</span>
        </div>
        <div class="card-value">${cfg.formatter(val)}</div>
      `;
      overviewContainer.appendChild(card);
    }
  });
}
async function loadInventoryItems() {
  const container = document.getElementById('inventoryList');
  container.innerHTML = '<p>Loading inventory...</p>';
  try {
    const items = await apiCall('/admin/inventory');
    if (!Array.isArray(items)) {
      container.innerHTML = '<p style="color:red;">Invalid inventory data.</p>';
      return;
    }
    allInventoryItems = items;
    renderInventoryList();
  } catch (err) {
    console.error('Inventory load error:', err);
    container.innerHTML = '<p style="color:red;">Failed to load inventory.</p>';
  }
}
function renderInventoryList(searchTerm = '') {
  const container = document.getElementById('inventoryList');
  let filtered = allInventoryItems;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(item =>
      item.name.toLowerCase().includes(term) ||
      (item.category && item.category.toLowerCase().includes(term))
    );
  }
  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#777;">No inventory items.</p>';
    return;
  }
  let html = '';
  filtered.forEach(item => {
    const isLow = (item.currentStock || 0) <= (item.reorderLevel || 10);
    html += `
      <div class="inventory-item">
        <div class="inventory-info">
          <div class="inventory-name">${item.name}</div>
          <div>Category: ${item.category || 'N/A'}</div>
          <div>Unit: ${item.unit || 'pcs'}</div>
        </div>
        <div style="text-align: right;">
          <div>Stock: <strong>${item.currentStock || 0}</strong></div>
          <div>Reorder at: ${item.reorderLevel || 10}</div>
          ${isLow ? '<div class="low-stock"><i class="ri-alert-line" style="color:#e74c3c;"></i> LOW STOCK</div>' : ''}
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}
async function loadSuppliers() {
  const container = document.getElementById('suppliersList');
  container.innerHTML = '<p>Loading suppliers...</p>';
  try {
    const suppliers = await apiCall('/admin/suppliers');
    if (!Array.isArray(suppliers)) {
      container.innerHTML = '<p style="color:red;">Invalid supplier data.</p>';
      return;
    }
    allSuppliers = suppliers;
    renderSuppliersList();
  } catch (err) {
    console.error('Suppliers load error:', err);
    container.innerHTML = '<p style="color:red;">Failed to load suppliers.</p>';
  }
}
function renderSuppliersList() {
  const container = document.getElementById('suppliersList');
  if (allSuppliers.length === 0) {
    container.innerHTML = '<p>No suppliers added yet.</p>';
    return;
  }
  let html = '';
  allSuppliers.forEach(s => {
    html += `
      <div class="supplier-card">
        <div class="supplier-name">${s.name}</div>
        <div class="supplier-contact">Contact: ${s.contactPerson || 'N/A'}</div>
        <div class="supplier-email">Email: ${s.email || 'N/A'}</div>
        <div class="supplier-phone">Phone: ${s.phone || 'N/A'}</div>
        <div>Address: ${s.address || 'N/A'}</div>
      </div>
    `;
  });
  container.innerHTML = html;
}

// ===== MENU MANAGEMENT =====
function renderMenuList(searchTerm = '', category = 'all') {
  const container = document.getElementById('menuListContainer');
  let filtered = allMenuItems;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(item =>
      item.name.toLowerCase().includes(term) ||
      (item.category && item.category.toLowerCase().includes(term))
    );
  }
  if (category !== 'all') {
    filtered = filtered.filter(item =>
      item.category && item.category.toLowerCase() === category.toLowerCase()
    );
  }
  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#777;">No items found.</p>';
    return;
  }
  let html = '';
  filtered.forEach(item => {
    let isAvailable = item.isAvailable;
    if (item.ingredients && item.ingredients.length > 0) {
      for (const ing of item.ingredients) {
        const invItem = allInventoryItems.find(i => i.id === ing.inventoryItemId);
        if (!invItem || invItem.currentStock < ing.quantityRequired) {
          isAvailable = false;
          break;
        }
      }
    }
    const statusText = isAvailable ? '' : '<span style="color:#e74c3c; font-size:0.85rem;">(Unavailable)</span>';
    const ingredientCount = item.ingredients?.length || 0;

    // 👇 ADD IMAGE DISPLAY
    const imgSrc = item.imageUrl 
      ? item.imageUrl 
      : '/image/placeholder.jpg'; // fallback image

    html += `
      <div class="menu-item" data-available="${isAvailable}">
        <img src="${imgSrc}" class="menu-item-image" alt="${item.name}" />
        <div>
          <strong>${item.name}</strong> ${statusText}<br>
          ₱${(item.price ?? 0).toFixed(2)} | Stock: ${item.stockQuantity ?? 0}
          <br><small>Category: ${item.category || 'N/A'}</small>
          ${ingredientCount > 0 ? `<br><small>Requires ${ingredientCount} ingredient${ingredientCount > 1 ? 's' : ''}</small>` : ''}
        </div>
        <div class="menu-actions">
          <button class="edit-btn" 
            data-id="${item.id}" 
            data-name="${item.name}" 
            data-price="${item.price}" 
            data-stock="${item.stockQuantity}" 
            data-category="${item.category || ''}"
            data-image-url="${item.imageUrl || ''}"><i class="ri-edit-line"></i></button>
          <button class="delete-btn" 
            data-id="${item.id}" 
            data-name="${item.name}"><i class="ri-delete-bin-line"></i></button>
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
  document.querySelectorAll('.edit-btn').forEach(btn => 
    btn.addEventListener('click', openEditModal)
  );
  document.querySelectorAll('.delete-btn').forEach(btn => 
    btn.addEventListener('click', openDeleteConfirm)
  );
}

async function loadMenuItems() {
  const container = document.getElementById('menuListContainer');
  container.innerHTML = '<p>Loading menu...</p>';
  try {
    const items = await apiCall('/admin/menu');
    if (!Array.isArray(items)) {
      container.innerHTML = '<p style="color:red;">Invalid menu data.</p>';
      return;
    }
    allMenuItems = items;
    renderMenuList();
  } catch (err) {
    console.error('Menu load error:', err);
    container.innerHTML = '<p style="color:red;">Failed to load menu.</p>';
  }
}
async function loadAndRenderIngredients(menuItemId) {
  const listContainer = document.getElementById('ingredientList');
  const select = document.getElementById('addIngredientSelect');
  const qtyInput = document.getElementById('addIngredientQty');
  const addButton = document.getElementById('addIngredientBtn');
  if (!listContainer || !select || !qtyInput || !addButton) {
    console.warn('Missing ingredient UI elements in edit modal');
    return;
  }
  try {
    const ingredients = await apiCall(`/admin/menu/${menuItemId}/ingredients`);
    if (ingredients.length === 0) {
      listContainer.innerHTML = '<p style="color:#777; font-size:0.9rem;">No ingredients linked.</p>';
    } else {
      let html = '';
      ingredients.forEach(ing => {
        const invItem = allInventoryItems.find(i => i.id === ing.inventoryItemId);
        const name = invItem ? invItem.name : `Unknown (${ing.inventoryItemId})`;
        html += `
          <div class="ingredient-row" style="display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #eee;">
            <span>${name}: ${ing.quantityRequired} ${ing.unit || 'pcs'}</span>
            <button class="remove-ingredient-btn" data-id="${ing.inventoryItemId}" style="background:#e74c3c; color:white; border:none; border-radius:4px; width:24px; height:24px; font-size:0.8rem; cursor:pointer;">×</button>
          </div>
        `;
      });
      listContainer.innerHTML = html;
      document.querySelectorAll('.remove-ingredient-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const updatedIngredients = ingredients.filter(ing => ing.inventoryItemId !== btn.dataset.id);
          await saveIngredientsForMenuItem(menuItemId, updatedIngredients);
          loadAndRenderIngredients(menuItemId);
        });
      });
    }
    select.innerHTML = '<option value="">Select ingredient...</option>';
    allInventoryItems.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `${item.name} (${item.currentStock} ${item.unit || 'pcs'})`;
      select.appendChild(opt);
    });
    const clone = addButton.cloneNode(true);
    addButton.parentNode.replaceChild(clone, addButton);
    clone.addEventListener('click', async () => {
      const inventoryItemId = select.value;
      const quantityRequired = parseFloat(qtyInput.value);
      if (!inventoryItemId) {
        alert('Please select an ingredient.');
        return;
      }
      if (isNaN(quantityRequired) || quantityRequired <= 0) {
        alert('Please enter a valid quantity (> 0).');
        return;
      }
      if (ingredients.some(ing => ing.inventoryItemId === inventoryItemId)) {
        alert('This ingredient is already added.');
        return;
      }
      const updated = [
        ...ingredients,
        {
          inventoryItemId,
          quantityRequired,
          unit: allInventoryItems.find(i => i.id === inventoryItemId)?.unit || 'pcs'
        }
      ];
      try {
        await saveIngredientsForMenuItem(menuItemId, updated);
        loadAndRenderIngredients(menuItemId);
        qtyInput.value = '';
      } catch (err) {
        console.error('Add ingredient failed:', err);
        alert('Failed to add ingredient: ' + err.message);
      }
    });
  } catch (err) {
    console.error('Failed to load ingredients:', err);
    listContainer.innerHTML = '<p style="color:#e74c3c;">Failed to load ingredients.</p>';
  }
}
async function saveIngredientsForMenuItem(menuItemId, ingredients) {
  try {
    await apiCall(`/admin/menu/${menuItemId}/ingredients`, {
      method: 'PUT',
      body: JSON.stringify(ingredients)
    });
  } catch (err) {
    console.error('Failed to save ingredients:', err);
    alert('Failed to update ingredients: ' + err.message);
    throw err;
  }
}
function openEditModal(e) {
  const btn = e.target.closest('.edit-btn');
  const menuItem = btn.closest('.menu-item');
  const id = btn.dataset.id;
  document.getElementById('editItemId').value = id;
  document.getElementById('editItemName').value = btn.dataset.name;
  document.getElementById('editItemPrice').value = btn.dataset.price;
  document.getElementById('editItemStock').value = btn.dataset.stock;
  document.getElementById('editItemCategory').value = btn.dataset.category || 'Drinks';
  const isAvailable = menuItem.dataset.available === 'true';
  document.getElementById('editItemAvailable').checked = isAvailable;
  // 👇 SET IMAGE URL
  document.getElementById('editItemImageUrl').value = btn.dataset.imageUrl || '';
  loadAndRenderIngredients(id);
  document.getElementById('editMenuItemModal').classList.remove('hidden');
}
function openDeleteConfirm(e) {
  const btn = e.target.closest('.delete-btn');
  document.getElementById('deleteItemId').value = btn.dataset.id;
  document.getElementById('deleteItemName').textContent = btn.dataset.name;
  document.getElementById('deleteConfirmModal').classList.remove('hidden');
}
async function handleEditSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editItemId').value;
  const updated = {
    name: document.getElementById('editItemName').value.trim(),
    category: document.getElementById('editItemCategory').value,
    price: parseFloat(document.getElementById('editItemPrice').value),
    stockQuantity: parseInt(document.getElementById('editItemStock').value),
    isAvailable: document.getElementById('editItemAvailable').checked,
    imageUrl: document.getElementById('editItemImageUrl').value.trim() || null // 👈 ADDED
  };
  if (!updated.name || isNaN(updated.price) || updated.price < 0 || isNaN(updated.stockQuantity) || updated.stockQuantity < 0) {
    alert('Please enter valid name, price (≥0), and stock (≥0).');
    return;
  }
  try {
    await apiCall(`/admin/menu/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updated)
    });
    const ingredientRows = document.querySelectorAll('#ingredientList .ingredient-row');
    const currentIngredients = [];
    ingredientRows.forEach(row => {
      const removeBtn = row.querySelector('.remove-ingredient-btn');
      const text = row.querySelector('span').textContent;
      const match = text.match(/^(.+?):\s*(\d+(?:\.\d+)?)\s*(.+?)$/);
      if (match && removeBtn) {
        const [, name, qty, unit] = match;
        const inventoryItemId = removeBtn.dataset.id;
        currentIngredients.push({
          inventoryItemId,
          quantityRequired: parseFloat(qty),
          unit: unit.trim()
        });
      }
    });
    await saveIngredientsForMenuItem(id, currentIngredients);
    alert('Item updated successfully!');
    closeEditModal();
    loadDashboardData();
    loadMenuItems();
    loadTopSellingItems();
  } catch (err) {
    console.error('Edit error:', err);
    alert('Update failed: ' + err.message);
  }
}
async function handleDeleteConfirm() {
  const id = document.getElementById('deleteItemId').value;
  try {
    await apiCall(`/admin/menu/${id}`, { method: 'DELETE' });
    alert('Item deleted successfully!');
    closeDeleteModal();
    loadDashboardData();
    loadMenuItems();
    loadTopSellingItems();
  } catch (err) {
    console.error('Delete error:', err);
    alert('Delete failed: ' + err.message);
  }
}
async function handleAddSubmit(e) {
  e.preventDefault();
  const newItem = {
    name: document.getElementById('itemName').value.trim(),
    category: document.getElementById('itemCategory').value,
    price: parseFloat(document.getElementById('itemPrice').value),
    stockQuantity: parseInt(document.getElementById('itemStock').value),
    isAvailable: document.getElementById('itemAvailable').checked,
    imageUrl: document.getElementById('itemImageUrl').value.trim() || null, // 👈 ADDED
    ingredients: []
  };
  if (!newItem.name || isNaN(newItem.price) || newItem.price < 0 || isNaN(newItem.stockQuantity) || newItem.stockQuantity < 0) {
    alert('Please enter valid name, price (≥0), and stock (≥0).');
    return;
  }
  try {
    await apiCall('/admin/menu', {
      method: 'POST',
      body: JSON.stringify(newItem)
    });
    alert('Item added successfully!');
    document.getElementById('addMenuItemForm').reset();
    document.getElementById('itemAvailable').checked = true;
    closeAddModal();
    loadDashboardData();
    loadMenuItems();
    loadTopSellingItems();
  } catch (err) {
    console.error('Add error:', err);
    alert('Add failed: ' + err.message);
  }
}
function closeEditModal() {
  document.getElementById('editMenuItemModal').classList.add('hidden');
}
function closeDeleteModal() {
  document.getElementById('deleteConfirmModal').classList.add('hidden');
}
function closeAddModal() {
  document.getElementById('addMenuItemModal').classList.add('hidden');
}
function openAddInventoryModal() {
  document.getElementById('addInventoryItemModal').classList.remove('hidden');
}
function closeAddInventoryModal() {
  document.getElementById('addInventoryItemModal').classList.add('hidden');
}
async function handleAddInventorySubmit(e) {
  e.preventDefault();
  const newItem = {
    name: document.getElementById('invName').value.trim(),
    category: document.getElementById('invCategory').value.trim() || 'N/A',
    unit: document.getElementById('invUnit').value.trim() || 'pcs',
    currentStock: parseInt(document.getElementById('invStock').value) || 0,
    reorderLevel: parseInt(document.getElementById('invReorder').value) || 10
  };
  if (!newItem.name) {
    alert('Ingredient name is required.');
    return;
  }
  try {
    await apiCall('/admin/inventory', {
      method: 'POST',
      body: JSON.stringify(newItem)
    });
    alert('Ingredient added successfully!');
    document.getElementById('addInventoryItemForm').reset();
    closeAddInventoryModal();
    loadInventoryItems();
  } catch (err) {
    console.error('Add inventory error:', err);
    alert('Failed to add ingredient: ' + err.message);
  }
}
function openAddSupplierModal() {
  document.getElementById('supplierModal').classList.remove('hidden');
}
function closeSupplierModal() {
  document.getElementById('supplierModal').classList.add('hidden');
}
async function handleSupplierSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('supplierId').value;
  const supplierData = {
    name: document.getElementById('supplierName').value.trim(),
    contactPerson: document.getElementById('supplierContact').value.trim(),
    email: document.getElementById('supplierEmail').value.trim(),
    phone: document.getElementById('supplierPhone').value.trim(),
    address: document.getElementById('supplierAddress').value.trim()
  };
  if (!supplierData.name || !supplierData.email) {
    alert('Please fill in required fields.');
    return;
  }
  try {
    if (id) {
      await apiCall(`/admin/suppliers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(supplierData)
      });
      alert('Supplier updated!');
    } else {
      await apiCall('/admin/suppliers', {
        method: 'POST',
        body: JSON.stringify(supplierData)
      });
      alert('Supplier added!');
    }
    closeSupplierModal();
    loadSuppliers();
  } catch (err) {
    console.error('Supplier save error:', err);
    alert('Failed to save supplier: ' + err.message);
  }
}
function highlightNavItem(id) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
}
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('userData');
    window.location.href = '/login';
  });
  document.getElementById('nav-dashboard')?.addEventListener('click', () => {
    showView('dashboardView');
    highlightNavItem('nav-dashboard');
  });
  document.getElementById('nav-sales-analytics')?.addEventListener('click', async () => {
    showView('salesAnalyticsView');
    highlightNavItem('nav-sales-analytics');
    await loadDetailedTopSelling();
    await loadCustomerInsights();
    await loadExpenses();
    await loadProfitLossReport();
  });
  document.getElementById('nav-menu-management')?.addEventListener('click', async () => {
    showView('menuManagementView');
    highlightNavItem('nav-menu-management');
    await loadMenuItems();
  });
  document.getElementById('nav-inventory-management')?.addEventListener('click', async () => {
    showView('inventoryManagementView');
    highlightNavItem('nav-inventory-management');
    await loadInventoryItems();
    await loadSuppliers();
  });
  document.getElementById('nav-reports')?.addEventListener('click', async () => {
    showView('reportsView');
    highlightNavItem('nav-reports');
    loadReportHistory();
    const today = new Date();
    const lastMonth = new Date();
    lastMonth.setDate(today.getDate() - 30);
    document.getElementById('startDate').valueAsDate = lastMonth;
    document.getElementById('endDate').valueAsDate = today;
  });
  document.getElementById('nav-user-management')?.addEventListener('click', async () => {
    showView('userManagementView');
    highlightNavItem('nav-user-management');
    await loadUsers();
    await loadCustomers();
    document.querySelectorAll('#userManagementView .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#userManagementView .tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('#userManagementView .tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        if (tab === 'admins-staff') {
          document.getElementById('adminsStaffTab').classList.add('active');
        } else {
          document.getElementById('customersTab').classList.add('active');
        }
      });
    });
    document.getElementById('userSearch')?.addEventListener('input', e => renderUsersList(e.target.value));
    document.getElementById('customerSearch')?.addEventListener('input', e => renderCustomersList(e.target.value));
    document.getElementById('addUserBtn')?.addEventListener('click', openAddUserModal);
  });
  document.getElementById('generateReportBtn')?.addEventListener('click', generateReport);
  document.getElementById('addItemBtn')?.addEventListener('click', () => {
    document.getElementById('addMenuItemModal').classList.remove('hidden');
  });
  document.getElementById('editMenuItemForm')?.addEventListener('submit', handleEditSubmit);
  document.getElementById('confirmDelete')?.addEventListener('click', handleDeleteConfirm);
  document.getElementById('addMenuItemForm')?.addEventListener('submit', handleAddSubmit);
  let currentSearch = '';
  let currentCategory = 'all';
  const searchInput = document.getElementById('menuSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value;
      renderMenuList(currentSearch, currentCategory);
    });
  }
  document.querySelectorAll('.category-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      renderMenuList(currentSearch, currentCategory);
    });
  });
  document.getElementById('addInventoryItemBtn')?.addEventListener('click', openAddInventoryModal);
  document.getElementById('addSupplierBtn')?.addEventListener('click', openAddSupplierModal);
  document.getElementById('inventorySearch')?.addEventListener('input', (e) => {
    renderInventoryList(e.target.value);
  });
  document.getElementById('addInventoryItemForm')?.addEventListener('submit', handleAddInventorySubmit);
  document.getElementById('supplierForm')?.addEventListener('submit', handleSupplierSubmit);
  document.getElementById('cancelAddInventory')?.addEventListener('click', closeAddInventoryModal);
  document.getElementById('cancelSupplier')?.addEventListener('click', closeSupplierModal);
  document.getElementById('cancelEdit')?.addEventListener('click', closeEditModal);
  document.getElementById('cancelDelete')?.addEventListener('click', closeDeleteModal);
  document.getElementById('closeModal')?.addEventListener('click', closeAddModal);
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById(`${tab}Tab`)?.classList.add('active');
    });
  });
  document.getElementById('addUserForm')?.addEventListener('submit', handleAddUserSubmit);
  document.getElementById('editUserForm')?.addEventListener('submit', handleEditUserSubmit);
  document.getElementById('confirmDeleteUser')?.addEventListener('click', handleDeleteUserConfirm);
  highlightNavItem('nav-dashboard');
  loadDashboardData();
  loadTopSellingItems();
});