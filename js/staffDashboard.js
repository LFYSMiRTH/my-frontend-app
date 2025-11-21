const API_BASE = 'https://tambayan-cafe-backend.onrender.com/api';
let allMenuItems = [];
let currentCategory = 'all';
let cart = JSON.parse(localStorage.getItem('tambayanCart')) || [];
let newOrderCustomerName = '';
let newOrderTableNumber = '';
let currentFilter = 'New'; // Track the current filter

document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM fully loaded and parsed.");

  const token = localStorage.getItem('staffToken');
  const staffInfo = localStorage.getItem('staffInfo') ? JSON.parse(localStorage.getItem('staffInfo')) : null;
  const userRole = staffInfo?.role;
  if (!token || userRole !== 'staff') {
    console.log('Invalid staff token or role - redirecting to login');
    localStorage.removeItem('staffToken');
    localStorage.removeItem('staffInfo');
    window.location.href = '/html/login.html';
    return;
  }

  loadStaffProfile();
  loadDashboardStats();
  loadRecentOrders();
  loadOrders('New'); // Load orders with explicit filter
  loadInventory();
  loadMenu();
  setInterval(loadDashboardStats, 30000);

  document.querySelectorAll('.nav-item:not(.logout)').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.dataset.view;
      if (view) {
        showView(view);
        if (view === 'Menu' && !window.menuLoaded) {
          loadMenu();
          window.menuLoaded = true;
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
      const notifs = await apiCall('/staff/notifications?limit=5');
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

  // Add event listener for profile icon click
  document.querySelector('.profile-dropdown-trigger')?.addEventListener('click', toggleProfileDropdown);

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
  document.getElementById('closeModal')?.addEventListener('click', closeModal);

  window.onclick = function(event) {
    const modal = document.getElementById('itemModal');
    if (event.target === modal) {
      closeModal();
    }

    // Close profile dropdown if clicked outside
    const dropdown = document.getElementById('profile-dropdown');
    const trigger = document.querySelector('.profile-dropdown-trigger');
    if (dropdown && !dropdown.contains(event.target) && !trigger.contains(event.target)) {
      dropdown.style.display = 'none';
    }
  };

  // Debugging: Log all filter buttons on page load
  const filterButtons = document.querySelectorAll('.filter-btn');
  console.log(`Found ${filterButtons.length} filter buttons.`);
  filterButtons.forEach((btn, index) => {
    console.log(`Button ${index}:`, btn.textContent.trim(), '- data-filter:', btn.dataset.filter);
  });

  // Attach event listeners to filter buttons
  document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', function() {
      console.log('--- Filter Button Clicked ---');
      console.log('Clicked button text:', this.textContent.trim());
      console.log('Clicked button data-filter:', this.dataset.filter);
      console.log('Current active tab before change:', document.querySelector('.filter-btn.active')?.textContent.trim());

      // Remove active class from all buttons
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      // Add active class to the clicked button
      this.classList.add('active');

      const filter = this.dataset.filter;
      currentFilter = filter; // Update the global filter variable
      console.log('Setting currentFilter to:', filter);

      // Call loadOrders with the new filter
      console.log('Calling loadOrders with filter:', filter);
      loadOrders(filter); // Reload orders for the new filter
    });
  });

  document.addEventListener('click', function(e) {
    if (e.target.matches('.btn-secondary')) {
      const orderId = e.target.getAttribute('data-order-id');
      const action = e.target.getAttribute('data-action');
      console.log(`Action button clicked for Order ID: ${orderId}, Action: ${action}`);
      if (action === 'prep') {
        updateOrderStatus(orderId, 'Preparing');
      } else if (action === 'serve') {
        updateOrderStatus(orderId, 'Ready');
      } else if (action === 'complete') {
        updateOrderStatus(orderId, 'Served');
      } else if (action === 'print') {
        printReceipt(orderId);
      }
    }
  });
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
    console.log('No staff token found - redirecting to login');
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
    console.log('Unauthorized access - redirecting to login');
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
      console.warn("Could not parse error response body:", e);
      errorText = res.statusText || `HTTP ${res.status}`;
    }
    throw new Error(errorText);
  }
  return res.json();
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    console.log(`Updating order ${orderId} to status: ${newStatus}`);
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
              <button class="btn-secondary" data-order-id="${orderId}" data-action="serve">✅ Serve</button>
              <button class="btn-secondary" data-order-id="${orderId}" data-action="print">🖨️ Print</button>
            `;
          } else if (newStatusLower === 'ready') {
            actionButtons.innerHTML = `
              <button class="btn-secondary" data-order-id="${orderId}" data-action="complete">✅ Complete</button>
              <button class="btn-secondary" data-order-id="${orderId}" data-action="print">🖨️ Print</button>
            `;
          } else if (newStatusLower === 'completed' || newStatusLower === 'served') {
            actionButtons.innerHTML = `<span style="color: green;">✅ Completed</span>`;
          }
      }
    }
    alert(`Order ${orderId} updated to ${newStatus}`);

    // ✅ ADD THIS LINE TO REFRESH THE CURRENT TAB
    loadOrders(currentFilter);

  } catch (err) {
    console.error("Error updating order status:", err);
    alert(`Failed to update order status: ${err.message}`);
  }
}

async function loadStaffProfile() {
  try {
    const token = localStorage.getItem('staffToken');
    const staffInfo = localStorage.getItem('staffInfo') ? JSON.parse(localStorage.getItem('staffInfo')) : null;
    const userRole = staffInfo?.role;
    if (!token || userRole !== 'staff') {
      console.log('Invalid staff token or role - redirecting to login');
      localStorage.removeItem('staffToken');
      localStorage.removeItem('staffInfo');
      window.location.href = '/html/login.html';
      return;
    }
    const staffName = staffInfo?.username || staffInfo?.name || 'Staff';
    document.querySelector('.welcome').textContent = `Welcome back, ${staffName}!`;
  } catch (err) {
    console.error('Error loading staff profile:', err);
    const staffInfo = localStorage.getItem('staffInfo') ? JSON.parse(localStorage.getItem('staffInfo')) : null;
    const staffName = staffInfo?.username || staffInfo?.name || 'Staff';
    document.querySelector('.welcome').textContent = `Welcome back, ${staffName}!`;
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
    // CHANGED: Updated endpoint to avoid conflict
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

// Updated loadOrders function with explicit status mapping and enhanced debugging
async function loadOrders(filter) {
  console.log('--- loadOrders function called ---');
  console.log('Filter parameter received:', filter);
  const ordersList = document.getElementById('orders-list');
  if (!ordersList) {
    console.error('Element with id "orders-list" not found!');
    return;
  }

  // Clear the list and show loading state
  ordersList.innerHTML = '<div class="order-item"><div class="order-info"><p>Loading orders...</p></div></div>';

  try {
    // Construct the API endpoint with the filter
    let endpoint = '/orders/staff';
    if (filter && filter !== 'all') {
      // Map the UI tab names to the backend status values (case-sensitive)
      let statusParam = '';
      switch (filter.toLowerCase()) { // Use lower case for comparison
        case 'new':
          statusParam = 'New';
          break;
        case 'preparing':
          statusParam = 'Preparing';
          break;
        case 'ready':
          statusParam = 'Ready';
          break;
        case 'complete': // The UI tab says "Complete"
        case 'completed': // Backend status might be "Completed"
        case 'served':    // Or might include "Served"
          statusParam = 'Completed,Served'; // Backend expects these statuses
          break;
        default:
          statusParam = filter; // Fallback, might be correct for other statuses
          break;
      }

      if (statusParam) {
         endpoint += `?status=${statusParam}`;
         console.log(`Constructed endpoint: ${endpoint}`); // Log the final endpoint
      } else {
        console.log('No statusParam generated for filter:', filter);
      }
    } else {
      console.log('No filter applied, fetching all orders.');
    }

    console.log('Making API call to:', endpoint);
    const orders = await apiCall(endpoint);
    console.log('API call successful. Orders received:', orders.length, 'orders');
    console.log('First order (if any):', orders[0] ? orders[0].status : 'None');

    if (!orders || orders.length === 0) {
      console.log('No orders found for filter:', filter);
      ordersList.innerHTML = '<div class="order-item"><div class="order-info"><p>No orders found.</p></div></div>';
      return;
    }

    // Clear the list before adding new items
    ordersList.innerHTML = '';

    orders.forEach(order => {
      console.log(`Processing order: #${order.orderNumber}, Status: ${order.status}`);
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
        <div class="order-actions">
        </div>
      `;
      const actionButtonsDiv = orderItem.querySelector('.order-actions');
      const statusLower = order.status.toLowerCase();
      if (statusLower === 'new' || statusLower === 'pending') {
        actionButtonsDiv.innerHTML = `
          <button class="btn-secondary" data-order-id="${order.id}" data-action="prep">🔧 Prep</button>
          <button class="btn-secondary" data-order-id="${order.id}" data-action="print">🖨️ Print</button>
        `;
      } else if (statusLower === 'preparing') {
        actionButtonsDiv.innerHTML = `
          <button class="btn-secondary" data-order-id="${order.id}" data-action="serve">✅ Serve</button>
          <button class="btn-secondary" data-order-id="${order.id}" data-action="print">🖨️ Print</button>
        `;
      } else if (statusLower === 'ready') {
        actionButtonsDiv.innerHTML = `
          <button class="btn-secondary" data-order-id="${order.id}" data-action="complete">✅ Complete</button>
          <button class="btn-secondary" data-order-id="${order.id}" data-action="print">🖨️ Print</button>
        `;
      } else if (statusLower === 'completed' || statusLower === 'served') {
        actionButtonsDiv.innerHTML = `<span style="color: green;">✅ Completed</span>`;
      } else {
        actionButtonsDiv.innerHTML = ``;
      }
      ordersList.appendChild(orderItem);
    });

    console.log('Finished rendering orders for filter:', filter);
  } catch (err) {
    console.error("Error in loadOrders:", err);
    ordersList.innerHTML = `<div class="order-item"><div class="order-info"><p style="color:#e74c3c;">Error loading orders: ${err.message}</p></div></div>`;
  }
}

async function printReceipt(orderId) {
  try {
    await apiCall(`/staff/orders/${orderId}/print`, {
      method: 'POST'
    });
    alert(`Receipt for order ${orderId} printed`);
  } catch (err) {
    console.error("Error printing receipt:", err);
    alert(`Failed to print receipt: ${err.message}`);
  }
}

function takeNewOrder() {
  document.getElementById('manageOrdersSection').style.display = 'none';
  document.getElementById('newOrderSection').style.display = 'block';
  if (!window.menuLoaded) {
     loadMenuItemsForNewOrder();
     window.menuLoaded = true;
  }
  updateCartUI();
}

async function checkLowStock() {
  try {
    const inventory = await apiCall('/staff/inventory/low-stock');
    if (!inventory || inventory.length === 0) {
      alert('No low stock items found.');
      return;
    }
    let msg = 'Low Stock Items:';
    inventory.forEach(item => {
      msg += `• ${item.name}: ${item.currentStock} units left\n`;
    });
    alert(msg);
  } catch (err) {
    console.error("Error checking low stock:", err);
    alert(`Failed to check low stock: ${err.message}`);
  }
}

async function printAllReadyOrders() {
  try {
    await apiCall('/staff/orders/ready/print-all', {
      method: 'POST'
    });
    alert('All ready orders printed');
  } catch (err) {
    console.error("Error printing all ready orders:", err);
    alert(`Failed to print ready orders: ${err.message}`);
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
    console.error("Error sending low stock alert:", err);
    alert(`Failed to send alert: ${err.message}`);
  }
}

async function loadInventory() {
  const inventoryList = document.getElementById('inventory-list');
  if (!inventoryList) return;
  inventoryList.innerHTML = '<div class="inventory-item"><span>Loading inventory...</span></div>';
  try {
    const inventory = await apiCall('/staff/inventory');
    if (!inventory || inventory.length === 0) {
      inventoryList.innerHTML = '<div class="inventory-item"><span>No inventory found.</span></div>';
      return;
    }
    inventoryList.innerHTML = '';
    inventory.forEach(item => {
      const inventoryItem = document.createElement('div');
      inventoryItem.className = 'inventory-item';
      inventoryItem.innerHTML = `
        <span>${item.name}</span>
        <span>Stock: ${item.currentStock} units</span>
        <button class="btn-warning" onclick="sendLowStockAlert('${item.name}')">❗ Alert Admin</button>
      `;
      inventoryList.appendChild(inventoryItem);
    });
  } catch (err) {
    console.error("Error loading inventory:", err);
    inventoryList.innerHTML = `<div class="inventory-item"><span style="color:#e74c3c;">Error loading inventory: ${err.message}</span></div>`;
  }
}

async function loadMenu() {
  const menuSection = document.querySelector('#MenuView .menu-section');
  if (!menuSection) return;

  menuSection.innerHTML = '<h3>🍽️ Menu Viewing</h3><p>Loading menu...</p>';

  try {
    const menuItems = await apiCall('/product/staff/menu');

    if (!menuItems || !Array.isArray(menuItems)) {
      menuSection.innerHTML = '<h3>🍽️ Menu Viewing</h3><p>Error: Invalid data received from server.</p>';
      return;
    }

    if (menuItems.length === 0) {
      menuSection.innerHTML = '<h3>🍽️ Menu Viewing</h3><p>No products found in the database.</p>';
      return;
    }

    const categories = {};
    for (let i = 0; i < menuItems.length; i++) {
      const item = menuItems[i];
      if (!item) {
        continue;
      }

      const category = item.category || item.Category || 'Uncategorized';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(item);
    }

    let menuHTML = '<h3>🍽️ Menu Viewing</h3>';
    for (const [category, items] of Object.entries(categories)) {
      menuHTML += `<div class="menu-category">
        <h4>${category}</h4>
        <div class="menu-grid">`;
      for (let j = 0; j < items.length; j++) {
        const item = items[j];
        if (!item) {
          continue;
        }

        const isAvailable = item.isAvailable !== undefined ? item.isAvailable : (item.IsAvailable !== undefined ? item.IsAvailable : false);
        const stockQuantity = item.stockQuantity !== undefined ? item.stockQuantity : (item.StockQuantity !== undefined ? item.StockQuantity : 0);
        const name = item.name !== undefined ? item.name : (item.Name !== undefined ? item.Name : 'Unknown Item');
        const price = item.price !== undefined ? item.price : (item.Price !== undefined ? item.Price : 0);
        const imageUrl = item.imageUrl !== undefined ? item.imageUrl : '/image/placeholder-menu.jpg';

        const stockStatus = isAvailable ? 'in-stock' : (stockQuantity < 5 ? 'low-stock' : 'out-of-stock');
        const stockText = isAvailable ? 'In Stock' : (stockQuantity < 5 ? 'Low Stock' : 'Out of Stock');

        menuHTML += `
          <div class="menu-item-card ${!isAvailable ? 'unavailable' : ''}">
            <img src="${imageUrl}" alt="${name}" onerror="this.onerror=null; this.src='/image/placeholder-menu.jpg';">
            <div class="menu-item-details">
              <h5>${name}</h5>
              <p>₱${Number(price).toFixed(2)}</p>
              <span class="stock-status ${stockStatus}">${stockText}</span>
            </div>
          </div>
        `;
      }
      menuHTML += `</div></div>`;
    }

    menuSection.innerHTML = menuHTML;

  } catch (err) {
    console.error("Error in loadMenu:", err);
    menuSection.innerHTML = `
      <h3>🍽️ Menu Viewing</h3>
      <p style="color:#e74c3c; font-weight:bold;">Failed to load menu: ${err.message}</p>
      <p>Please check browser console for details.</p>
    `;
  }
}

async function loadMenuItems() {
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = '<p>Loading menu...</p>';
  try {
    const items = await apiCall('/product/staff/menu');
    allMenuItems = Array.isArray(items) ? items : [];
    renderMenu('', 'all');
  } catch (err) {
    console.error("Error loading menu items:", err);
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
  if (category !== 'all') filtered = filtered.filter(item => item.category === category);
  if (filtered.length === 0) { grid.innerHTML = '<p>No items found.</p>'; return; }
  grid.innerHTML = filtered.map(item => {
    return `
      <div class="menu-item-card ${!item.isAvailable ? 'unavailable' : ''}" data-id="${item.id}">
        <div class="product-image">
          <img src="${item.imageUrl || '/image/placeholder-menu.jpg'}" alt="${item.name}" />
        </div>
        <div class="product-details">
          <div class="product-name">${item.name}</div>
          <div class="product-description">${item.description || 'Delicious item!'}</div>
          <div class="product-price">₱${Number(item.price).toFixed(2)}</div>
          <div class="action-row">
            <input type="number" class="quantity-input-small" value="1" min="1" data-item-id="${item.id}">
            <button class="add-to-billing-btn-large" data-id="${item.id}" ${!item.isAvailable ? 'disabled' : ''}>
              <i class="ri-add-line"></i> Add to Billing
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
  document.querySelectorAll('.menu-item-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target === card || e.target.closest('.product-details')) {
        const itemId = card.dataset.id;
        const item = allMenuItems.find(i => i.id === itemId);
        if (item) {
          openItemModal(item);
        }
      }
    });
  });
  document.querySelectorAll('.add-to-billing-btn-large').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const item_id = btn.dataset.id;
      const item = allMenuItems.find(i => i.id === item_id);
      if (item) {
        openItemModal(item);
      }
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
  const modalQuantity = document.getElementById('modalQuantity');
  const modalAddToCart = document.getElementById('modalAddToCart');
  modalImage.src = item.imageUrl || '/image/placeholder-menu.jpg';
  modalName.textContent = item.name;
  modalPrice.textContent = `₱${Number(item.price).toFixed(2)}`;
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
  modalQuantity.value = '1';
  const customizationSection = document.querySelector('.customization-section');
  if (item.category === 'Drinks') {
    customizationSection.style.display = 'block';
    document.querySelectorAll('.custom-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        const value = e.target.dataset.value;
        document.querySelectorAll(`.custom-option-btn[data-type="${type}"]`).forEach(b => {
          b.classList.remove('active');
        });
        e.target.classList.add('active');
        if (type === 'mood') selectedMood = value;
        else if (type === 'size') selectedSize = value;
        else if (type === 'sugar') selectedSugar = value;
      });
    });
    document.querySelector(`.custom-option-btn[data-type="mood"][data-value="${selectedMood}"]`).classList.add('active');
    document.querySelector(`.custom-option-btn[data-type="size"][data-value="${selectedSize}"]`).classList.add('active');
    document.querySelector(`.custom-option-btn[data-type="sugar"][data-value="${selectedSugar}"]`).classList.add('active');
  } else {
    customizationSection.style.display = 'none';
  }
  modalAddToCart.onclick = () => {
    if (!item.isAvailable) {
      alert("This item is currently unavailable.");
      return;
    }
    const quantity = parseInt(modalQuantity.value) || 1;
    const sizeToUse = item.category === 'Drinks' ? selectedSize : '';
    const moodToUse = item.category === 'Drinks' ? selectedMood : '';
    const sugarToUse = item.category === 'Drinks' ? selectedSugar : '';
    addToCart(item, quantity, sizeToUse, moodToUse, sugarToUse);
    closeModal();
  };
  modal.style.display = 'block';
}

