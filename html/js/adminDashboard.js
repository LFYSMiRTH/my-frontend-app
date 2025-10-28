const cardsConfig = [
  { key: 'totalOrders', title: 'Total Orders', icon: '<i class="ri-shopping-bag-line"></i>', color: '#2EC4B6', formatter: v => v.toLocaleString() },
  { key: 'totalRevenue', title: 'Total Revenue', icon: '<i class="ri-money-dollar-circle-line"></i>', color: '#FF9F1C', formatter: v => `₱${Number(v).toFixed(2)}` },
  { key: 'pendingOrders', title: 'Pending Orders', icon: '<i class="ri-time-line"></i>', color: '#2A9D8F', formatter: v => v.toLocaleString() },
  { key: 'lowStockAlerts', title: 'Low Stock Alerts', icon: '<i class="ri-alert-line"></i>', color: '#E76F51', formatter: v => v.toLocaleString() }
];

const overviewContainer = document.getElementById('overviewCards');

async function loadDashboardData() {
  overviewContainer.innerHTML = '<p>Loading...</p>';
  try {
    const res = await fetch('https://localhost:7179/api/admin/dashboard');
    const data = await res.json();
    renderOverviewCards(data);
  } catch (err) {
    overviewContainer.innerHTML = `<p class="no-data">Error: ${err.message}</p>`;
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

// 🔁 Load Menu Items
async function loadMenuItems() {
  const container = document.getElementById('menuListContainer');
  container.innerHTML = '<p>Loading menu...</p>';
  try {
    const res = await fetch('https://localhost:7179/api/admin/menu');
    const items = await res.json();
    if (items.length === 0) {
      container.innerHTML = '<p>No items found.</p>';
      return;
    }
    let html = '';
    items.forEach(item => {
      html += `
        <div class="menu-item">
          <div><strong>${item.name}</strong><br>₱${item.price} | Stock: ${item.stockQuantity}</div>
          <div class="menu-actions">
            <button class="edit-btn" data-id="${item.id}" 
                    data-name="${item.name}" data-price="${item.price}" 
                    data-stock="${item.stockQuantity}" data-category="${item.category || ''}">✏️</button>
            <button class="delete-btn" data-id="${item.id}" data-name="${item.name}">🗑️</button>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;

    // Attach listeners
    document.querySelectorAll('.edit-btn').forEach(btn => 
      btn.addEventListener('click', openEditModal)
    );
    document.querySelectorAll('.delete-btn').forEach(btn => 
      btn.addEventListener('click', openDeleteConfirm)
    );
  } catch (err) {
    container.innerHTML = '<p style="color:red;">Failed to load menu.</p>';
    console.error('Menu load error:', err);
  }
}

// 🖊️ Edit Modal
function openEditModal(e) {
  const btn = e.target.closest('.edit-btn');
  document.getElementById('editItemId').value = btn.dataset.id;
  document.getElementById('editItemName').value = btn.dataset.name;
  document.getElementById('editItemPrice').value = btn.dataset.price;
  document.getElementById('editItemStock').value = btn.dataset.stock;
  document.getElementById('editItemCategory').value = btn.dataset.category;

  document.getElementById('menuManagementModal').classList.add('hidden');
  document.getElementById('editMenuItemModal').classList.remove('hidden');
}

// 🗑️ Delete Confirm
function openDeleteConfirm(e) {
  const btn = e.target.closest('.delete-btn');
  document.getElementById('deleteItemId').value = btn.dataset.id;
  document.getElementById('deleteItemName').textContent = btn.dataset.name;
  document.getElementById('menuManagementModal').classList.add('hidden');
  document.getElementById('deleteConfirmModal').classList.remove('hidden');
}

// 🚀 DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Menu Management
  document.getElementById('menuManagementBtn')?.addEventListener('click', () => {
    document.getElementById('menuManagementModal').classList.remove('hidden');
    loadMenuItems();
  });

  // Close modals
  document.getElementById('closeMenuPanel')?.addEventListener('click', () => 
    document.getElementById('menuManagementModal').classList.add('hidden')
  );
  document.getElementById('cancelEdit')?.addEventListener('click', () => {
    document.getElementById('editMenuItemModal').classList.add('hidden');
    document.getElementById('menuManagementModal').classList.remove('hidden');
    loadMenuItems();
  });
  document.getElementById('cancelDelete')?.addEventListener('click', () => {
    document.getElementById('deleteConfirmModal').classList.add('hidden');
    document.getElementById('menuManagementModal').classList.remove('hidden');
    loadMenuItems();
  });

  // Add Item
  document.getElementById('addItemBtn')?.addEventListener('click', () => {
    document.getElementById('menuManagementModal').classList.add('hidden');
    document.getElementById('addMenuItemModal').classList.remove('hidden');
  });

  // Edit Form Submit
  document.getElementById('editMenuItemForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('editItemId').value;
    const updated = {
      name: document.getElementById('editItemName').value.trim(),
      price: parseFloat(document.getElementById('editItemPrice').value),
      stockQuantity: parseInt(document.getElementById('editItemStock').value),
      category: document.getElementById('editItemCategory').value.trim() || null
    };
    if (!updated.name || updated.price < 0 || updated.stockQuantity < 0) {
      alert('Invalid input');
      return;
    }
    try {
      await fetch(`https://localhost:7179/api/admin/menu/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      alert('Updated!');
      document.getElementById('editMenuItemModal').classList.add('hidden');
      loadDashboardData();
      loadMenuItems();
    } catch (err) {
      alert('Update failed');
    }
  });

  // Delete Confirm
  document.getElementById('confirmDelete')?.addEventListener('click', async () => {
    const id = document.getElementById('deleteItemId').value;
    try {
      await fetch(`https://localhost:7179/api/admin/menu/${id}`, { method: 'DELETE' });
      alert('Deleted!');
      document.getElementById('deleteConfirmModal').classList.add('hidden');
      loadDashboardData();
      loadMenuItems();
    } catch (err) {
      alert('Delete failed');
    }
  });

  // Add Item Form (your existing code – keep it)
  const form = document.getElementById('addMenuItemForm');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newItem = {
        name: document.getElementById('itemName').value.trim(),
        price: parseFloat(document.getElementById('itemPrice').value),
        stockQuantity: parseInt(document.getElementById('itemStock').value),
        category: document.getElementById('itemCategory').value.trim() || null
      };
      if (!newItem.name || newItem.price < 0 || newItem.stockQuantity < 0) {
        alert('Invalid input');
        return;
      }
      try {
        const res = await fetch('https://localhost:7179/api/admin/menu', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newItem)
        });
        if (res.ok) {
          alert('Added!');
          form.reset();
          document.getElementById('addMenuItemModal').classList.add('hidden');
          loadDashboardData();
          loadMenuItems();
        }
      } catch (err) {
        alert('Add failed');
      }
    });
  }

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', (e) => {
    e.preventDefault();
    window.location.href = '../html/login.html';
  });

  loadDashboardData();
});