const API_BASE = 'https://tambayan-cafe-backend.onrender.com/api';
let allMenuItems = [];
let cart = JSON.parse(localStorage.getItem('tambayanCart')) || [];
let currentCategory = 'all';

document.addEventListener('DOMContentLoaded', () => {
  const customerToken = localStorage.getItem('customerToken');
  if (!customerToken) {
    window.location.href = '/html/login.html';
    return;
  }

  updateCartUI();

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
        if (view === 'myOrders') {
            loadMyOrders();
        }
        if (view === 'profile') {
            loadProfileSettings();
        }
      }
    });
  });

  document.querySelector('.cart-badge')?.addEventListener('click', (e) => {
      e.preventDefault();
      openCartModal();
  });

  document.querySelector('.logout')?.addEventListener('click', (e) => {
    e?.preventDefault();
    localStorage.removeItem('customerToken');
    localStorage.removeItem('customerInfo');
    localStorage.removeItem('tambayanCart');
    window.location.href = '/html/login.html';
  });

  document.querySelector('.bell')?.addEventListener('click', async () => {
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

  document.getElementById('menuSearch')?.addEventListener('input', (e) => {
    renderMenu(e.target.value, currentCategory);
  });

  document.querySelectorAll('.category-btn')?.forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentCategory = btn.dataset.category;
      renderMenu(document.getElementById('menuSearch')?.value || '', currentCategory);
    });
  });

  document.getElementById('closeModal')?.addEventListener('click', closeModal);
  window.onclick = function(event) {
    const modal = document.getElementById('itemModal');
    if (event.target === modal) {
      closeModal();
    }
  };

  document.getElementById('profileForm')?.addEventListener('submit', saveProfileSettings);
  document.getElementById('cancelBtn')?.addEventListener('click', () => {
      loadProfileSettings();
  });

  document.getElementById('closeCartModal')?.addEventListener('click', closeCartModal);
  window.onclick = function(event) {
    const modal = document.getElementById('itemModal');
    if (event.target === modal) {
      closeModal();
    }
    const cartModal = document.getElementById('cartModal');
    if (event.target === cartModal) {
      closeCartModal();
    }
  };
});

function showView(viewId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelector(`#${viewId}View`)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');
}

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