function closeModal() {
  const modal = document.getElementById('itemModal');
  modal.style.display = 'none';
  document.querySelectorAll('.custom-option-btn').forEach(btn => btn.classList.remove('active'));
}

function addToCart(item, quantity = 1, size = 'M', mood = 'Hot', sugar = '50%') {
  if (!item.isAvailable) {
    alert("This item is currently unavailable.");
    return;
  }
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
      quantity,
      size,
      mood,
      sugar
    });
  }
  localStorage.setItem('tambayanCart', JSON.stringify(cart));
  updateCartUI();
  alert(`"${item.name}" (Mood: ${mood || 'N/A'}, Size: ${size || 'N/A'}, Sugar: ${sugar || 'N/A'}) added to order!`);
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
    size: item.size,
    mood: item.mood,
    sugar: item.sugar
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
    alert('New order placed successfully! 🎉');
    cart = [];
    localStorage.removeItem('tambayanCart');
    newOrderCustomerName = '';
    newOrderTableNumber = '';
    document.getElementById('customerNameInput').value = '';
    document.getElementById('customerTableInput').value = '';
    updateCartUI();
    document.getElementById('newOrderSection').style.display = 'none';
    document.getElementById('manageOrdersSection').style.display = 'block';
    loadOrders(currentFilter); // Reload the orders after placing a new one
  } catch (err) {
    console.error('Failed to place new order:', err);
    alert('Failed to place new order: ' + (err.message || 'Unknown error'));
  }
}

