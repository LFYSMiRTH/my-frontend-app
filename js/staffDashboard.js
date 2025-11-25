const API_BASE = 'https://tambayan-cafe-backend.onrender.com/api';
let allMenuItems = [];
let currentCategory = 'all';
let cart;
let newOrderCustomerName = '';
let newOrderTableNumber = '';
let currentFilter = 'New';
let selectedMood = 'Hot';
let selectedSize = 'S';
let selectedSugar = '30%';

function getPriceBySize(basePrice, size) {
  if (size === 'S') return basePrice;
  if (size === 'M') return basePrice + 5;
  if (size === 'L') return basePrice + 10;
  return basePrice;
}

function getFullImageUrl(relativePath) {
  if (!relativePath) return '/images/placeholder.png';
  if (relativePath.startsWith('http://') || relativePath.startsWith('https://')) {
    return relativePath;
  }
  const baseUrl = API_BASE.replace('/api', '');
  return `${baseUrl}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const token = localStorage.getItem('staffToken');
  const staffInfo = localStorage.getItem('staffInfo') ? JSON.parse(localStorage.getItem('staffInfo')) : null;
  const userRole = staffInfo?.role;
  if (!token || userRole !== 'staff') {
    localStorage.removeItem('staffToken');
    localStorage.removeItem('staffInfo');
    window.location.href = '/html/login.html';
    return;
  }
  cart = JSON.parse(localStorage.getItem('tambayanCart')) || [];
  loadStaffProfile();
  loadDashboardStats();
  loadRecentOrders();
  loadOrders('New');
  loadInventory();
  loadMenuItemsForPOS();
  setInterval(loadDashboardStats, 30000);
  document.querySelectorAll('.nav-item:not(.logout)').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      if (view) {
        showView(view);
        if (view === 'Menu') {
          loadMenuItemsForPOS();
        }
      }
    });
  });
  document.querySelector('.logout').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('staffToken');
    localStorage.removeItem('staffInfo');
    window.location.href = '/html/login.html';
  });
  document.querySelector('.bell').addEventListener('click', async () => {
    try {
      const notifs = await apiCall('/staff/notifications?limit=20');
      if (!notifs || notifs.length === 0) {
        alert('No new notifications.');
        return;
      }
      let msg = '🔔 Notifications:';
      notifs.forEach(n => {
        msg += `• ${n.message} (${new Date(n.createdAt).toLocaleString()})\n`;
      });
      alert(msg);
    } catch (err) {
      alert('Failed to load notifications: ' + err.message);
    }
  });
  document.querySelector('.profile-dropdown-trigger')?.addEventListener('click', toggleProfileDropdown);
  document.getElementById('menuSearch')?.addEventListener('input', (e) => {
    renderMenuItems(e.target.value, currentCategory);
  });
  document.querySelectorAll('.category-btn')?.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      const searchTerm = document.getElementById('menuSearch')?.value || '';
      renderMenuItems(searchTerm, currentCategory);
    });
  });
  document.getElementById('place-order-btn')?.addEventListener('click', placeOrder);
  document.getElementById('clear-cart')?.addEventListener('click', () => {
    const modal = document.getElementById('clearCartModal');
    if (modal) {
      modal.classList.add('show');
    }
  });
  function closeClearCartModal() {
    const modal = document.getElementById('clearCartModal');
    if (modal) {
      modal.classList.remove('show');
    }
  }
  document.getElementById('confirmClearCart')?.addEventListener('click', () => {
    cart = [];
    localStorage.removeItem('tambayanCart');
    updateCartUI();
    closeClearCartModal();
    showToast("Order cleared!");
  });
  window.onclick = function(event) {
    const itemModal = document.getElementById('itemModal');
    if (event.target === itemModal) {
      closeModal();
    }
    const clearCartModal = document.getElementById('clearCartModal');
    if (event.target === clearCartModal) {
      closeClearCartModal();
    }
    const dropdown = document.getElementById('profile-dropdown');
    const trigger = document.querySelector('.profile-dropdown-trigger');
    if (dropdown && !dropdown.contains(event.target) && !trigger.contains(event.target)) {
      dropdown.style.display = 'none';
    }
  };
  document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      const filter = this.dataset.filter;
      currentFilter = filter;
      loadOrders(filter);
    });
  });
  document.getElementById('cartItems').addEventListener('click', function(e) {
    const btn = e.target;
    const id = btn.dataset.id;
    if (!id) return;
    if (btn.classList.contains('quantity-btn')) {
      const action = btn.dataset.action;
      const item = cart.find(i => i.id == id);
      if (!item) return;
      if (action === 'inc') {
        item.quantity += 1;
      } else if (action === 'dec' && item.quantity > 1) {
        item.quantity -= 1;
      }
      if (item.quantity < 1) {
        cart = cart.filter(i => i.id != id);
      }
      localStorage.setItem('tambayanCart', JSON.stringify(cart));
      updateCartUI();
    } else if (btn.classList.contains('remove-item')) {
      cart = cart.filter(i => i.id != id);
      localStorage.setItem('tambayanCart', JSON.stringify(cart));
      updateCartUI();
    }
  });
  document.addEventListener('click', function(e) {
    if (e.target.matches('.btn-secondary[data-action="prep"]')) {
      const orderId = e.target.getAttribute('data-order-id');
      updateOrderStatus(orderId, 'Preparing');
    }
    else if (e.target.matches('.btn-secondary[data-action="serve"]')) {
      const orderId = e.target.getAttribute('data-order-id');
      updateOrderStatus(orderId, 'Ready');
    }
    else if (e.target.matches('.btn-secondary[data-action="complete"]')) {
      const orderId = e.target.getAttribute('data-order-id');
      updateOrderStatus(orderId, 'Completed');
    }
    else if (e.target.matches('.btn-secondary[data-action="print"]')) {
      const orderId = e.target.getAttribute('data-order-id');
      printReceipt(orderId);
    }
  });
  updateCartUI();
});

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector(`#${viewId}View`)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');
}