async function loadCustomerProfile() {
  try {
    const profile = await apiCall('/customer/profile');
    if (profile && profile.firstName && profile.lastName) {
      document.querySelector('.welcome').textContent = `Welcome back, ${profile.firstName} ${profile.lastName}!`;
      localStorage.setItem('customerInfo', JSON.stringify(profile));
    } else {
      document.querySelector('.welcome').textContent = 'Welcome back, Customer!';
    }
  } catch (err) {
    console.error('Error loading customer profile:', err);
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
  const grid = document.getElementById('favoritesCarousel');
  if (!grid) {
    console.error("Favorites carousel container (#favoritesCarousel) not found in HTML.");
    return;
  }
  
  grid.innerHTML = '<div class="loading-spinner">Loading recommendations...</div>';
  
  try {
    const favorites = await apiCall('/customer/favorites');
    
    if (!favorites || favorites.length === 0) {
      grid.innerHTML = '<div class="no-items">No recommended items yet.</div>';
      return;
    }

    grid.innerHTML = '';
    
    favorites.forEach((item, index) => {
      const itemElement = document.createElement('div');
      itemElement.className = `carousel-item ${!item.isAvailable ? 'unavailable' : ''} view-only`;
      itemElement.dataset.id = item.id;
      itemElement.style.opacity = '0';
      itemElement.style.transform = 'translateY(20px)';
      
      itemElement.innerHTML = `
        <div class="item-card">
          <div class="item-image">
            <img src="${item.imageUrl || '/image/placeholder-menu.jpg'}" alt="${item.name}" loading="lazy" />
          </div>
          <div class="item-info">
            <div class="item-title">${item.name}</div>
            <div class="item-price">₱${Number(item.price).toFixed(2)}</div>
          </div>
        </div>
      `;
      
      grid.appendChild(itemElement);
      
      setTimeout(() => {
        itemElement.style.transition = 'all 0.3s ease';
        itemElement.style.opacity = '1';
        itemElement.style.transform = 'translateY(0)';
      }, index * 100);
    });

    setTimeout(() => {
      initializeFavoritesCarousel();
    }, 100);

  } catch (err) {
    grid.innerHTML = `<div class="error-message">Error loading favorites: ${err.message}</div>`;
    console.error("Error loading favorites:", err);
  }
}

function initializeFavoritesCarousel() {
  const carousel = document.getElementById('favoritesCarousel');
  const prevBtn = document.querySelector('.carousel-nav.prev');
  const nextBtn = document.querySelector('.carousel-nav.next');
  const items = document.querySelectorAll('.carousel-item');
  

  if (!carousel || !prevBtn || !nextBtn || items.length === 0) {
    console.warn("Carousel elements not found. Skipping carousel initialization.");
    return;
  }
  

  console.log(`Found ${items.length} carousel items.`);

  let currentIndex = 0;
  let itemWidth = 300;
  let visibleItems = 1;

  function calculateDimensions() {
    const containerWidth = carousel.parentElement.clientWidth;
    const navButtonsWidth = 80;
    const gap = 16;
    const availableWidth = containerWidth - navButtonsWidth - (gap * 2);
    
    if (window.innerWidth <= 480) {
      itemWidth = Math.min(200, availableWidth - gap);
      visibleItems = 1;
    } else if (window.innerWidth <= 768) {
      itemWidth = Math.min(240, (availableWidth - gap) / 2);
      visibleItems = Math.floor(availableWidth / (itemWidth + gap));
    } else if (window.innerWidth <= 1024) {
      itemWidth = Math.min(280, (availableWidth - gap * 2) / 3);
      visibleItems = Math.floor(availableWidth / (itemWidth + gap));
    } else {
      itemWidth = 300;
      visibleItems = Math.floor(availableWidth / (itemWidth + gap));
    }

    visibleItems = Math.max(1, visibleItems);
    
    items.forEach(item => {
      item.style.width = `${itemWidth}px`;
      item.style.minWidth = `${itemWidth}px`;
      item.style.maxWidth = `${itemWidth}px`;
    });
    

    return { itemWidth, visibleItems, gap };
  }

  function updateCarousel() {
    const { itemWidth, visibleItems, gap } = calculateDimensions();
    
    const translateX = -(currentIndex * (itemWidth + gap));
    carousel.style.transform = `translateX(${translateX}px)`;
    carousel.style.transition = 'transform 0.3s ease-out';
    
    console.log(`Carousel translated to: ${translateX}px, visible items: ${visibleItems}`);
    
    const maxIndex = Math.max(0, items.length - visibleItems);
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex >= maxIndex;
    
    prevBtn.style.opacity = currentIndex === 0 ? '0.5' : '1';
    nextBtn.style.opacity = currentIndex >= maxIndex ? '0.5' : '1';
  }

  updateCarousel();

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      currentIndex--;
      updateCarousel();
    }
  });

  nextBtn.addEventListener('click', () => {
    const { visibleItems } = calculateDimensions();
    const maxIndex = Math.max(0, items.length - visibleItems);
    if (currentIndex < maxIndex) {
      currentIndex++;
      updateCarousel();
    }
  });

  let autoPlayInterval = setInterval(() => {
    const { visibleItems } = calculateDimensions();
    const maxIndex = Math.max(0, items.length - visibleItems);
    
    if (currentIndex < maxIndex) {
      currentIndex++;
    } else {
      currentIndex = 0;
    }
    updateCarousel();
  }, 5000);

  carousel.addEventListener('mouseenter', () => {
    clearInterval(autoPlayInterval);
  });

  carousel.addEventListener('mouseleave', () => {
    autoPlayInterval = setInterval(() => {
      const { visibleItems } = calculateDimensions();
      const maxIndex = Math.max(0, items.length - visibleItems);
      
      if (currentIndex < maxIndex) {
        currentIndex++;
      } else {
        currentIndex = 0;
      }
      updateCarousel();
    }, 5000);
  });

  document.querySelectorAll('.carousel-item:not(.view-only)').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target === card || e.target.closest('.item-card') || e.target.closest('.item-info')) {
        const itemId = card.dataset.id;
        const item = allMenuItems.find(i => i.id === itemId);
        if (item) {
          openItemModal(item);
        }
      }
    });
  });

  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      currentIndex = 0;
      updateCarousel();
    }, 250);
  });
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
      const trackerTimeEl = document.getElementById('trackerTime');
      if (trackerTimeEl) trackerTimeEl.textContent = 'Last updated: just now';
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

