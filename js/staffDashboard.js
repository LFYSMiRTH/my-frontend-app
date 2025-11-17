const API_BASE = 'https://tambayan-cafe-backend.onrender.com/api';
let allMenuItems = [];
let currentCategory = 'all';
let cart = JSON.parse(localStorage.getItem('tambayanCart')) || []; // Staff cart for new orders
let newOrderCustomerName = '';
let newOrderTableNumber = '';
document.addEventListener('DOMContentLoaded', () => {
  // ✅ CHECK IF LOGGED IN AS STAFF - Updated to match login.js storage keys
  const token = localStorage.getItem('staffToken'); // ✅ Use 'staffToken' instead of 'token'
  const staffInfo = localStorage.getItem('staffInfo') ? JSON.parse(localStorage.getItem('staffInfo')) : null; // ✅ Parse 'staffInfo'
  const userRole = staffInfo?.role; // ✅ Extract role from staffInfo object
  if (!token || userRole !== 'staff') {
    window.location.href = '/html/login.html';
    return;
  }
  loadStaffProfile();
  loadDashboardStats();
  loadRecentOrders();
  loadOrders(); // This function populates the order list
  loadInventory();
  loadMenu();
  setInterval(loadDashboardStats, 30000); // Refresh every 30 seconds
  // NAVIGATION
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
        // Load My Orders data when the view is shown (if still needed for staff, adjust endpoint)
        // if (view === 'myOrders') {
        //     loadMyOrders();
        // }
      }
    });
  });
  document.querySelector('.logout').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('staffToken'); // ✅ Remove 'staffToken'
    localStorage.removeItem('staffInfo'); // ✅ Remove 'staffInfo'
    window.location.href = '/html/login.html';
  });
  // NOTIFICATIONS
  document.querySelector('.bell').addEventListener('click', async () => {
    try {
      const notifs = await apiCall('/staff/notifications?limit=5');
      if (!notifs || notifs.length === 0) {
        alert('No new notifications.');
        return;
      }
      let msg = '🔔 Notifications:';
      notifs.forEach(n => {
        msg += `• ${n.message} (${new Date(n.createdAt).toLocaleString()})
`;
      });
      alert(msg);
    } catch (err) {
      alert('Failed to load notifications: ' + err.message);
    }
  });
  // MENU SEARCH
  document.getElementById('menuSearch')?.addEventListener('input', (e) => {
    renderMenu(e.target.value, currentCategory);
  });
  // CATEGORY BUTTONS
  document.querySelectorAll('.category-btn')?.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      renderMenu(document.getElementById('menuSearch').value, currentCategory);
    });
  });
  // CHECKOUT BUTTON (for new order)
  document.getElementById('checkoutBtn')?.addEventListener('click', placeOrder);
  // MODAL CLOSE BUTTON
  document.getElementById('closeModal')?.addEventListener('click', closeModal);
  // Close modal if clicked outside the content
  window.onclick = function(event) {
    const modal = document.getElementById('itemModal');
    if (event.target === modal) {
      closeModal();
    }
  }
  // Initialize filter buttons
  document.querySelectorAll('.filter-btn').forEach(button => {
    button.addEventListener('click', function() {
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');
      const filter = this.dataset.filter;
      filterOrders(filter);
    });
  });
  // Initialize event listeners for order management (delegated event listener)
  document.addEventListener('click', function(e) {
    if (e.target.matches('.btn-secondary')) {
      const orderId = e.target.getAttribute('data-order-id');
      const action = e.target.getAttribute('data-action');
      if (action === 'prep') {
        updateOrderStatus(orderId, 'preparing');
      } else if (action === 'serve') {
        updateOrderStatus(orderId, 'ready');
      } else if (action === 'complete') {
        updateOrderStatus(orderId, 'completed');
      } else if (action === 'print') {
        printReceipt(orderId);
      }
    }
  });
});
// ------------------- HELPERS -------------------
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector(`#${viewId}View`)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');
}
// ✅ AUTHORIZED API CALL - Updated to match login.js storage keys
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = localStorage.getItem('staffToken'); // ✅ Use 'staffToken' instead of 'token'
  if (!token) {
    console.log('No staff token found - redirecting to login');
    localStorage.removeItem('staffToken'); // ✅ Remove 'staffToken'
    localStorage.removeItem('staffInfo'); // ✅ Remove 'staffInfo'
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
    localStorage.removeItem('staffToken'); // ✅ Remove 'staffToken'
    localStorage.removeItem('staffInfo'); // ✅ Remove 'staffInfo'
    window.location.href = '/html/login.html';
    throw new Error('Unauthorized');
  }
  // Check for non-OK status codes and handle the error body here
  if (!res.ok) {
    let errorText = `HTTP ${res.status}`; // Default error text
    // Attempt to read the response body *only once* if it's an error
    try {
      // Check if the response has content and is JSON
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const errorJson = await res.json(); // This consumes the stream
        errorText = errorJson.message || JSON.stringify(errorJson);
      } else {
        // If not JSON, try to get text
        const errorTextBody = await res.text(); // This consumes the stream
        errorText = errorTextBody || `HTTP ${res.status}`;
      }
    } catch (e) {
      // If parsing fails, use the status text or a generic message
      console.warn("Could not parse error response body:", e);
      errorText = res.statusText || `HTTP ${res.status}`;
    }
    throw new Error(errorText);
  }
  // If the response is OK, parse the JSON
  return res.json();
}
// ------------------- DASHBOARD -------------------
async function loadStaffProfile() {
  try {
    const token = localStorage.getItem('staffToken'); // ✅ Use 'staffToken' instead of 'token'
    const staffInfo = localStorage.getItem('staffInfo') ? JSON.parse(localStorage.getItem('staffInfo')) : null; // ✅ Parse 'staffInfo'
    const userRole = staffInfo?.role; // ✅ Extract role from staffInfo object
    if (!token || userRole !== 'staff') {
      console.log('Invalid staff token or role - redirecting to login');
      localStorage.removeItem('staffToken'); // ✅ Remove 'staffToken'
      localStorage.removeItem('staffInfo'); // ✅ Remove 'staffInfo'
      window.location.href = '/html/login.html';
      return;
    }
    const staffName = staffInfo?.username || staffInfo?.name || 'Staff'; // ✅ Get name from staffInfo
    document.querySelector('.welcome').textContent = `Welcome back, ${staffName}!`;
  } catch (err) {
    console.error('Error loading staff profile:', err);
    const staffInfo = localStorage.getItem('staffInfo') ? JSON.parse(localStorage.getItem('staffInfo')) : null; // ✅ Parse 'staffInfo'
    const staffName = staffInfo?.username || staffInfo?.name || 'Staff'; // ✅ Get name from staffInfo
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
    const orders = await apiCall('/staff/orders?limit=3');
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
// ------------------- ORDER MANAGEMENT -------------------
async function loadOrders() {
  const ordersList = document.getElementById('orders-list'); // Changed ID to match HTML
  if (!ordersList) return;
  ordersList.innerHTML = '<div class="order-item"><div class="order-info"><p>Loading orders...</p></div></div>';
  try {
    // Fetch ALL orders for the staff to view history, or just active ones?
    // Adjust the endpoint or query parameters as needed.
    // For active orders only: const orders = await apiCall('/staff/orders?status=New,Preparing,Ready');
    const orders = await apiCall('/staff/orders'); // Fetch all orders for history view
    if (!orders || orders.length === 0) {
      ordersList.innerHTML = '<div class="order-item"><div class="order-info"><p>No orders found.</p></div></div>';
      return;
    }
    ordersList.innerHTML = '';
    orders.forEach(order => {
      const orderItem = document.createElement('div');
      orderItem.className = `order-item ${order.status.toLowerCase()}`;
      orderItem.setAttribute('data-order-id', order.id);
      orderItem.setAttribute('data-status', order.status); // Set initial status attribute for filtering
      // Initial HTML structure without buttons in .order-actions
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
          <!-- Buttons will be inserted here dynamically by the if/else block below -->
        </div>
      `;
      // Find the .order-actions div within the newly created orderItem
      const actionButtonsDiv = orderItem.querySelector('.order-actions');
      // Dynamically set the action buttons based on the current status
      // Convert the status to lowercase for comparison
      const statusLower = order.status.toLowerCase();
      if (statusLower === 'new' || statusLower === 'pending') { // ✅ Case-insensitive check for 'New' and 'Pending'
        actionButtonsDiv.innerHTML = `
          <button class="btn-secondary" data-order-id="${order.id}" data-action="prep">🔧 Prep</button>
          <button class="btn-secondary" data-order-id="${order.id}" data-action="print">🖨️ Print</button>
        `;
      } else if (statusLower === 'preparing') { // ✅ Case-insensitive check for 'Preparing'
        actionButtonsDiv.innerHTML = `
          <button class="btn-secondary" data-order-id="${order.id}" data-action="serve">✅ Serve</button>
          <button class="btn-secondary" data-order-id="${order.id}" data-action="print">🖨️ Print</button>
        `;
      } else if (statusLower === 'ready') { // ✅ Case-insensitive check for 'Ready'
        actionButtonsDiv.innerHTML = `
          <button class="btn-secondary" data-order-id="${order.id}" data-action="complete">✅ Complete</button>
          <button class="btn-secondary" data-order-id="${order.id}" data-action="print">🖨️ Print</button>
        `;
      } else if (statusLower === 'completed' || statusLower === 'served') { // ✅ Case-insensitive check for 'Completed' or 'Served'
        actionButtonsDiv.innerHTML = `<span style="color: green;">✅ Completed</span>`;
      } else {
        // For other statuses like 'Cancelled', show no action buttons
        actionButtonsDiv.innerHTML = ``;
      }
      ordersList.appendChild(orderItem);
    });
  } catch (err) {
    console.error("Error in loadOrders:", err); // Log the error for debugging
    ordersList.innerHTML = `<div class="order-item"><div class="order-info"><p style="color:#e74c3c;">Error loading orders: ${err.message}</p></div></div>`;
  }
}
// Function to update order status
async function updateOrderStatus(orderId, newStatus) {
  try {
    await apiCall(`/staff/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus })
    });
    // Update UI
    const row = document.querySelector(`.order-item[data-order-id="${orderId}"]`);
    if (row) {
      // FIX: Update the data-status attribute when status changes
      row.setAttribute('data-status', newStatus);
      const statusBadge = row.querySelector('.order-status .status-badge');
      if (statusBadge) {
          statusBadge.textContent = newStatus;
          statusBadge.className = `status-badge ${newStatus.toLowerCase()}`;
      }
      // Change button based on new status - use case-insensitive check for newStatus
      const actionButtons = row.querySelector('.order-actions');
      if (actionButtons) { // Check if actionButtons exist before trying to modify them
          const newStatusLower = newStatus.toLowerCase(); // Convert newStatus to lowercase for comparison
          if (newStatusLower === 'preparing') { // ✅ Case-insensitive check
            actionButtons.innerHTML = `
              <button class="btn-secondary" data-order-id="${orderId}" data-action="serve">✅ Serve</button>
              <button class="btn-secondary" data-order-id="${orderId}" data-action="print">🖨️ Print</button>
            `;
          } else if (newStatusLower === 'ready') { // ✅ Case-insensitive check
            actionButtons.innerHTML = `
              <button class="btn-secondary" data-order-id="${orderId}" data-action="complete">✅ Complete</button>
              <button class="btn-secondary" data-order-id="${orderId}" data-action="print">🖨️ Print</button>
            `;
          } else if (newStatusLower === 'completed') { // ✅ Case-insensitive check
            actionButtons.innerHTML = `<span style="color: green;">✅ Completed</span>`;
          }
      }
    }
    // Show notification
    alert(`Order ${orderId} updated to ${newStatus}`);
  } catch (err) {
    console.error("Error updating order status:", err); // Log the error
    alert(`Failed to update order status: ${err.message}`);
  }
}
// Function to print receipt
async function printReceipt(orderId) {
  try {
    await apiCall(`/staff/orders/${orderId}/print`, {
      method: 'POST'
    });
    alert(`Receipt for order ${orderId} printed`);
  } catch (err) {
    console.error("Error printing receipt:", err); // Log the error
    alert(`Failed to print receipt: ${err.message}`);
  }
}
// Function to take new order - shows the new order section
function takeNewOrder() {
  // This function is now triggered by the button click in the HTML
  // It's defined here just in case it's needed elsewhere
  document.getElementById('manageOrdersSection').style.display = 'none';
  document.getElementById('newOrderSection').style.display = 'block';
  if (!window.menuLoaded) {
     loadMenuItemsForNewOrder();
     window.menuLoaded = true;
  }
  updateCartUI();
}
// Function to check low stock
async function checkLowStock() {
  try {
    const inventory = await apiCall('/staff/inventory/low-stock');
    if (!inventory || inventory.length === 0) {
      alert('No low stock items found.');
      return;
    }
    let msg = 'Low Stock Items:';
    inventory.forEach(item => {
      msg += `• ${item.name}: ${item.currentStock} units left
`;
    });
    alert(msg);
  } catch (err) {
    console.error("Error checking low stock:", err); // Log the error
    alert(`Failed to check low stock: ${err.message}`);
  }
}
// Function to print all ready orders
async function printAllReadyOrders() {
  try {
    await apiCall('/staff/orders/ready/print-all', {
      method: 'POST'
    });
    alert('All ready orders printed');
  } catch (err) {
    console.error("Error printing all ready orders:", err); // Log the error
    alert(`Failed to print ready orders: ${err.message}`);
  }
}
// ✅ UPDATED FUNCTION: Function to send low stock alert
async function sendLowStockAlert(itemName) {
  try {
    // ✅ PASS THE itemName IN THE REQUEST BODY to the NEW endpoint in OrderController
    await apiCall('/admin/inventory/alert', { // Changed endpoint to match OrderController
      method: 'POST',
      body: JSON.stringify({ itemName })
    });
    alert(`Low stock alert sent for ${itemName}`);
  } catch (err) {
    console.error("Error sending low stock alert:", err); // Log the error
    alert(`Failed to send alert: ${err.message}`);
  }
}
// Function to load inventory
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
    console.error("Error loading inventory:", err); // Log the error
    inventoryList.innerHTML = `<div class="inventory-item"><span style="color:#e74c3c;">Error loading inventory: ${err.message}</span></div>`;
  }
}
// Function to load menu
async function loadMenu() {
  const menuSection = document.querySelector('#menuView .menu-section'); // Target the menu view's section
  if (!menuSection) return;
  menuSection.innerHTML = '<h3>🍽️ Menu Viewing</h3><p>Loading menu...</p>';
  try {
    const menuItems = await apiCall('/product/customer/menu');
    if (!menuItems || menuItems.length === 0) {
      menuSection.innerHTML = '<h3>🍽️ Menu Viewing</h3><p>No menu items found.</p>';
      return;
    }
    // Group by category
    const categories = {};
    menuItems.forEach(item => {
      if (!categories[item.category]) {
        categories[item.category] = [];
      }
      categories[item.category].push(item);
    });
    let menuHTML = '<h3>🍽️ Menu Viewing</h3>';
    for (const [category, items] of Object.entries(categories)) {
      menuHTML += `<div class="menu-category">
        <h4>${category}</h4>`;
      items.forEach(item => {
        const stockStatus = item.isAvailable ? 'in-stock' : (item.stockQuantity < 5 ? 'low-stock' : 'out-of-stock');
        const stockText = item.isAvailable ? 'In Stock' : (item.stockQuantity < 5 ? 'Low Stock' : 'Out of Stock');
        menuHTML += `
          <div class="menu-item">
            <span>${item.name} - ₱${Number(item.price).toFixed(2)}</span>
            <span class="stock-status ${stockStatus}">${stockText}</span>
          </div>
        `;
      });
      menuHTML += '</div>';
    }
    menuSection.innerHTML = menuHTML;
  } catch (err) {
    console.error("Error loading menu:", err); // Log the error
    menuSection.innerHTML = `<h3>🍽️ Menu Viewing</h3><p style="color:#e74c3c;">Error loading menu: ${err.message}</p>`;
  }
}
// ------------------- MENU -------------------
async function loadMenuItems() {
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = '<p>Loading menu...</p>';
  try {
    // ✅ FIXED: Use enriched endpoint + no trailing space
    const items = await apiCall('/product/customer/menu');
    allMenuItems = Array.isArray(items) ? items : [];
    renderMenu('', 'all');
  } catch (err) {
    console.error("Error loading menu items:", err); // Log the error
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
    // Removed the inline customization HTML for drinks
    return `
      <div class="menu-item-card ${!item.isAvailable ? 'unavailable' : ''}" data-id="${item.id}">
        <div class="product-image">
          <img src="${item.imageUrl || '/image/placeholder-menu.jpg'}" alt="${item.name}" />
        </div>
        <div class="product-details">
          <div class="product-name">${item.name}</div>
          <div class="product-description">${item.description || 'Delicious item!'}</div>
          <div class="product-price">₱${Number(item.price).toFixed(2)}</div>
          <!-- Removed customization rows from here -->
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
  // Add event listeners for clicking on the menu item card to open the modal
  document.querySelectorAll('.menu-item-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // Prevent the click from propagating to the "Add to Billing" button if they click the card itself
      if (e.target === card || e.target.closest('.product-details')) {
        const itemId = card.dataset.id;
        const item = allMenuItems.find(i => i.id === itemId);
        if (item) {
          openItemModal(item);
        }
      }
    });
  });
  // Add event listeners for the "Add to Billing" buttons (for direct add without modal)
  document.querySelectorAll('.add-to-billing-btn-large').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent triggering the card click event
      const item_id = btn.dataset.id;
      const item = allMenuItems.find(i => i.id === item_id);
      if (item) {
        // Instead of adding to cart directly, open the modal
        openItemModal(item);
      }
    });
  });
}
// Function to open the modal and populate it with item details (for adding to new order)
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
  // Set item details
  modalImage.src = item.imageUrl || '/image/placeholder-menu.jpg';
  modalName.textContent = item.name;
  modalPrice.textContent = `₱${Number(item.price).toFixed(2)}`;
  modalCategory.textContent = item.category;
  // Clear previous ingredients list
  modalIngredients.innerHTML = '';
  // ✅ FIXED: Safely render ingredient names from new enriched API
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
    // Fallback if no ingredients array exists
    modalIngredients.innerHTML = '<li>Details not available</li>';
  }
  // Set availability status
  if (item.isAvailable) {
    modalAvailability.textContent = 'Available';
    modalAvailability.style.color = '#4CAF50'; // Green
    modalAvailability.style.fontWeight = 'bold';
    modalAddToCart.disabled = false;
  } else {
    modalAvailability.textContent = 'Currently Unavailable';
    modalAvailability.style.color = '#E53E3E'; // Red
    modalAvailability.style.fontWeight = 'bold';
    modalAddToCart.disabled = true;
  }
  // Reset the quantity input
  modalQuantity.value = '1';
  // Set up customization buttons in the modal (only for drinks)
  // Initialize default selections for the modal
  let selectedMood = 'Hot';
  let selectedSize = 'M';
  let selectedSugar = '50%';
  // Only show and set up customization if the item is a drink
  const customizationSection = document.querySelector('.customization-section');
  if (item.category === 'Drinks') {
    customizationSection.style.display = 'block'; // Show customization
    // Add event listeners to customization buttons
    document.querySelectorAll('.custom-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.target.dataset.type;
        const value = e.target.dataset.value;
        // Remove active class from all buttons of the same type
        document.querySelectorAll(`.custom-option-btn[data-type="${type}"]`).forEach(b => {
          b.classList.remove('active');
        });
        // Add active class to the clicked button
        e.target.classList.add('active');
        // Update the selected value
        if (type === 'mood') selectedMood = value;
        else if (type === 'size') selectedSize = value;
        else if (type === 'sugar') selectedSugar = value;
      });
    });
    // Set default active states for the modal buttons
    document.querySelector(`.custom-option-btn[data-type="mood"][data-value="${selectedMood}"]`).classList.add('active');
    document.querySelector(`.custom-option-btn[data-type="size"][data-value="${selectedSize}"]`).classList.add('active');
    document.querySelector(`.custom-option-btn[data-type="sugar"][data-value="${selectedSugar}"]`).classList.add('active');
  } else {
    // Hide customization section for non-drinks
    customizationSection.style.display = 'none';
  }
  // Set up the "Add to Billing" button in the modal
  modalAddToCart.onclick = () => {
    if (!item.isAvailable) {
      alert("This item is currently unavailable.");
      return;
    }
    const quantity = parseInt(modalQuantity.value) || 1;
    // Use selected customizations if it's a drink, otherwise use defaults or empty strings
    const sizeToUse = item.category === 'Drinks' ? selectedSize : '';
    const moodToUse = item.category === 'Drinks' ? selectedMood : '';
    const sugarToUse = item.category === 'Drinks' ? selectedSugar : '';
    addToCart(item, quantity, sizeToUse, moodToUse, sugarToUse);
    // Close the modal after adding to cart
    closeModal();
  };
  // Show the modal
  modal.style.display = 'block';
}
// Function to close the modal
function closeModal() {
  const modal = document.getElementById('itemModal');
  modal.style.display = 'none';
  // Also remove active classes from modal buttons to reset them for next time
  document.querySelectorAll('.custom-option-btn').forEach(btn => btn.classList.remove('active'));
}
// ------------------- CART (for new orders) -------------------
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
// Function to place the new order created in the cart
async function placeOrder() {
  if (cart.length === 0) {
      alert("Cannot place an empty order.");
      return;
  }
  // Use the customer name and table number entered, or default to staff ID if not provided
  const customerName = newOrderCustomerName || 'Walk-in Customer'; // Or get from input field
  const tableNumber = newOrderTableNumber || 'N/A'; // Or get from input field
  const orderItems = cart.map(item => ({
    productId: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    size: item.size,
    mood: item.mood,
    sugar: item.sugar
  }));
  // Create a payload specific to staff placing an order for a customer
  // This might require a different backend endpoint or logic to handle staff-placed orders
  // For now, assuming the existing /orders endpoint can handle this if given customer details
  const payload = {
    // customerId: customerInfo.id, // Not applicable for staff-created order
    customerName: customerName, // Use the name entered
    tableNumber: tableNumber, // Use the table number entered
    items: orderItems,
    totalAmount: cart.reduce((sum, item) => sum + (item.price * item.quantity), 0),
    placedByStaff: true, // Optional flag to indicate staff placed it
    staffId: JSON.parse(localStorage.getItem('staffInfo'))?.id // Optional: link to staff who placed it
  };
  try {
    const result = await apiCall('/orders', { // Use the standard order creation endpoint
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, // Ensure correct header
      body: JSON.stringify(payload)
    });
    alert('New order placed successfully! 🎉');
    // Clear the cart and reset inputs
    cart = [];
    localStorage.removeItem('tambayanCart');
    newOrderCustomerName = '';
    newOrderTableNumber = '';
    document.getElementById('customerNameInput').value = '';
    document.getElementById('customerTableInput').value = '';
    updateCartUI();
    // Optionally switch back to the manage orders view
    document.getElementById('newOrderSection').style.display = 'none';
    document.getElementById('manageOrdersSection').style.display = 'block';
    // Reload orders to show the new one
    loadOrders();
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
    const notifications = await apiCall('/staff/notifications?limit=10'); // Fetch more for the list view
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
    console.error("Error loading notifications:", err); // Log the error
    notificationsList.innerHTML = `<div class="notification-item"><p style="color:#e74c3c;">Error loading notifications: ${err.message}</p></div>`;
  }
}
// Function to load profile (example implementation)
async function loadProfile() {
  const profileInfo = document.getElementById('profile-info');
  if (!profileInfo) return;
  try {
    const profile = await apiCall('/staff/profile'); // Assuming you have this endpoint
    profileInfo.innerHTML = `
      <h3>Profile Information</h3>
      <p><strong>Name:</strong> ${profile.name || profile.username}</p>
      <p><strong>Email:</strong> ${profile.email}</p>
      <p><strong>Role:</strong> ${profile.role}</p>
      <!-- Add more profile fields as needed -->
    `;
  } catch (err) {
    console.error("Error loading profile:", err); // Log the error
    profileInfo.innerHTML = `<p style="color:#e74c3c;">Error loading profile: ${err.message}</p>`;
  }
}
// Function to filter orders
function filterOrders(filter) {
  const rows = document.querySelectorAll('.order-item');
  rows.forEach(row => {
    // FIX: Use getAttribute to check the data-status attribute
    if (filter === 'all' || row.getAttribute('data-status') === filter) {
      row.style.display = 'flex'; // Ensure it displays as a flex container like .order-item
    } else {
      row.style.display = 'none';
    }
  });
}
// Placeholder for toggleProfileDropdown if needed
function toggleProfileDropdown() {
  // Implement dropdown toggle logic if needed
  console.log("Profile dropdown toggle clicked");
}