async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = localStorage.getItem('staffToken');
  if (!token) {
    localStorage.removeItem('staffToken');
    localStorage.removeItem('staffInfo');
    window.location.href = '/html/login.html';
    throw new Error('No token');
  }
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };
  const config = { ...options, headers };
  const res = await fetch(url, config);
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('staffToken');
    localStorage.removeItem('staffInfo');
    window.location.href = '/html/login.html';
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    let errorText = `HTTP ${res.status}`;
    try {
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorJson = await res.json();
        errorText = errorJson.message || JSON.stringify(errorJson);
      } else {
        const errorTextBody = await res.text();
        errorText = errorTextBody || `HTTP ${res.status}`;
      }
    } catch (e) {
      errorText = res.statusText || `HTTP ${res.status}`;
    }
    throw new Error(errorText);
  }
  return res.json();
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    await apiCall(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    const row = document.querySelector(`.order-item[data-order-id="${orderId}"]`);
    if (row) {
      row.setAttribute('data-status', newStatus);
      const statusBadge = row.querySelector('.order-status .status-badge');
      if (statusBadge) {
          statusBadge.textContent = newStatus;
          statusBadge.className = `status-badge ${newStatus.toLowerCase()}`;
      }
      const actionButtons = row.querySelector('.order-actions');
      if (actionButtons) {
          const newStatusLower = newStatus.toLowerCase();
          if (newStatusLower === 'preparing') {
              actionButtons.innerHTML = `
                <button class="btn-secondary" data-order-id="${orderId}" data-action="serve">
                  <i class="ri-checkbox-line"></i> Serve
                </button>
                <button class="btn-secondary" data-order-id="${orderId}" data-action="print">
                  <i class="ri-printer-line"></i> Print
                </button>
              `;
          } else if (newStatusLower === 'ready') {
              actionButtons.innerHTML = `
                <button class="btn-secondary" data-order-id="${orderId}" data-action="complete">
                  <i class="ri-check-double-line"></i> Complete
                </button>
                <button class="btn-secondary" data-order-id="${orderId}" data-action="print">
                  <i class="ri-printer-line"></i> Print
                </button>
              `;
          } else if (newStatusLower === 'completed' || newStatusLower === 'served') {
            actionButtons.innerHTML = `<span style="color: green;">Completed</span>`;
          }
      }
    }
    loadOrders(currentFilter);
  } catch (err) {
    alert(`Failed to update order status: ${err.message}`);
  }
}