async function loadMenuItems() {
  const grid = document.getElementById('menuGrid');
  if (!grid) return;
  grid.innerHTML = '<p>Loading menu...</p>';
  try {
    const items = await apiCall('/product/customer/menu');
    allMenuItems = Array.isArray(items) ? items : [];
    renderMenu('', 'all');
  } catch (err) {
    grid.innerHTML = `<p style="color:#e74c3c;">Error: ${err.message}</p>`;
  }
}

function renderMenu(searchTerm = '', category = 'all') {
  const grid = document.getElementById('menuGrid');
  if (!grid) return;
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
        </div>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.menu-item-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target === card || e.target.closest('.product-details') || e.target.closest('.product-image')) {
        const itemId = card.dataset.id;
        const item = allMenuItems.find(i => i.id === itemId);
        if (item) {
          openItemModal(item);
        }
      }
    });
  });
}

function openItemModal(item) {
  const modal = document.getElementById('itemModal');
  if (!modal) return;
  const modalImage = document.getElementById('modalImage');
  const modalName = document.getElementById('modalName');
  const modalPrice = document.getElementById('modalPrice');
  const modalCategory = document.getElementById('modalCategory');
  const modalIngredients = document.getElementById('modalIngredients');
  const modalAvailability = document.getElementById('modalAvailability');
  const modalQuantity = document.getElementById('modalQuantity');
  const modalAddToCart = document.getElementById('modalAddToCart');

  if (modalImage) modalImage.src = item.imageUrl || '/image/placeholder-menu.jpg';
  if (modalName) modalName.textContent = item.name;
  if (modalPrice) modalPrice.textContent = `₱${Number(item.price).toFixed(2)}`;
  if (modalCategory) modalCategory.textContent = item.category;

  if (modalIngredients) modalIngredients.innerHTML = '';
  if (modalIngredients) {
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
  }

  if (modalAvailability) {
    if (item.isAvailable) {
      modalAvailability.textContent = 'Available';
      modalAvailability.style.color = '#4CAF50';
      modalAvailability.style.fontWeight = 'bold';
      if (modalAddToCart) modalAddToCart.disabled = false;
    } else {
      modalAvailability.textContent = 'Currently Unavailable';
      modalAvailability.style.color = '#E53E3E';
      modalAvailability.style.fontWeight = 'bold';
      if (modalAddToCart) modalAddToCart.disabled = true;
    }
  }

  if (modalQuantity) {
    modalQuantity.value = '1';
  }

  // --- FIX: Attach event listeners to minus and plus buttons ---
  const modalQtyMinus = document.getElementById('modalQtyMinus');
  const modalQtyPlus = document.getElementById('modalQtyPlus');

  if (modalQtyMinus && modalQuantity) {
    modalQtyMinus.addEventListener('click', (ev) => {
      ev?.preventDefault();
      const current = parseInt(modalQuantity.value) || 1;
      if (current > 1) modalQuantity.value = String(current - 1);
    });
  }

  if (modalQtyPlus && modalQuantity) {
    modalQtyPlus.addEventListener('click', (ev) => {
      ev?.preventDefault();
      const current = parseInt(modalQuantity.value) || 1;
      modalQuantity.value = String(current + 1);
    });
  }

  // --- END OF FIX ---

  let selectedMood = 'Hot';
  let selectedSize = 'M';
  let selectedSugar = '50%';

  const customizationSection = document.querySelector('.customization-section');
  if (item.category === 'Drinks' && customizationSection) {
    customizationSection.style.display = 'block';

    document.querySelectorAll('.custom-option-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
    });

    document.querySelectorAll('.custom-option-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const target = e.currentTarget;
        const type = target.dataset.type;
        const value = target.dataset.value;
        document.querySelectorAll(`.custom-option-btn[data-type="${type}"]`).forEach(b => {
          b.classList.remove('active');
        });
        target.classList.add('active');
        if (type === 'mood') selectedMood = value;
        else if (type === 'size') selectedSize = value;
        else if (type === 'sugar') selectedSugar = value;
      });
    });

    const moodBtn = document.querySelector(`.custom-option-btn[data-type="mood"][data-value="${selectedMood}"]`);
    const sizeBtn = document.querySelector(`.custom-option-btn[data-type="size"][data-value="${selectedSize}"]`);
    const sugarBtn = document.querySelector(`.custom-option-btn[data-type="sugar"][data-value="${selectedSugar}"]`);
    if (moodBtn) moodBtn.classList.add('active');
    if (sizeBtn) sizeBtn.classList.add('active');
    if (sugarBtn) sugarBtn.classList.add('active');

  } else if (customizationSection) {
    customizationSection.style.display = 'none';
  }

  if (modalAddToCart) {
    modalAddToCart.onclick = () => {
      if (!item.isAvailable) {
        alert("This item is currently unavailable.");
        return;
      }
      const quantity = (document.getElementById('modalQuantity') && parseInt(document.getElementById('modalQuantity').value)) || 1;
      const sizeToUse = item.category === 'Drinks' ? selectedSize : '';
      const moodToUse = item.category === 'Drinks' ? selectedMood : '';
      const sugarToUse = item.category === 'Drinks' ? selectedSugar : '';
      addToCart(item, quantity, sizeToUse, moodToUse, sugarToUse);
      closeModal();
    };
  }

  modal.style.display = 'block';
}