async function loadNotifications() {
  const notificationsList = document.getElementById('notifications-list');
  if (!notificationsList) return;
  notificationsList.innerHTML = '<div class="notification-item"><p>Loading notifications...</p></div>';
  try {
    const notifications = await apiCall('/staff/notifications?limit=10');
    if (!notifications || notifications.length === 0) {
      notificationsList.innerHTML = '<div class="notification-item"><p>No notifications.</p></div>';
      return;
    }
    notificationsList.innerHTML = '';
    notifications.forEach(notification => {
      const notificationItem = document.createElement('div');
      notificationItem.className = 'notification-item';
      notificationItem.innerHTML = `
        <p>${notification.message}</p>
        <small>${new Date(notification.createdAt).toLocaleString()}</small>
      `;
      notificationsList.appendChild(notificationItem);
    });
  } catch (err) {
    console.error("Error loading notifications:", err);
    notificationsList.innerHTML = `<div class="notification-item"><p style="color:#e74c3c;">Error loading notifications: ${err.message}</p></div>`;
  }
}

async function loadProfile() {
  const profileInfo = document.getElementById('profile-info');
  if (!profileInfo) return;
  try {
    const profile = await apiCall('/staff/profile');
    profileInfo.innerHTML = `
      <h3>Profile Information</h3>
      <p><strong>Name:</strong> ${profile.name || profile.username}</p>
      <p><strong>Email:</strong> ${profile.email}</p>
      <p><strong>Role:</strong> ${profile.role}</p>
    `;
  } catch (err) {
    console.error("Error loading profile:", err);
    profileInfo.innerHTML = `<p style="color:#e74c3c;">Error loading profile: ${err.message}</p>`;
  }
}
function toggleProfileDropdown() {
    console.log("Profile dropdown toggle clicked");
    
    const dropdown = document.getElementById('profile-dropdown');
    const trigger = document.querySelector('.profile-dropdown-trigger');
    
    console.log("Dropdown element found:", dropdown !== null);
    console.log("Trigger element found:", trigger !== null);
    
    if (dropdown) {
        console.log("Current dropdown display style:", dropdown.style.display);
        console.log("Current dropdown classes:", dropdown.className);
        console.log("Dropdown computed style:", window.getComputedStyle(dropdown).display);
        
        // Check if it's currently visible
        const isVisible = dropdown.style.display === 'block' || dropdown.classList.contains('show');
        console.log("Dropdown is currently visible:", isVisible);
        
        if (isVisible) {
            // Hide it
            dropdown.style.display = 'none';
            dropdown.classList.remove('show');
            console.log("Hiding dropdown");
        } else {
            // Show it
            dropdown.style.display = 'block';
            dropdown.classList.add('show');
            console.log("Showing dropdown");
        }
    } else {
        console.error("Profile dropdown element not found!");
    }
}

