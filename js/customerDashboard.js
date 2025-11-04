const API_BASE = 'https://tambayan-cafe-backend.onrender.com/api';
let allMenuItems = [];
let cart = JSON.parse(localStorage.getItem('tambayanCart')) || [];
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
  const userData = JSON.parse(localStorage.getItem('userData'));
  if (!userData || userData.role !== 'customer') {
    window.location.href = '/login';
    return;
  }
  loadCustomerProfile();
  loadRecentOrders();
  loadFavorites();
  loadCurrentOrderForTracker();
  setInterval(loadCurrentOrderForTracker, 10000);
  document.querySelectorAll('.nav-item:not(.logout)').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      if (view) {
        showView(view);
        if (view === 'menu' && !window.menuLoaded) {
          loadMenuItems();
          window.menuLoaded = true;
        }
      }
    });
  });
  document.querySelector('.logout').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('userData');
    window.location.href = '/login';
  });
  document.querySelector('.bell').addEventListener('click', async () => {
    try {
      const notifs = await apiCall('/customer/notifications?limit=5');
      if (notifs.length === 0) {
        alert('No new notifications.');
        return;
      }
      let msg = '🔔 Notifications:\n';
      notifs.forEach(n => {
        msg += `• ${n.message} (${new Date(n.createdAt).toLocaleString()})\n`;
      });
      alert(msg);
    } catch (err) {
      alert('Failed to load notifications: ' + err.message);
    }
  });
  document.getElementById('menuSearch')?.addEventListener('input', (e) => {
    renderMenu(e.target.value, currentCategory);
  });
  document.querySelectorAll('.category-btn')?.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      renderMenu(document.getElementById('menuSearch').value, currentCategory);
    });
  });
  document.getElementById('checkoutBtn')?.addEventListener('click', placeOrder);
  document.getElementById('closeModal')?.addEventListener('click', () => {
    document.getElementById('itemModal').style.display = 'none';
  });
  updateCartUI();
});

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector(`#${viewId}View`)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');
}

// ===== AUTH & API =====
function getAuthToken() {
  const userData = JSON.parse(localStorage.getItem('userData'));
  return userData?.id || null;
}

async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const userData = JSON.parse(localStorage.getItem('userData'));
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (userData && userData.role === 'customer') {
    headers.Authorization = `Bearer ${getAuthToken()}`;
  }
  const config = { ...options, headers };
  const res = await fetch(url, config);
  if (res.status === 401 || res.status === 403) {
    alert('Session expired. Please log in again.');
    localStorage.removeItem('userData');
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
  return res.json();
}

// ===== DASHBOARD =====
async function loadCustomerProfile() {
  try {
    const profile = await apiCall('/customer/profile');
    document.querySelector('.welcome').textContent = `Welcome back, ${profile.name}!`;
  } catch (err) {
    const userData = JSON.parse(localStorage.getItem('userData'));
    document.querySelector('.welcome').textContent = `Welcome back, ${userData?.name || 'Customer'}!`;
  }
}

function getStatusClass(status) {
  const map = {
    'Preparing': 'preparing',
    'Ready': 'ready',
    'Served': 'served',
    'Completed': 'served'
  };
  return map[status] || 'preparing';
}

async function loadRecentOrders() {
  const tbody = document.querySelector('.orders-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  try {
    const orders = await apiCall('/customer/orders?limit=3');
    if (!Array.isArray(orders) || orders.length === 0) {
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

async function loadFavorites() {
  const grid = document.querySelector('.favorites-grid');
  if (!grid) return;
  grid.innerHTML = '<p>Loading recommendations...</p>';
  try {
    const favorites = await apiCall('/customer/favorites');
    if (!Array.isArray(favorites) || favorites.length === 0) {
      grid.innerHTML = '<p>No recommended items yet.</p>';
      return;
    }
    let html = '';
    favorites.slice(0, 2).forEach(item => {
      html += `
        <div class="item-card">
          <div class="item-image">
            <img src="${item.imageUrl || '/image/placeholder-menu.jpg'}" alt="${item.name}" />
          </div>
          <div class="item-info">
            <div class="item-title">${item.name}</div>
            <div class="item-price">₱${Number(item.price).toFixed(2)}</div>
            <p>${item.description || 'Delicious item!'}</p>
            <button class="add-btn" data-id="${item.id}">
              <i class="ri-add-line"></i> Add to Billing
            </button>
          </div>
        </div>
      `;
    });
    grid.innerHTML = html;
    document.querySelectorAll('.add-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await apiCall('/cart/add', {
            method: 'POST',
            body: JSON.stringify({ menuItemId: btn.dataset.id, quantity: 1 })
          });
          alert('Added to your order!');
        } catch (err) {
          alert('Failed to add item: ' + err.message);
        }
      });
    });
  } catch (err) {
    grid.innerHTML = `<p style="color:#e74c3c;">Error loading favorites: ${err.message}</p>`;
  }
}

