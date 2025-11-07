const API_BASE = 'https://tambayan-cafe-backend.onrender.com/api';
let allMenuItems = [];
let cart = JSON.parse(localStorage.getItem('tambayanCart')) || [];
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
  // ✅ CHECK IF LOGGED IN AS CUSTOMER
  const customerToken = localStorage.getItem('customerToken');
  if (!customerToken) {
    window.location.href = '/html/login.html';
    return;
  }
  loadCustomerProfile();
  loadRecentOrders();
  loadFavorites();
  loadCurrentOrderForTracker();
  setInterval(loadCurrentOrderForTracker, 10000);

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
        // Load My Orders data when the view is shown
        if (view === 'myOrders') {
            loadMyOrders();
        }
      }
    });
  });

  document.querySelector('.logout').addEventListener('click', (e) => {
    e.preventDefault();
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerInfo');
    localStorage.removeItem('tambayanCart');
    window.location.href = '/html/login.html';
  });

  // NOTIFICATIONS
  document.querySelector('.bell').addEventListener('click', async () => {
    try {
      const notifs = await apiCall('/customer/notifications?limit=5');
      if (!notifs || notifs.length === 0) {
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
});

// ------------------- HELPERS -------------------
function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector(`#${viewId}View`)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');
}

// ✅ AUTHORIZED API CALL
// ✅ AUTHORIZED API CALL - FIXED
async function apiCall(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const token = localStorage.getItem('customerToken');
  if (!token) {
    alert('Customer session expired. Please log in again.');
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
    alert('Session expired or access denied. Please log in again.');
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerInfo');
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
async function loadCustomerProfile() {
  try {
    const profile = await apiCall('/customer/profile');
    document.querySelector('.welcome').textContent = `Welcome back, ${profile.name}!`;
    localStorage.setItem('customerInfo', JSON.stringify(profile));
  } catch {
    document.querySelector('.welcome').textContent = 'Welcome back, Customer!';
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

async function loadFavorites() {
  const grid = document.querySelector('.favorites-grid');
  if (!grid) return;
  grid.innerHTML = '<p>Loading recommendations...</p>';
  try {
    const favorites = await apiCall('/customer/favorites');
    if (!favorites || favorites.length === 0) {
      grid.innerHTML = '<p>No recommended items yet.</p>';
      return;
    }
    // Updated HTML template for dashboard favorites to use new button style
    grid.innerHTML = favorites.slice(0, 2).map(item => `
      <div class="item-card">
        <div class="item-image">
          <img src="${item.imageUrl || '/image/placeholder-menu.jpg'}" alt="${item.name}" />
        </div>
        <div class="item-info">
          <div class="item-title">${item.name}</div>
          <div class="item-price">₱${Number(item.price).toFixed(2)}</div>
          <p>${item.description || 'Delicious item!'}</p>
          <button class="add-to-billing-btn-large" data-id="${item.id}">
            <i class="ri-add-line"></i> Add to Billing
          </button>
        </div>
      </div>
    `).join('');
    // Updated selector to match the new button class
    document.querySelectorAll('.add-to-billing-btn-large').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const btn = e.currentTarget; // Get the clicked button
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

// ------------------- ORDER TRACKER -------------------
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
  if (status === 'Preparing') steps[0].classList.add('active');
  else if (status === 'Ready') steps[1].classList.add('active');
  else if (status === 'Served' || status === 'Completed') steps[2].classList.add('active');
}

// ------------------- MENU -------------------
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

// Function to open the modal and populate it with item details
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
  // Assuming ingredients are stored in an array in the item object.
  // If not, you might need to adjust this based on your API response.
  if (item.ingredients && Array.isArray(item.ingredients)) {
    item.ingredients.forEach(ingredient => {
      const li = document.createElement('li');
      li.textContent = ingredient;
      modalIngredients.appendChild(li);
    });
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

// ------------------- CART -------------------
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
  alert(`"${item.name}" (Mood: ${mood || 'N/A'}, Size: ${size || 'N/A'}, Sugar: ${sugar || 'N/A'}) added to cart!`);
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
  const customerInfo = JSON.parse(localStorage.getItem('customerInfo'));
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
    customerId: customerInfo.id,
    customerEmail: customerInfo.email,
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
    // Reload recent orders and current order tracker after placing an order
    loadRecentOrders();
    loadCurrentOrderForTracker();
  } catch (err) {
    alert('Failed to place order: ' + err.message);
  }
}

// ------------------- MY ORDERS -------------------
async function loadMyOrders() {
    const tbody = document.getElementById('myOrdersTableBody');
    if (!tbody) return; // Guard clause if element doesn't exist

    tbody.innerHTML = '<tr><td colspan="5">Loading your orders...</td></tr>';

    try {
        // Fetch all orders for the current customer
        // Assuming the API endpoint returns all orders associated with the authenticated customer
        const orders = await apiCall('/customer/orders'); // Adjust endpoint if needed

        if (!orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">You have no orders yet.</td></tr>';
            return;
        }

        // Clear loading message
        tbody.innerHTML = '';

        // Sort orders by date, newest first (optional, depends on API response)
        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        orders.forEach(order => {
            const row = document.createElement('tr');
            const statusClass = getStatusClass(order.status);

            // Format date and time
            const orderDate = new Date(order.createdAt);
            const formattedDateTime = orderDate.toLocaleString(); // Adjust format as needed

            // Create action buttons (Reorder, Leave Feedback)
            const actionsCell = document.createElement('td');
            actionsCell.classList.add('actions-cell'); // Add a class for potential styling

            const reorderBtn = document.createElement('button');
            reorderBtn.textContent = 'Reorder';
            reorderBtn.className = 'action-btn reorder-btn';
            reorderBtn.onclick = () => handleReorder(order);

            const feedbackBtn = document.createElement('button');
            feedbackBtn.textContent = 'Feedback';
            feedbackBtn.className = 'action-btn feedback-btn';
            feedbackBtn.onclick = () => handleFeedback(order);

            actionsCell.appendChild(reorderBtn);
            actionsCell.appendChild(feedbackBtn);

            row.innerHTML = `
                <td>#${order.orderNumber}</td>
                <td>${formattedDateTime}</td>
                <td><span class="status ${statusClass}">${order.status}</span></td>
                <td>₱${Number(order.totalAmount).toFixed(2)}</td>
            `;

            // Append the actions cell after the other cells are added via innerHTML
            row.appendChild(actionsCell);

            tbody.appendChild(row);
        });

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:#e74c3c;">Error loading orders: ${err.message}</td></tr>`;
    }
}

// Placeholder functions for Reorder and Feedback actions
function handleReorder(order) {
    // Logic to add the items from the order back to the cart
    // This is a simplified version - you might want to handle customizations more carefully
    order.items.forEach(item => {
        // Assuming the order item structure matches the cart item structure
        // You might need to map fields like productId -> id
        addToCart(
            { ...item, id: item.productId }, // Map productId if needed
            item.quantity,
            item.size || 'M',
            item.mood || 'Hot',
            item.sugar || '50%'
        );
    });
    alert(`Items from order #${order.orderNumber} added to your cart!`);
    updateCartUI(); // Update the cart UI after adding items
    showView('menu'); // Optionally switch to the menu view to see the cart
}

function handleFeedback(order) {
    // Logic to open a feedback form or modal for the specific order
    // This is a placeholder - implement the actual feedback mechanism
    alert(`Feedback form for order #${order.orderNumber} would open here.`);
    // Example: Open a modal with order details and a feedback input
    // You could pass the order ID to a function that displays the feedback UI
}