function closeModal() {
  const modal = document.getElementById('itemModal');
  if (!modal) return;
  modal.style.display = 'none';
  document.querySelectorAll('.custom-option-btn').forEach(btn => btn.classList.remove('active'));
}

function addToCart(item, quantity = 1, size = 'M', mood = 'Hot', sugar = '50%') {
  if (!item.isAvailable) {
    alert("This item is currently unavailable.");
    return;
  }
  if (quantity <= 0) {
    alert("Quantity must be at least 1");
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
      id: item.id,
      name: item.name,
      price: item.price,
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
  const cartCountEl = document.getElementById('cartCount');
  const cartTotalEl = document.getElementById('cartTotal');
  const cartItemCountEl = document.getElementById('cartItemCount');
  const checkoutBtn = document.getElementById('checkoutBtn');

  if (cartCountEl) cartCountEl.textContent = count;
  if (cartTotalEl) cartTotalEl.textContent = `₱${total.toFixed(2)}`;
  if (cartItemCountEl) cartItemCountEl.textContent = `${count} item${count !== 1 ? 's' : ''}`;
  if (checkoutBtn) checkoutBtn.disabled = count === 0;
}

async function placeOrder() {
  if (cart.length === 0) return;
  const customerInfo = JSON.parse(localStorage.getItem('customerInfo') || '{}');
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
    loadRecentOrders();
    loadCurrentOrderForTracker();
  } catch (err) {
    alert('Failed to place order: ' + err.message);
  }
}