let currentOrderId = null;
async function loadCurrentOrderForTracker() {
  try {
    const orders = await apiCall('/customer/orders?status=Preparing,Ready');
    const current = Array.isArray(orders) ? orders.find(o => ['Preparing', 'Ready'].includes(o.status)) : null;
    const trackerPara = document.getElementById('currentOrderText');
    const steps = document.querySelectorAll('.step');
    if (current) {
      currentOrderId = current.orderNumber;
      if (trackerPara) trackerPara.textContent = `#${current.orderNumber}`;
      updateTracker(current.status);
      document.getElementById('trackerTime').textContent = 'Last updated: just now';
    } else {
      if (trackerPara) trackerPara.textContent = 'No active order';
      steps.forEach(s => s.classList.remove('active'));
    }
  } catch (err) {
    console.warn('Could not load current order:', err);
  }
}

function updateTracker(status) {
  const steps = document.querySelectorAll('.step');
  steps.forEach(s => s.classList.remove('active'));
  if (status === 'Preparing') {
    steps[0].classList.add('active');
  } else if (status === 'Ready') {
    steps[1].classList.add('active');
  } else if (status === 'Served' || status === 'Completed') {
    steps[2].classList.add('active');
  }
}

// ===== MENU VIEW =====
async function loadMenuItems() {
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = '<p>Loading menu...</p>';
  try {
    const items = await apiCall('/customer/menu');
    allMenuItems = Array.isArray(items) ? items : [];
    renderMenu('', 'all');
  } catch (err) {
    grid.innerHTML = `<p style="color:#e74c3c;">Error: ${err.message}</p>`;
  }
}