async function loadStaffProfile() {
  try {
    const token = localStorage.getItem('staffToken');
    const staffInfo = localStorage.getItem('staffInfo') ? JSON.parse(localStorage.getItem('staffInfo')) : null;
    const userRole = staffInfo?.role;
    if (!token || userRole !== 'staff') {
      localStorage.removeItem('staffToken');
      localStorage.removeItem('staffInfo');
      window.location.href = '/html/login.html';
      return;
    }
  } catch (err) {
    console.error('Error loading staff profile:', err);
  }
}

function getStatusClass(status) {
  const map = {
    'Preparing': 'preparing',
    'Ready': 'ready',
    'Served': 'served',
    'Completed': 'served',
    'New': 'new'
  };
  return map[status] || 'new';
}

async function loadDashboardStats() {
  try {
    const stats = await apiCall('/staff/dashboard');
    document.getElementById('total-orders-today').textContent = stats.totalOrdersToday || 0;
    document.getElementById('total-sales-today').textContent = `₱${(stats.totalSalesToday || 0).toFixed(2)}`;
    document.getElementById('low-stock-alerts').textContent = stats.lowStockAlerts || 0;
    document.getElementById('pending-orders').textContent = stats.pendingOrders || 0;
  } catch (err) {
    console.error('Failed to load dashboard stats:', err);
  }
}