async function loadMyOrders() {
    const tbody = document.getElementById('myOrdersTableBody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="5">Loading your orders...</td></tr>';

    try {
        const orders = await apiCall('/customer/orders');

        if (!orders || orders.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5">You have no orders yet.</td></tr>';
            return;
        }

        tbody.innerHTML = '';

        orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        orders.forEach(order => {
            const row = document.createElement('tr');
            const statusClass = getStatusClass(order.status);

            const orderDate = new Date(order.createdAt);
            const formattedDateTime = orderDate.toLocaleString();

            const actionsCell = document.createElement('td');
            actionsCell.classList.add('actions-cell');

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

            row.appendChild(actionsCell);

            tbody.appendChild(row);
        });

    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="5" style="color:#e74c3c;">Error loading orders: ${err.message}</td></tr>`;
    }
}

function handleReorder(order) {
    if (!order.items || !Array.isArray(order.items)) return;
    order.items.forEach(item => {
        addToCart(
            { id: item.productId || item.id, name: item.name, price: item.price },
            item.quantity,
            item.size || 'M',
            item.mood || 'Hot',
            item.sugar || '50%'
        );
    });
    alert(`Items from order #${order.orderNumber} added to your cart!`);
    updateCartUI();
    showView('menu');
}

function handleFeedback(order) {
    alert(`Feedback form for order #${order.orderNumber} would open here.`);
}

async function loadProfileSettings() {
    try {
        const profile = await apiCall('/customer/profile');
        document.getElementById('firstName').value = profile.firstName || '';
        document.getElementById('lastName').value = profile.lastName || '';
        document.getElementById('email').value = profile.email || '';
        document.getElementById('phone').value = profile.phone || '';
        document.getElementById('address').value = profile.address || '';
        document.getElementById('birthday').value = profile.birthday || '';
        document.getElementById('gender').value = profile.gender || '';
    } catch (err) {
        console.error('Error loading profile settings:', err);
        alert('Failed to load profile  ' + err.message);
    }
}

async function saveProfileSettings(e) {
  e.preventDefault();
  
  const formData = {
    firstName: document.getElementById('firstName').value.trim(),
    lastName: document.getElementById('lastName').value.trim(),
    email: document.getElementById('email').value.trim().toLowerCase(),
    phone: document.getElementById('phone').value.trim(),
    address: document.getElementById('address').value.trim(),
    birthday: document.getElementById('birthday').value,
    gender: document.getElementById('gender').value
  };

  const errors = [];
  
  if (!formData.firstName || formData.firstName.length < 2) {
    errors.push('First name must be at least 2 characters');
  }
  
  if (!formData.lastName || formData.lastName.length < 2) {
    errors.push('Last name must be at least 2 characters');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(formData.email)) {
    errors.push('Please enter a valid email address');
  }
  
  if (!formData.phone || !/^\+?[0-9\s\-\(\)]{10,}$/.test(formData.phone)) {
    errors.push('Please enter a valid phone number');
  }
  
  if (errors.length > 0) {
    alert('Validation errors:\n' + errors.join('\n'));
    return;
  }

  try {
    const response = await apiCall('/customer/profile', {
      method: 'PUT',
      body: JSON.stringify(formData)
    });

    localStorage.setItem('customerInfo', JSON.stringify(response));
    document.querySelector('.welcome').textContent = `Welcome back, ${response.firstName} ${response.lastName}!`;
    alert('Profile updated successfully!');
  } catch (err) {
    alert('Failed to update profile: ' + err.message);
  }
}

function openCartModal() {
    const modal = document.getElementById('cartModal');
    if (!modal) return;
    
    loadCartIntoModal();
    
    modal.style.display = 'block';
}

function closeCartModal() {
    const modal = document.getElementById('cartModal');
    if (!modal) return;
    modal.style.display = 'none';
}

function loadCartIntoModal() {
    const container = document.querySelector('.cart-items-container');
    const totalEl = document.getElementById('cartTotal');
    const countEl = document.getElementById('cartItemCount');
    
    if (!container || !totalEl || !countEl) return;
    
    if (cart.length === 0) {
        container.innerHTML = '<p>Your cart is empty.</p>';
        totalEl.textContent = '₱0.00';
        countEl.textContent = '0';
        document.getElementById('checkoutBtn')?.setAttribute('disabled', 'true');
        return;
    }
    
    let html = '';
    let total = 0;
    
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        html += `
            <div class="cart-item">
                <div class="item-details">
                    <h3>${item.name}</h3>
                    <p class="item-meta">Qty: ${item.quantity} | Size: ${item.size || 'N/A'} | Mood: ${item.mood || 'N/A'} | Sugar: ${item.sugar || 'N/A'}</p>
                    <p class="item-price">₱${Number(item.price).toFixed(2)} x ${item.quantity} = ₱${itemTotal.toFixed(2)}</p>
                </div>
                <div class="item-actions">
                    <button class="btn-remove" data-index="${index}">Remove</button>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
    totalEl.textContent = `₱${total.toFixed(2)}`;
    countEl.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    
    document.getElementById('checkoutBtn')?.removeAttribute('disabled');
    
    document.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index);
            removeItemFromCart(index);
        });
    });
    
    document.getElementById('checkoutBtn')?.addEventListener('click', placeOrder);
    document.getElementById('clearCartBtn')?.addEventListener('click', clearCart);
}

function removeItemFromCart(index) {
    if (index >= 0 && index < cart.length) {
        cart.splice(index, 1);
        localStorage.setItem('tambayanCart', JSON.stringify(cart));
        updateCartUI();
        loadCartIntoModal();
    }
}

function clearCart() {
    if (confirm("Are you sure you want to clear your entire cart?")) {
        cart = [];
        localStorage.setItem('tambayanCart', JSON.stringify(cart));
        updateCartUI();
        loadCartIntoModal();
    }
}