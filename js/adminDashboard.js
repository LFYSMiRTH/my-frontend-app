const API_BASE = 'https://tambayan-cafe-backend.onrender.com/api';

const cardsConfig = [
  { key: 'totalOrders', title: 'Total Orders', icon: '<i class="ri-shopping-bag-line"></i>', color: '#2EC4B6', formatter: v => v.toLocaleString() },
  { key: 'totalRevenue', title: 'Total Revenue', icon: '<i class="ri-money-dollar-circle-line"></i>', color: '#FF9F1C', formatter: v => `₱${Number(v).toFixed(2)}` },
  { key: 'pendingOrders', title: 'Pending Orders', icon: '<i class="ri-time-line"></i>', color: '#2A9D8F', formatter: v => v.toLocaleString() },
  { key: 'lowStockAlerts', title: 'Low Stock Alerts', icon: '<i class="ri-alert-line"></i>', color: '#E76F51', formatter: v => v.toLocaleString() }
];

const overviewContainer = document.getElementById('overviewCards');

function getAuthToken() {
  return localStorage.getItem('adminToken');
}

async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const config = { ...options, headers };
  const res = await fetch(url, config);
  
  if (res.status === 401 || res.status === 403) {
    alert('Access denied. Please log in as admin.');
    window.location.href = '../html/login.html';
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

  // Safely parse JSON only if response contains JSON
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await res.json();
  } else {
    return { success: true }; // for 200/204 with empty body
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

async function loadMenuItems() {
  const container = document.getElementById('menuListContainer');
  container.innerHTML = '<p>Loading menu...</p>';
  try {
    const items = await apiCall('/admin/menu');
    if (!Array.isArray(items) || items.length === 0) {
      container.innerHTML = '<p>No items found.</p>';
      return;
    }

    let html = '';
    items.forEach(item => {
      html += `
        <div class="menu-item">
          <div><strong>${item.name}</strong><br>₱${(item.price ?? 0).toFixed(2)} | Stock: ${item.stockQuantity ?? 0}</div>
          <div class="menu-actions">
            <button class="edit-btn" 
              data-id="${item.id}" 
              data-name="${item.name}" 
              data-price="${item.price}" 
              data-stock="${item.stockQuantity}" 
              data-category="${item.category || ''}">✏️</button>
            <button class="delete-btn" 
              data-id="${item.id}" 
              data-name="${item.name}">🗑️</button>
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
  } catch (err) {
    console.error('Menu load error:', err);
    container.innerHTML = '<p style="color:red;">Failed to load menu.</p>';
  }
}

function openEditModal(e) {
  const btn = e.target.closest('.edit-btn');
  document.getElementById('editItemId').value = btn.dataset.id;
  document.getElementById('editItemName').value = btn.dataset.name;
  document.getElementById('editItemPrice').value = btn.dataset.price;
  document.getElementById('editItemStock').value = btn.dataset.stock;
  document.getElementById('editItemCategory').value = btn.dataset.category;

  document.getElementById('menuManagementModal')?.classList.add('hidden');
  document.getElementById('editMenuItemModal')?.classList.remove('hidden');
}

function openDeleteConfirm(e) {
  const btn = e.target.closest('.delete-btn');
  document.getElementById('deleteItemId').value = btn.dataset.id;
  document.getElementById('deleteItemName').textContent = btn.dataset.name;
  document.getElementById('menuManagementModal')?.classList.add('hidden');
  document.getElementById('deleteConfirmModal')?.classList.remove('hidden');
}

async function handleEditSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('editItemId').value;
  const updated = {
    name: document.getElementById('editItemName').value.trim(),
    price: parseFloat(document.getElementById('editItemPrice').value),
    stockQuantity: parseInt(document.getElementById('editItemStock').value),
    category: document.getElementById('editItemCategory').value.trim() || null
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
    alert('Item updated successfully!');
    closeEditModal();
    loadDashboardData();
    loadMenuItems();
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
  } catch (err) {
    console.error('Delete error:', err);
    alert('Delete failed: ' + err.message);
  }
}

async function handleAddSubmit(e) {
  e.preventDefault();
  const newItem = {
    name: document.getElementById('itemName').value.trim(),
    price: parseFloat(document.getElementById('itemPrice').value),
    stockQuantity: parseInt(document.getElementById('itemStock').value),
    category: document.getElementById('itemCategory').value.trim() || null
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
    closeAddModal();
    loadDashboardData();
    loadMenuItems();
  } catch (err) {
    console.error('Add error:', err);
    alert('Add failed: ' + err.message);
  }
}

function closeEditModal() {
  document.getElementById('editMenuItemModal')?.classList.add('hidden');
  document.getElementById('menuManagementModal')?.classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('deleteConfirmModal')?.classList.add('hidden');
  document.getElementById('menuManagementModal')?.classList.remove('hidden');
}

function closeAddModal() {
  document.getElementById('addMenuItemModal')?.classList.add('hidden');
  document.getElementById('menuManagementModal')?.classList.remove('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('adminToken');
    window.location.href = '../html/login.html';
  });

  document.getElementById('menuManagementBtn')?.addEventListener('click', () => {
    document.getElementById('menuManagementModal')?.classList.remove('hidden');
    loadMenuItems();
  });

  document.getElementById('closeMenuPanel')?.addEventListener('click', () => 
    document.getElementById('menuManagementModal')?.classList.add('hidden')
  );

  document.getElementById('cancelEdit')?.addEventListener('click', closeEditModal);
  document.getElementById('cancelDelete')?.addEventListener('click', closeDeleteModal);
  document.getElementById('closeModal')?.addEventListener('click', closeAddModal);

  document.getElementById('addItemBtn')?.addEventListener('click', () => {
    document.getElementById('menuManagementModal')?.classList.add('hidden');
    document.getElementById('addMenuItemModal')?.classList.remove('hidden');
  });

  document.getElementById('editMenuItemForm')?.addEventListener('submit', handleEditSubmit);
  document.getElementById('confirmDelete')?.addEventListener('click', handleDeleteConfirm);
  document.getElementById('addMenuItemForm')?.addEventListener('submit', handleAddSubmit);

  loadDashboardData();
});