async function loadRecentOrders() {
  const tbody = document.querySelector('.orders-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  try {
    const orders = await apiCall('/orders/staff?limit=3');
    if (!orders || orders.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4">No recent orders.</td></tr>';
      return;
    }
    tbody.innerHTML = '';
    orders.forEach(order => {
      const row = document.createElement('tr');
      const statusClass = getStatusClass(order.status);
      row.innerHTML = `
        <td>#${order.orderNumber}</td>
        <td>${new Date(order.createdAt).toLocaleDateString()}</td>
        <td><span class="status ${statusClass}">${order.status}</span></td>
        <td>₱${Number(order.totalAmount).toFixed(2)}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="color:#e74c3c;">Error: ${err.message}</td></tr>`;
  }
}

async function loadOrders(filter) {
  const ordersList = document.getElementById('orders-list');
  if (!ordersList) return;
  ordersList.innerHTML = '<div class="order-item"><div class="order-info"><p>Loading orders...</p></div></div>';
  try {
    let endpoint = '/orders/staff';
    if (filter && filter !== 'all') {
      let statusParam = '';
      switch (filter.toLowerCase()) {
        case 'new': statusParam = 'New'; break;
        case 'preparing': statusParam = 'Preparing'; break;
        case 'ready': statusParam = 'Ready'; break;
        case 'complete':
        case 'completed':
        case 'served': statusParam = 'Completed,Served'; break;
        default: statusParam = filter; break;
      }
      if (statusParam) endpoint += `?status=${statusParam}`;
    }
    const orders = await apiCall(endpoint);
    if (!orders || orders.length === 0) {
      ordersList.innerHTML = '<div class="order-item"><div class="order-info"><p>No orders found.</p></div></div>';
      return;
    }
    ordersList.innerHTML = '';
    orders.forEach(order => {
      const orderItem = document.createElement('div');
      orderItem.className = `order-item ${order.status.toLowerCase()}`;
      orderItem.setAttribute('data-order-id', order.id);
      orderItem.setAttribute('data-status', order.status);
      orderItem.innerHTML = `
        <div class="order-info">
          <div class="order-number">#${order.orderNumber}</div>
          <div class="customer-name">${order.customerName || 'Customer'}</div>
          <div class="order-items">${order.items.map(item => `${item.name} x${item.quantity}`).join(', ')}</div>
          <div class="order-time">${new Date(order.createdAt).toLocaleTimeString()}</div>
        </div>
        <div class="order-status">
          <span class="status-badge ${order.status.toLowerCase()}">${order.status}</span>
        </div>
        <div class="order-actions"></div>
      `;
      const actionButtonsDiv = orderItem.querySelector('.order-actions');
      const statusLower = order.status.toLowerCase();
      if (statusLower === 'new' || statusLower === 'pending') {
        actionButtonsDiv.innerHTML = `
          <button class="btn-secondary" data-order-id="${order.id}" data-action="prep">
            <i class="ri-tools-line"></i> Prep
          </button>
          <button class="btn-secondary" data-order-id="${order.id}" data-action="print">
            <i class="ri-printer-line"></i> Print
          </button>
        `;
      } else if (statusLower === 'preparing') {
          actionButtonsDiv.innerHTML = `
            <button class="btn-secondary" data-order-id="${order.id}" data-action="serve">
              <i class="ri-checkbox-line"></i> Serve
            </button>
            <button class="btn-secondary" data-order-id="${order.id}" data-action="print">
              <i class="ri-printer-line"></i> Print
            </button>
          `;
      } else if (statusLower === 'ready') {
        actionButtonsDiv.innerHTML = `
          <button class="btn-secondary" data-order-id="${order.id}" data-action="complete">
            <i class="ri-check-double-line"></i> Complete
          </button>
          <button class="btn-secondary" data-order-id="${order.id}" data-action="print">
            <i class="ri-printer-line"></i> Print
          </button>
        `;
      } else if (statusLower === 'completed' || statusLower === 'served') {
        actionButtonsDiv.innerHTML = `<i class="ri-checkbox-circle-fill" style="color: #27ae60; font-size: 1.2rem;"></i>`;
      }
      ordersList.appendChild(orderItem);
    });
  } catch (err) {
    ordersList.innerHTML = `<div class="order-item"><div class="order-info"><p style="color:#e74c3c;">Error loading orders: ${err.message}</p></div></div>`;
  }
}

async function printReceipt(orderId) {
  try {
    await apiCall(`/staff/orders/${orderId}/print`, { method: 'POST' });
    alert(`Receipt for order ${orderId} printed`);
  } catch (err) {
    alert(`Failed to print receipt: ${err.message}`);
  }
}

async function loadInventory() {
  const inventoryList = document.getElementById('inventory-list');
  if (!inventoryList) return;
  inventoryList.innerHTML = '<div class="inventory-item"><div class="table-cell">Loading inventory...</div></div>';
  try {
    const inventory = await apiCall('/staff/inventory');
    if (!inventory || inventory.length === 0) {
      inventoryList.innerHTML = '<div class="inventory-item"><div class="table-cell">No inventory found.</div></div>';
      return;
    }
    inventoryList.innerHTML = '';
    inventory.forEach(item => {
      // Determine status based on stock level
      let statusClass = 'in-stock';
      let statusText = 'In stock';
      let statusIcon = 'ri-check-line';
      
      if (item.currentStock <= 0) {
        statusClass = 'out-of-stock';
        statusText = 'Out of stock';
        statusIcon = 'ri-close-line';
      } else if (item.currentStock <= 5) {
        statusClass = 'low-stock';
        statusText = 'Low stock';
        statusIcon = 'ri-alert-line';
      }
      
      const inventoryItem = document.createElement('div');
      inventoryItem.className = 'inventory-item';
      inventoryItem.innerHTML = `
        <div class="table-cell product-info">
          <span class="product-name">${item.name}</span>
        </div>
        <div class="table-cell category">${item.category}</div>
        <div class="table-cell stock">${item.currentStock} units</div>
        <div class="table-cell status ${statusClass}">
          <i class="${statusIcon}"></i> ${statusText}
        </div>
        <div class="table-cell action">
          <button class="btn-warning" onclick="sendLowStockAlert('${item.name}')">
            <i class="ri-notification-2-line"></i> Alert Admin
          </button>
        </div>
      `;
      inventoryList.appendChild(inventoryItem);
    });
  } catch (err) {
    inventoryList.innerHTML = `<div class="inventory-item"><div class="table-cell" style="color:#e74c3c;">Error loading inventory: ${err.message}</div></div>`;
  }
}

async function sendLowStockAlert(itemName) {
  try {
    await apiCall('/staff/inventory/alert', {
      method: 'POST',
      body: JSON.stringify({ itemName })
    });
    alert(`Low stock alert sent for ${itemName}`);
  } catch (err) {
    alert(`Failed to send alert: ${err.message}`);
  }
}

async function loadMenuItemsForPOS() {
  const menuGrid = document.getElementById('menuGrid');
  if (!menuGrid) return;
  menuGrid.innerHTML = '<p>Loading menu...</p>';
  try {
    const items = await apiCall('/product/staff/menu');
    allMenuItems = Array.isArray(items) ? items.map(item => ({
      ...item,
      name: item.name || item.Name || 'Unknown',
      price: item.price || item.Price || 0,
      category: item.category || item.Category || 'Uncategorized',
      isAvailable: item.isAvailable !== undefined ? item.isAvailable : (item.IsAvailable !== undefined ? item.IsAvailable : true),
    })) : [];
    renderMenuItems('', 'all');
  } catch (err) {
    menuGrid.innerHTML = `<p style="color:#e74c3c;">Error loading menu: ${err.message}</p>`;
  }
}

function renderMenuItems(searchTerm = '', category = 'all') {
  const menuGrid = document.getElementById('menuGrid');
  if (!menuGrid) return;
  let filtered = allMenuItems;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(item => item.name.toLowerCase().includes(term));
  }
  if (category !== 'all') {
    filtered = filtered.filter(item => item.category === category);
  }
  if (filtered.length === 0) {
    menuGrid.innerHTML = '<p>No items found.</p>';
    return;
  }
  menuGrid.innerHTML = filtered.map(item => `
    <div class="menu-item-card ${!item.isAvailable ? 'unavailable' : ''}" data-id="${item.id}">
      <img src="${getFullImageUrl(item.imageUrl)}" alt="${item.name}" class="menu-item-image" onerror="this.onerror=null;this.src='/images/placeholder.png';">
      <h4 class="menu-item-name">${item.name}</h4>
      <p class="menu-item-price">₱${Number(item.price).toFixed(2)}</p>
    </div>
  `).join('');
  document.querySelectorAll('.menu-item-card').forEach(card => {
    card.addEventListener('click', () => {
      const itemId = card.dataset.id;
      const item = allMenuItems.find(i => i.id === itemId);
      if (item) openItemModal(item);
    });
  });
}

function openItemModal(item) {
  const modal = document.getElementById('itemModal');
  const modalImage = document.getElementById('modalImage');
  const modalName = document.getElementById('modalName');
  const modalPrice = document.getElementById('modalPrice');
  const modalCategory = document.getElementById('modalCategory');
  const modalIngredients = document.getElementById('modalIngredients');
  const modalAvailability = document.getElementById('modalAvailability');
  const modalAddToCart = document.getElementById('modalAddToCart');
  modalName.textContent = item.name;
  modalPrice.textContent = `₱${getPriceBySize(item.price, selectedSize).toFixed(2)}`;
  modalCategory.textContent = item.category;
  modalIngredients.innerHTML = '';
  if (item.ingredients && Array.isArray(item.ingredients)) {
    if (item.ingredients.length === 0) {
      modalIngredients.innerHTML = '<li>No ingredients listed</li>';
    } else {
      item.ingredients.forEach(ingredient => {
        let name = 'Unknown ingredient';
        if (typeof ingredient === 'string') {
          name = ingredient;
        } else if (typeof ingredient === 'object' && ingredient !== null) {
          name = ingredient.name || ingredient.Name || `Unknown (${ingredient.inventoryItemId || ''})`;
        }
        const li = document.createElement('li');
        li.textContent = name;
        modalIngredients.appendChild(li);
      });
    }
  } else {
    modalIngredients.innerHTML = '<li>Details not available</li>';
  }
  if (item.isAvailable) {
    modalAvailability.textContent = 'Available';
    modalAvailability.style.color = '#4CAF50';
    modalAvailability.style.fontWeight = 'bold';
    modalAddToCart.disabled = false;
  } else {
    modalAvailability.textContent = 'Currently Unavailable';
    modalAvailability.style.color = '#E53E3E';
    modalAvailability.style.fontWeight = 'bold';
    modalAddToCart.disabled = true;
  }
  let currentModalQuantity = 1;
  const qtyContainer = document.getElementById('modalQuantityContainer');
  if (qtyContainer) {
    qtyContainer.innerHTML = '';
    const minusBtn = document.createElement('button');
    minusBtn.className = 'quantity-btn';
    minusBtn.textContent = '−';
    minusBtn.addEventListener('click', () => {
      if (currentModalQuantity > 1) {
        currentModalQuantity--;
        qtyDisplay.textContent = currentModalQuantity;
      }
    });
    const qtyDisplay = document.createElement('span');
    qtyDisplay.className = 'quantity-display';
    qtyDisplay.textContent = currentModalQuantity;
    const plusBtn = document.createElement('button');
    plusBtn.className = 'quantity-btn';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      currentModalQuantity++;
      qtyDisplay.textContent = currentModalQuantity;
    });
    qtyContainer.appendChild(minusBtn);
    qtyContainer.appendChild(qtyDisplay);
    qtyContainer.appendChild(plusBtn);
  }
  const customizationSection = document.querySelector('.customization-section');
  if (item.category === 'Drinks') {
    customizationSection.style.display = 'block';
    document.querySelectorAll('.custom-option-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.custom-option-btn[data-type="mood"][data-value="${selectedMood}"]`).classList.add('active');
    document.querySelector(`.custom-option-btn[data-type="size"][data-value="${selectedSize}"]`).classList.add('active');
    document.querySelector(`.custom-option-btn[data-type="sugar"][data-value="${selectedSugar}"]`).classList.add('active');
    document.querySelectorAll('.custom-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        const value = e.target.dataset.value;
        document.querySelectorAll(`.custom-option-btn[data-type="${type}"]`).forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        if (type === 'mood') selectedMood = value;
        else if (type === 'size') {
          selectedSize = value;
          modalPrice.textContent = `₱${getPriceBySize(item.price, selectedSize).toFixed(2)}`;
        }
        else if (type === 'sugar') selectedSugar = value;
      });
    });
  } else {
    customizationSection.style.display = 'none';
  }
  modalImage.src = getFullImageUrl(item.imageUrl);
  modalAddToCart.onclick = () => {
    if (!item.isAvailable) {
      alert("This item is currently unavailable.");
      return;
    }
    const quantity = currentModalQuantity;
    let sizeToUse = 'S';
    let moodToUse = 'Hot';
    let sugarToUse = '30%';
    let finalPrice = item.price;
    if (item.category === 'Drinks') {
      sizeToUse = selectedSize;
      moodToUse = selectedMood;
      sugarToUse = selectedSugar;
      finalPrice = getPriceBySize(item.price, sizeToUse);
    }
    addToCart(item, quantity, sizeToUse, moodToUse, sugarToUse, finalPrice);
    closeModal();
  };
  modal.classList.add('show');
}