function renderMenu(searchTerm = '', category = 'all') {
  const grid = document.getElementById('menuGrid');
  let filtered = allMenuItems;
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(item =>
      item.name.toLowerCase().includes(term) ||
      (item.description && item.description.toLowerCase().includes(term))
    );
  }
  if (category !== 'all') {
    filtered = filtered.filter(item => item.category === category);
  }
  if (filtered.length === 0) {
    grid.innerHTML = '<p>No items found.</p>';
    return;
  }
  grid.innerHTML = filtered.map(item => {
    const isAvailable = item.isAvailable;
    const unavailableClass = !isAvailable ? 'unavailable' : '';
    return `
      <div class="menu-item-card ${unavailableClass}" data-id="${item.id}">
        <div class="menu-item-image">
          <img src="${item.imageUrl || '/image/placeholder-menu.jpg'}" alt="${item.name}" />
        </div>
        <div class="menu-item-info">
          <div class="menu-item-name">${item.name}</div>
          <div class="menu-item-price">₱${Number(item.price).toFixed(2)}</div>
          <div class="menu-item-actions">
            <small>${item.category}</small>
            <button class="add-to-cart-btn" ${!isAvailable ? 'disabled' : ''}>
              ${isAvailable ? 'Add' : 'Unavailable'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  document.querySelectorAll('.menu-item-card').forEach(card => {
    card.addEventListener('click', () => openItemModal(card.dataset.id));
  });
  document.querySelectorAll('.add-to-cart-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.closest('.menu-item-card').dataset.id;
      const item = allMenuItems.find(i => i.id === id);
      if (item) addToCart(item);
    });
  });
}

function openItemModal(itemId) {
  const item = allMenuItems.find(i => i.id === itemId);
  if (!item) return;

  // Clean up previous customization
  const existing = document.getElementById('customizationOptions');
  if (existing) existing.remove();

  document.getElementById('modalName').textContent = item.name;
  document.getElementById('modalPrice').textContent = `₱${Number(item.price).toFixed(2)}`;
  document.getElementById('modalCategory').textContent = item.category || 'N/A';
  document.getElementById('modalAvailability').textContent = item.isAvailable ? '✅ Available' : '❌ Currently unavailable';

  const ingredientsList = document.getElementById('modalIngredients');
  if (item.ingredients?.length > 0) {
    ingredientsList.innerHTML = item.ingredients.map(ing => {
      const invItem = item.inventoryItems?.find(i => i.id === ing.inventoryItemId);
      const name = invItem ? invItem.name : ing.inventoryItemId;
      return `<li>${name}: ${ing.quantityRequired} ${ing.unit || 'pcs'}</li>`;
    }).join('');
  } else {
    ingredientsList.innerHTML = '<li>No ingredients specified.</li>';
  }

  const modalImage = document.getElementById('modalImage');
  modalImage.src = item.imageUrl || '/image/placeholder-menu.jpg';
  modalImage.alt = item.name;

  const container = document.createElement('div');
  container.id = 'customizationOptions';
  container.className = 'customization-section';

  let html = '';

  // Mood
  if (item.hasMoods && item.moods?.length > 0) {
    html += `<div class="customization-group"><strong>Mood:</strong><div class="options">`;
    html += item.moods.map(mood => {
      const icon = mood === 'Hot' ? '🔥' : '❄️';
      return `<button class="custom-option-btn" data-type="mood" data-value="${mood}">${icon} ${mood}</button>`;
    }).join('');
    html += `</div></div>`;
  }

  // Size
  if (item.hasSizes && item.sizes?.length > 0) {
    html += `<div class="customization-group"><strong>Size:</strong><div class="options">`;
    html += item.sizes.map(size => 
      `<button class="custom-option-btn" data-type="size" data-value="${size}">${size}</button>`
    ).join('');
    html += `</div></div>`;
  }

  // Sugar
  if (item.hasSugarLevels && item.sugarLevels?.length > 0) {
    html += `<div class="customization-group"><strong>Sugar:</strong><div class="options">`;
    html += item.sugarLevels.map(level => 
      `<button class="custom-option-btn" data-type="sugar" data-value="${level}">${level}%</button>`
    ).join('');
    html += `</div></div>`;
  }

  container.innerHTML = html;
  const modalActions = document.querySelector('.modal-actions');
  modalActions.parentNode.insertBefore(container, modalActions);

  // Track selection
  let selected = { mood: '', size: '', sugar: '' };

  document.querySelectorAll('.custom-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Reset all buttons of the same type
      document.querySelectorAll(`.custom-option-btn[data-type="${btn.dataset.type}"]`)
        .forEach(b => b.classList.remove('active'));
      // Activate clicked
      btn.classList.add('active');
      selected[btn.dataset.type] = btn.dataset.value;
    });
  });

  document.getElementById('modalAddToCart').onclick = () => {
    const qty = parseInt(document.getElementById('modalQuantity').value) || 1;
    addToCart(item, qty, selected.size, selected.mood, selected.sugar);
    document.getElementById('itemModal').style.display = 'none';
  };

  document.getElementById('itemModal').style.display = 'block';
}

// ===== CART =====
function addToCart(item, quantity = 1, size = '', mood = '', sugar = '') {
  if (!item.isAvailable) return;
  const existing = cart.find(i => 
    i.id === item.id && i.size === size && i.mood === mood && i.sugar === sugar
  );
  if (existing) {
    existing.quantity += quantity;
  } else {
    cart.push({ ...item, quantity, size, mood, sugar });
  }
  localStorage.setItem('tambayanCart', JSON.stringify(cart));
  updateCartUI();
  alert(`"${item.name}" added to cart!`);
}

function updateCartUI() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('cartCount').textContent = count;
  document.getElementById('cartTotal').textContent = `₱${total.toFixed(2)}`;
  document.getElementById('cartItemCount').textContent = `${count} item${count !== 1 ? 's' : ''}`;
  document.getElementById('checkoutBtn').disabled = count === 0;
}

async function placeOrder() {
  if (cart.length === 0) return;
  const userData = JSON.parse(localStorage.getItem('userData'));
  const orderItems = cart.map(item => ({
    productId: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    size: item.size,
    mood: item.mood,
    sugar: item.sugar
  }));
  const payload = {
    customerId: userData.id,
    customerEmail: userData.email,
    items: orderItems,
    totalAmount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0)
  };
  try {
    await apiCall('/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    alert('Order placed successfully! 🎉');
    cart = [];
    localStorage.setItem('tambayanCart', JSON.stringify(cart));
    updateCartUI();
    showView('dashboard');
  } catch (err) {
    alert('Failed to place order: ' + err.message);
  }
}