// Function to handle "View Staff Account"
async function viewStaffAccount() {
  try {
    const profile = await apiCall('/staff/profile');
    const message = `
      Name: ${profile.name || profile.username}
      Email: ${profile.email}
      Role: ${profile.role}
      ID: ${profile.id}
    `;
    alert(message);
  } catch (err) {
    alert(`Failed to load profile: ${err.message}`);
  }
}

// Function to handle "Change Password"
function showChangePasswordForm() {
  const modal = document.createElement('div');
  modal.id = 'change-password-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Change Password</h3>
      <div>
        <label>Current Password:</label>
        <input type="password" id="currentPassword" />
      </div>
      <div>
        <label>New Password:</label>
        <input type="password" id="newPassword" />
      </div>
      <div>
        <label>Confirm New Password:</label>
        <input type="password" id="confirmPassword" />
      </div>
      <div class="button-group">
        <button class="cancel-btn" onclick="closeChangePasswordForm()">Cancel</button>
        <button class="submit-btn" onclick="changePassword()">Change</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

// Function to close the change password form
function closeChangePasswordForm() {
  const modal = document.getElementById('change-password-modal');
  if (modal) {
    document.body.removeChild(modal);
  }
}

// Function to actually change the password
async function changePassword() {
  const currentPassword = document.getElementById('currentPassword').value.trim();
  const newPassword = document.getElementById('newPassword').value.trim();
  const confirmPassword = document.getElementById('confirmPassword').value.trim();

  if (!currentPassword || !newPassword || !confirmPassword) {
    alert('Please fill in all fields.');
    return;
  }

  if (newPassword !== confirmPassword) {
    alert('New passwords do not match.');
    return;
  }

  try {
    const response = await apiCall('/staff/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword,
        newPassword
      })
    });
    alert('Password changed successfully!');
    closeChangePasswordForm();
  } catch (err) {
    alert(`Failed to change password: ${err.message}`);
  }
}