function closeModal() {
  const modal = document.getElementById('itemModal');
  if (modal) modal.classList.remove('show');
}

function closeClearCartModal() {
  const modal = document.getElementById('clearCartModal');
  if (modal) modal.classList.remove('show');
}

function addToCart(item, quantity = 1, size = 'S', mood = 'Hot', sugar = '30%', overridePrice = null) {
  if (!item.isAvailable) {
    alert("This item is currently unavailable.");
    return;
  }
  const priceToUse = overridePrice !== null ? overridePrice : getPriceBySize(item.price, size);
  const existing = cart.find(i =>
    i.id === item.id &&
    i.size === size &&
    i.mood === mood &&
    i.sugar === sugar
  );
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({
      ...item,
      price: priceToUse,
      quantity,
      size,
      mood,
      sugar
    });
  }
  localStorage.setItem('tambayanCart', JSON.stringify(cart));
  updateCartUI();
  showToast(`"${item.name}" added to order!`);
}

function updateCartUI() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('cartTotal').textContent = `₱${total.toFixed(2)}`;
  const cartItems = document.getElementById('cartItems');
  if (cart.length === 0) {
    cartItems.innerHTML = '<p class="empty-cart">No items added yet.</p>';
    return;
  }
  let html = '';
  cart.forEach(item => {
    html += `
      <div class="cart-item">
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}${item.size && item.category === 'Drinks' ? ` (${item.size})` : ''}${item.mood && item.category === 'Drinks' ? ` - ${item.mood}` : ''}</div>
          <div class="cart-item-price">₱${item.price.toFixed(2)} each</div>
        </div>
        <div class="quantity-controls">
          <button class="quantity-btn" data-id="${item.id}" data-action="dec">−</button>
          <div class="quantity-display">${item.quantity}</div>
          <button class="quantity-btn" data-id="${item.id}" data-action="inc">+</button>
        </div>
        <button class="remove-item" data-id="${item.id}">×</button>
      </div>
    `;
  });
  cartItems.innerHTML = html;
}

