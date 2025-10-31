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

// ===== Load Top Selling Items =====
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

// ===== INVENTORY MANAGEMENT =====

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
          ${isLow ? '<div class="low-stock">⚠️ LOW STOCK</div>' : ''}
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
    // 🔥 Check availability based on ingredients
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

    html += `
      <div class="menu-item" data-available="${isAvailable}">
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

// 🔥 NEW: Load and display ingredients
async function loadAndRenderIngredients(menuItemId) {
  const listContainer = document.getElementById('ingredientList');
  const select = document.getElementById('addIngredientSelect');
  if (!listContainer || !select) return;

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

  } catch (err) {
    console.error('Failed to load ingredients:', err);
    listContainer.innerHTML = '<p style="color:#e74c3c;">Failed to load ingredients.</p>';
  }
}

// 🔥 NEW: Save ingredients
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

  // 🔥 Load ingredients
  loadAndRenderIngredients(id);

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
    category: document.getElementById('editItemCategory').value,
    price: parseFloat(document.getElementById('editItemPrice').value),
    stockQuantity: parseInt(document.getElementById('editItemStock').value),
    isAvailable: document.getElementById('editItemAvailable').checked,
    // ingredients are managed separately
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
    ingredients: [] // new items start with no ingredients
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

// ===== Helper: Highlight Nav Item =====
function highlightNavItem(id) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

// 🔥 NEW: Add Inventory Item Modal Handlers
function openAddInventoryModal() {
  document.getElementById('inventoryManagementModal')?.classList.add('hidden');
  document.getElementById('addInventoryItemModal')?.classList.remove('hidden');
}

function closeAddInventoryModal() {
  document.getElementById('addInventoryItemModal')?.classList.add('hidden');
  document.getElementById('inventoryManagementModal')?.classList.remove('hidden');
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
    loadInventoryItems(); // Refresh list
  } catch (err) {
    console.error('Add inventory error:', err);
    alert('Failed to add ingredient: ' + err.message);
  }
}

// ===== MAIN INIT =====
document.addEventListener('DOMContentLoaded', () => {
  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('adminToken');
    window.location.href = '../html/login.html';
  });

  // Dashboard
  document.getElementById('nav-dashboard')?.addEventListener('click', () => {
    highlightNavItem('nav-dashboard');
  });

  // Menu Management
  document.getElementById('nav-menu-management')?.addEventListener('click', () => {
    document.getElementById('menuManagementModal')?.classList.remove('hidden');
    loadMenuItems();
    highlightNavItem('nav-menu-management');
  });

  // Inventory Management
  document.getElementById('nav-inventory-management')?.addEventListener('click', () => {
    const modal = document.getElementById('inventoryManagementModal');
    modal?.classList.remove('hidden');
    loadInventoryItems();
    loadSuppliers();
    highlightNavItem('nav-inventory-management');
  });

  // Other sections (placeholders)
  document.getElementById('nav-sales-analytics')?.addEventListener('click', () => {
    alert("Sales & Analytics section is under development.");
    highlightNavItem('nav-sales-analytics');
  });

  document.getElementById('nav-reports')?.addEventListener('click', () => {
    alert("Reports section is under development.");
    highlightNavItem('nav-reports');
  });

  document.getElementById('nav-user-management')?.addEventListener('click', () => {
    alert("User Management is under development.");
    highlightNavItem('nav-user-management');
  });

  document.getElementById('nav-system-settings')?.addEventListener('click', () => {
    alert("System Settings are under development.");
    highlightNavItem('nav-system-settings');
  });

  // Menu Modal Controls
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

  // Menu Form Submissions
  document.getElementById('editMenuItemForm')?.addEventListener('submit', handleEditSubmit);
  document.getElementById('confirmDelete')?.addEventListener('click', handleDeleteConfirm);
  document.getElementById('addMenuItemForm')?.addEventListener('submit', handleAddSubmit);

  // Menu Filtering
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

  // Inventory Tab Switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById(`${tab}Tab`)?.classList.add('active');
    });
  });

  // Inventory Search
  document.getElementById('inventorySearch')?.addEventListener('input', (e) => {
    renderInventoryList(e.target.value);
  });

  // 🔥 NEW: Add Inventory Item Button
  document.getElementById('addInventoryItemBtn')?.addEventListener('click', openAddInventoryModal);
  document.getElementById('cancelAddInventory')?.addEventListener('click', closeAddInventoryModal);
  document.getElementById('addInventoryItemForm')?.addEventListener('submit', handleAddInventorySubmit);

  // Supplier Management
  document.getElementById('addSupplierBtn')?.addEventListener('click', () => {
    document.getElementById('supplierModalTitle').textContent = 'Add New Supplier';
    document.getElementById('supplierForm').reset();
    document.getElementById('supplierId').value = '';
    document.getElementById('inventoryManagementModal')?.classList.add('hidden');
    document.getElementById('supplierModal')?.classList.remove('hidden');
  });

  document.getElementById('closeInventoryModal')?.addEventListener('click', () => {
    document.getElementById('inventoryManagementModal')?.classList.add('hidden');
  });

  document.getElementById('cancelSupplier')?.addEventListener('click', () => {
    document.getElementById('supplierModal')?.classList.add('hidden');
    document.getElementById('inventoryManagementModal')?.classList.remove('hidden');
  });

  document.getElementById('supplierForm')?.addEventListener('submit', async (e) => {
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
      document.getElementById('supplierModal')?.classList.add('hidden');
      document.getElementById('inventoryManagementModal')?.classList.remove('hidden');
      loadSuppliers();
    } catch (err) {
      console.error('Supplier save error:', err);
      alert('Failed to save supplier: ' + err.message);
    }
  });

  // 🔥 NEW: Add ingredient button (for menu items)
  document.getElementById('addIngredientBtn')?.addEventListener('click', async () => {
    const menuItemId = document.getElementById('editItemId').value;
    const inventoryItemId = document.getElementById('addIngredientSelect').value;
    const qty = parseFloat(document.getElementById('addIngredientQty').value);

    if (!inventoryItemId || isNaN(qty) || qty <= 0) {
      alert('Please select an ingredient and enter a valid quantity (> 0).');
      return;
    }

    try {
      const currentIngredients = await apiCall(`/admin/menu/${menuItemId}/ingredients`);
      if (currentIngredients.some(ing => ing.inventoryItemId === inventoryItemId)) {
        alert('This ingredient is already added.');
        return;
      }

      const newIngredient = {
        inventoryItemId: inventoryItemId,
        quantityRequired: qty,
        unit: 'pcs'
      };

      const updatedIngredients = [...currentIngredients, newIngredient];
      await saveIngredientsForMenuItem(menuItemId, updatedIngredients);
      loadAndRenderIngredients(menuItemId);
      document.getElementById('addIngredientQty').value = '';
      alert('Ingredient added!');
    } catch (err) {
      console.error('Add ingredient error:', err);
      alert('Failed to add ingredient: ' + err.message);
    }
  });

  highlightNavItem('nav-dashboard');
  loadDashboardData();
  loadTopSellingItems();
});