function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 2000);
}

async function placeOrder() {
  if (cart.length === 0) {
    alert("Cannot place an empty order.");
    return;
  }
  const customerName = newOrderCustomerName || 'Walk-in Customer';
  const tableNumber = newOrderTableNumber || 'N/A';
  const orderItems = cart.map(item => ({
    productId: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    size: item.size && item.category === 'Drinks' ? item.size : undefined,
    mood: item.mood && item.category === 'Drinks' ? item.mood : undefined,
    sugar: item.sugar && item.category === 'Drinks' ? item.sugar : undefined
  }));
  const payload = {
    customerName: customerName,
    tableNumber: tableNumber,
    items: orderItems,
    totalAmount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    placedByStaff: true,
    staffId: JSON.parse(localStorage.getItem('staffInfo'))?.id
  };
  try {
    const result = await apiCall('/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    showToast('New order placed successfully!');
    cart = [];
    localStorage.removeItem('tambayanCart');
    updateCartUI();
    loadOrders(currentFilter);
  } catch (err) {
    alert('Failed to place new order: ' + (err.message || 'Unknown error'));
  }
}

function toggleProfileDropdown() {
  const dropdown = document.getElementById('profile-dropdown');
  if (dropdown) {
    const isVisible = dropdown.style.display === 'block' || dropdown.classList.contains('show');
    if (isVisible) {
      dropdown.style.display = 'none';
      dropdown.classList.remove('show');
    } else {
      dropdown.style.display = 'block';
      dropdown.classList.add('show');
    }
  }
}

async function viewStaffAccount() {
  try {
    const profile = await apiCall('/staff/profile');
    const modal = document.getElementById('view-account-modal');
    const details = document.getElementById('account-details');
    details.innerHTML = `
      <div class="account-info">
        <div class="info-row">
          <span class="info-label">Name:</span>
          <span class="info-value">${profile.name || profile.username}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Email:</span>
          <span class="info-value">${profile.email}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Role:</span>
          <span class="info-value">${profile.role}</span>
        </div>
        <div class="info-row">
          <span class="info-label">ID:</span>
          <span class="info-value">${profile.id}</span>
        </div>
      </div>
    `;
    modal.style.display = 'flex';
  } catch (err) {
    alert(`Failed to load profile: ${err.message}`);
  }
}

function closeViewAccountModal() {
  document.getElementById('view-account-modal').style.display = 'none';
}

function showChangePasswordForm() {
  document.getElementById('change-password-modal').style.display = 'flex';
}

function closeChangePasswordModal() {
  document.getElementById('change-password-modal').style.display = 'none';
}

async function submitChangePassword() {
  const current = document.getElementById('currentPassword').value.trim();
  const newPassword = document.getElementById('newPassword').value.trim();
  const confirm = document.getElementById('confirmPassword').value.trim();
  if (!current || !newPassword || !confirm) {
    alert('Please fill in all fields.');
    return;
  }
  if (newPassword !== confirm) {
    alert('New passwords do not match.');
    return;
  }
  try {
    await apiCall('/staff/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword: current, newPassword })
    });
    alert('Password changed successfully!');
    closeChangePasswordModal();
    document.getElementById('currentPassword').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('confirmPassword').value = '';
  } catch (err) {
    alert('Failed to change password: ' + (err.message || 'Unknown error'));
  }
}