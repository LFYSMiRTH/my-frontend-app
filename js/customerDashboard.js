const API_BASE = 'https://tambayan-cafe-backend.onrender.com/api';
let allMenuItems = [];
let cart = JSON.parse(localStorage.getItem('tambayanCart')) || [];
let currentCategory = 'all';
function getCustomerIdFromToken() {
  const token = localStorage.getItem('customerToken');
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id || payload.sub || null;
  } catch (e) {
    console.error("Invalid token:", e);
    return null;
  }
}
async function updateDeliveryFeeInModal() {
  const street = document.getElementById('customerStreet')?.value.trim();
  const city = document.getElementById('customerCity')?.value.trim();
  const province = document.getElementById('customerProvince')?.value.trim();
  if (!street && !city) return;
  const address = [street, city, province].filter(part => part).join(', ');
  try {
    const feeRes = await apiCall('/delivery-fee', {
      method: 'POST',
      body: JSON.stringify({ address: address })
    });
    const deliveryFee = feeRes.fee || 0;
    const deliveryFeeEl1 = document.getElementById('cartDeliveryFee');
    const deliveryFeeEl2 = document.getElementById('orderDeliveryFee');
    const totalWithFeeEl1 = document.getElementById('cartTotalWithFee');
    const totalWithFeeEl2 = document.getElementById('orderTotalWithFee');
    if (deliveryFeeEl1) deliveryFeeEl1.textContent = `₱${deliveryFee.toFixed(2)}`;
    if (deliveryFeeEl2) deliveryFeeEl2.textContent = `₱${deliveryFee.toFixed(2)}`;
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalWithFee = subtotal + deliveryFee;
    if (totalWithFeeEl1) totalWithFeeEl1.textContent = `₱${totalWithFee.toFixed(2)}`;
    if (totalWithFeeEl2) totalWithFeeEl2.textContent = `₱${totalWithFee.toFixed(2)}`;
  } catch (err) {
    console.warn('Failed to fetch delivery fee dynamically:', err);
  }
}
async function updateNotificationBadge() {
  try {
    const notifs = await apiCall('/customer/notifications?limit=10');
    const badge = document.querySelector('.bell-container .notification-badge');
    if (badge) {
      const count = notifs.length || 0;
      badge.textContent = count;
      badge.style.display = count > 0 ? 'inline-block' : 'none';
    }
  } catch (err) {
    console.warn('Failed to update notification badge:', err);
    const badge = document.querySelector('.bell-container .notification-badge');
    if (badge) badge.style.display = 'none';
  }
}
document.addEventListener('DOMContentLoaded', () => {
document.getElementById('closeCartModal')?.addEventListener('click', () => closeModalById('cartModal'));
document.querySelector('#orderConfirmationModal .modal-close-btn')
  ?.addEventListener('click', closeOrderConfirmationModal);
  const customerToken = localStorage.getItem('customerToken');
  if (!customerToken) {
    window.location.href = '/html/login.html';
    return;
  }
  updateCartUI();
  loadCustomerProfile();
  loadSavedProfilePicture();
  loadRecentOrders();
  loadAllMenuItemsForCarousel();
  loadCurrentOrderForTracker();
  setInterval(loadCurrentOrderForTracker, 10000);
  updateNotificationBadge();
  setInterval(updateNotificationBadge, 30000);
  initializeProfileFormListeners();
  setupDeleteConfirmation();
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
            initializeProfileFormListeners();
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
      const notifs = await apiCall('/customer/notifications?limit=10');
      if (!notifs || notifs.length === 0) {
        showToast('You have no new notifications at this time.', 'info');
        return;
      }
      const orderNotifs = notifs.filter(n => n.category === 'order');
      if (orderNotifs.length === 0) {
        showToast('No new order updates.', 'info');
        return;
      }
      let msg = '';
      orderNotifs.forEach(n => {
        msg += `• ${n.message} (${new Date(n.createdAt).toLocaleString()})
  `;
      });
      showAlert(
        'Order Notifications',
        msg,
        false,
        null,
        null,
        true,
        async () => {
          try {
            await apiCall('/customer/notifications/clear', { method: 'POST' });
            const bellContainer = document.querySelector('.bell-container');
            if (bellContainer) {
              bellContainer.querySelector('.notification-badge').textContent = '0';
              bellContainer.querySelector('.notification-badge').style.display = 'none';
            }
            showToast('Notifications cleared.', 'success');
          } catch (err) {
            console.error('Failed to clear notifications:', err);
            showToast('Failed to clear notifications: ' + err.message, 'error');
          }
        }
      );
    } catch (err) {
      showToast('Failed to load notifications: ' + err.message, 'error');
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
    const cartModal = document.getElementById('cartModal');
    if (event.target === cartModal) {
      closeCartModal();
    }
    const orderModal = document.getElementById('orderConfirmationModal');
    if (event.target === orderModal) {
      closeOrderConfirmationModal();
    }
  };
  document.getElementById('alertOkBtn')?.addEventListener('click', () => {
    document.getElementById('customAlert').style.display = 'none';
  });
  document.getElementById('confirmOrderBtn')?.addEventListener('click', handleOrderConfirmation);
  document.getElementById('cancelOrderBtn')?.addEventListener('click', closeOrderConfirmationModal);
  document.getElementById('phone')?.addEventListener('input', function(e) {
    this.value = this.value.replace(/[^0-9]/g, '');
    if (this.value.length > 11) {
      this.value = this.value.slice(0, 11);
    }
  });
  document.getElementById('customerPhone')?.addEventListener('input', function(e) {
    this.value = this.value.replace(/[^0-9]/g, '');
    if (this.value.length > 11) {
      this.value = this.value.slice(0, 11);
    }
  });
  document.getElementById('orderConfirmationModal')?.addEventListener('submit', validatePhoneInput);
  document.getElementById('customerStreet')?.addEventListener('input', updateDeliveryFeeInModal);
  document.getElementById('customerCity')?.addEventListener('input', updateDeliveryFeeInModal);
  document.getElementById('customerProvince')?.addEventListener('input', updateDeliveryFeeInModal);
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
    showToast('Customer session expired. Please log in again.', 'error');
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
    showToast('Session expired or access denied. Please log in again.', 'error');
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
function showAlert(title, message, isConfirmation = false, onConfirm = null, onCancel = null, isNotification = false, onClear = null) {
  const modal = document.getElementById('customAlert');
  const titleEl = document.getElementById('alertTitle');
  const msgEl = document.getElementById('alertMessage');
  const okBtn = document.getElementById('alertOkBtn');
  const cancelBtn = document.createElement('button');
  const clearBtn = document.createElement('button');
  const existingCancel = document.getElementById('alertCancelBtn');
  const existingClear = document.getElementById('alertClearBtn');
  if (existingCancel) {
    existingCancel.remove();
  }
  if (existingClear) {
    existingClear.remove();
  }
  titleEl.textContent = title;
  msgEl.textContent = message;
  if (isConfirmation) {
    cancelBtn.id = 'alertCancelBtn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'btn-secondary';
    cancelBtn.style.marginLeft = '8px';
    cancelBtn.style.backgroundColor = '#2d5a6b';
    cancelBtn.style.borderColor = '#2d5a6b';
    cancelBtn.style.color = 'white';
    cancelBtn.style.padding = '10px 20px';
    cancelBtn.style.borderRadius = '8px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.transition = 'background 0.2s';
    cancelBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      if (onCancel) onCancel();
    });
    okBtn.parentNode.appendChild(cancelBtn);
  }
  if (isNotification && onClear) {
    clearBtn.id = 'alertClearBtn';
    clearBtn.textContent = 'Clear All';
    clearBtn.className = 'btn-secondary';
    clearBtn.style.backgroundColor = '#e74c3c';
    clearBtn.style.transition = 'background 0.2s';
    clearBtn.style.marginLeft = '8px';
    clearBtn.addEventListener('click', () => {
      modal.style.display = 'none';
      if (onClear) onClear();
    });
    okBtn.parentNode.appendChild(clearBtn);
  }
  modal.style.display = 'flex';
  modal.style.zIndex = '9999';
  okBtn.onclick = function() {
    modal.style.display = 'none';
    if (onConfirm) onConfirm();
  };
  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      modal.style.display = 'none';
      if (onCancel) onCancel();
    }
  });
}
async function loadCustomerProfile() {
  try {
    const profile = await apiCall('/user/profile');
    if (profile && profile.firstName && profile.lastName) {
      document.querySelector('.welcome').textContent = `Welcome back, ${profile.firstName}!`;
      localStorage.setItem('customerInfo', JSON.stringify(profile));
    } else {
      const username = profile?.username || 'Customer';
      document.querySelector('.welcome').textContent = `Welcome back, ${username}!`;
      if (profile) {
        localStorage.setItem('customerInfo', JSON.stringify(profile));
      }
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
    const orders = await apiCall('/customer/orders?limit=20');
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
async function loadAllMenuItemsForCarousel() {
  const grid = document.getElementById('favoritesCarousel');
  if (!grid) {
    console.error("Favorites carousel container (#favoritesCarousel) not found in HTML.");
    return;
  }
  grid.innerHTML = '<div class="loading-spinner">Loading all menu items...</div>';
  try {
    const allItems = await apiCall('/product/customer/menu');
    if (!allItems || allItems.length === 0) {
      grid.innerHTML = '<div class="no-items">No menu items available.</div>';
      return;
    }
    grid.innerHTML = '';
    allItems.forEach((item, index) => {
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
    console.log(`Successfully loaded ${allItems.length} items into carousel.`);
    setTimeout(() => {
      initializeFavoritesCarousel();
    }, 100);
  } catch (err) {
    showToast(`Failed to load menu items for carousel: ${err.message}`, 'error');
    grid.innerHTML = `<div class="error-message">Error loading menu items: ${err.message}</div>`;
    console.error("Error loading menu items for carousel:", err);
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
  let currentIndex = 0;
  let itemWidth = 300;
  let visibleItems = 1;
  function calculateDimensions() {
    const containerWidth = carousel.parentElement.clientWidth;
    const gap = 16;
    let itemWidth = 280;
    let visibleItems = 1;
    if (window.innerWidth <= 480) {
      itemWidth = 200;
    } else if (window.innerWidth <= 768) {
      itemWidth = 240;
    } else {
      itemWidth = 280;
    }
    visibleItems = Math.max(1, Math.floor(containerWidth / (itemWidth + gap)));
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
    const maxIndex = Math.max(0, items.length - visibleItems);
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex >= maxIndex;
    prevBtn.style.opacity = currentIndex === 0 ? '0.5' : '1';
    nextBtn.style.opacity = currentIndex >= maxIndex ? '0.5' : '1';
  }
  setTimeout(() => {
    calculateDimensions();
    updateCarousel();
  }, 50);
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

function formatElapsedTime(dateString) {
  const now = new Date();
  const then = new Date(dateString);
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000); // Convert ms → minutes

  if (diffMins < 1) return 'just now';
  if (diffMins === 1) return '1 minute ago';
  return `${diffMins} minutes ago`;
}

async function loadCurrentOrderForTracker() {
  try {
    const orders = await apiCall('/customer/orders?status=Preparing,Ready,Served,Completed');
    const current = Array.isArray(orders)
      ? orders.find(o => ['Preparing', 'Ready', 'Served', 'Completed'].includes(o.status))
      : null;

    const trackerPara = document.getElementById('currentOrderText');
    const steps = document.querySelectorAll('.step');
    const trackerTimeEl = document.getElementById('trackerTime');

    if (current) {
      currentOrderId = current.orderNumber;
      if (trackerPara) trackerPara.textContent = `#${current.orderNumber}`;
      updateTracker(current.status);
      
      // ✨ Real-time elapsed time display
      if (trackerTimeEl && current.updatedAt) {
        trackerTimeEl.textContent = `Last updated: ${formatElapsedTime(current.updatedAt)}`;
      } else if (trackerTimeEl && current.createdAt) {
        // fallback to createdAt if updatedAt isn't available
        trackerTimeEl.textContent = `Last updated: ${formatElapsedTime(current.createdAt)}`;
      }
    } else {
      if (trackerPara) trackerPara.textContent = 'No active order';
      if (trackerTimeEl) trackerTimeEl.textContent = 'Last updated: —';
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
    const isOutOfStock = (item.stockQuantity || 0) <= 0;
    const isActuallyAvailable = item.isAvailable && !isOutOfStock;
    if (isOutOfStock) {
      modalAvailability.textContent = 'Out of Stock';
      modalAvailability.style.color = '#E53E3E';
      modalAvailability.style.fontWeight = 'bold';
      if (modalAddToCart) modalAddToCart.disabled = true;
    } else if (item.isAvailable) {
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
  const modalQtyMinus = document.getElementById('modalQtyMinus');
  const modalQtyPlus = document.getElementById('modalQtyPlus');
  if (modalQtyMinus && modalQuantity) {
    modalQtyMinus.replaceWith(modalQtyMinus.cloneNode(true));
    const newMinus = document.getElementById('modalQtyMinus');
    newMinus.addEventListener('click', (ev) => {
      ev.preventDefault();
      let current = parseInt(modalQuantity.value) || 1;
      if (current > 1) {
        current--;
        modalQuantity.value = current;
      }
    });
  }
  if (modalQtyPlus && modalQuantity) {
    modalQtyPlus.replaceWith(modalQtyPlus.cloneNode(true));
    const newPlus = document.getElementById('modalQtyPlus');
    newPlus.addEventListener('click', (ev) => {
      ev.preventDefault();
      let current = parseInt(modalQuantity.value) || 1;
      current++;
      modalQuantity.value = current;
    });
  }
  let selectedMood = 'Hot';
  let selectedSize = 'S';
  let selectedSugar = '30%';
  let currentPrice = item.price;
  const customizationSection = document.querySelector('.customization-section');
  if (item.category === 'Drinks' && customizationSection) {
    customizationSection.style.display = 'block';
    document.querySelectorAll('.custom-option-btn').forEach(btn => {
      const newBtn = btn.cloneNode(true);
      btn.parentNode.replaceChild(newBtn, btn);
    });
    function updatePrice() {
      let price = item.price;
      if (selectedSize === 'M') price += 5;
      if (selectedSize === 'L') price += 10;
      currentPrice = price;
      modalPrice.textContent = `₱${currentPrice.toFixed(2)}`;
    }
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
        else if (type === 'size') {
          selectedSize = value;
          updatePrice();
        }
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
        showToast("This item is currently unavailable.", 'error');
        return;
      }
      const quantity = (document.getElementById('modalQuantity') && parseInt(document.getElementById('modalQuantity').value)) || 1;
      const sizeToUse = item.category === 'Drinks' ? selectedSize : '';
      const moodToUse = item.category === 'Drinks' ? selectedMood : '';
      const sugarToUse = item.category === 'Drinks' ? selectedSugar : '';
      addToCart(item, quantity, sizeToUse, moodToUse, sugarToUse, currentPrice);
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
function addToCart(item, quantity = 1, size = 'M', mood = 'Hot', sugar = '50%', price = null) {
  if (!item.isAvailable) {
    showToast("This item is currently unavailable.", 'error');
    return;
  }
  if (quantity <= 0) {
    showToast("Quantity must be at least 1", 'error');
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
      price: price !== null ? price : item.price,
      quantity,
      size,
      mood,
      sugar
    });
  }
  localStorage.setItem('tambayanCart', JSON.stringify(cart));
  updateCartUI();
  showToast(`"${item.name}" added to cart!`, 'success');
}
function updateCartUI() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCountEl = document.getElementById('cartCount');
  const cartSubtotalEl = document.getElementById('cartSubtotal');
  const cartDeliveryFeeEl = document.getElementById('cartDeliveryFee');
  const cartTotalWithFeeEl = document.getElementById('cartTotalWithFee');
  const cartItemCountEl = document.getElementById('cartItemCount');
  const checkoutBtn = document.getElementById('checkoutBtn');
  if (cartCountEl) cartCountEl.textContent = count;
  if (cartSubtotalEl) cartSubtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
  if (cartDeliveryFeeEl) cartDeliveryFeeEl.textContent = `₱0.00`;
  if (cartTotalWithFeeEl) cartTotalWithFeeEl.textContent = `₱${subtotal.toFixed(2)}`;
  if (cartItemCountEl) cartItemCountEl.textContent = count;
  if (checkoutBtn) checkoutBtn.disabled = count === 0;
}
async function placeOrder() {
  if (cart.length === 0) return;
  const customerInfo = JSON.parse(localStorage.getItem('customerInfo') || '{}');
  if (customerInfo.firstName) document.getElementById('customerFirstName').value = customerInfo.firstName;
  if (customerInfo.lastName) document.getElementById('customerLastName').value = customerInfo.lastName;
  if (customerInfo.email) document.getElementById('customerEmail').value = customerInfo.email;
  if (customerInfo.phone) document.getElementById('customerPhone').value = customerInfo.phone;
  if (customerInfo.address) {
    const parts = customerInfo.address.split(',').map(p => p.trim());
    document.getElementById('customerStreet').value = parts[0] || '';
    document.getElementById('customerCity').value = parts[1] || '';
    document.getElementById('customerProvince').value = parts[2] || '';
  }
  loadOrderConfirmationModal();
  document.getElementById('orderConfirmationModal').style.display = 'block';
}
function loadOrderConfirmationModal() {
  const container = document.getElementById('orderItemsContainer');
  const subtotalEl = document.getElementById('orderSubtotal');
  const deliveryFeeEl = document.getElementById('orderDeliveryFee');
  const totalWithFeeEl = document.getElementById('orderTotalWithFee');
  const countEl = document.getElementById('orderItemCount');
  if (!container || !subtotalEl || !deliveryFeeEl || !totalWithFeeEl || !countEl) return;
  if (cart.length === 0) {
      container.innerHTML = '<p>Your cart is empty.</p>';
      subtotalEl.textContent = '₱0.00';
      deliveryFeeEl.textContent = '₱0.00';
      totalWithFeeEl.textContent = '₱0.00';
      countEl.textContent = '0';
      return;
  }
  let html = '';
  let subtotal = 0;
  cart.forEach((item, index) => {
      const itemTotal = item.price * item.quantity;
      subtotal += itemTotal;
      html += `
          <div class="cart-item">
              <div class="item-details">
                  <h3>${item.name}</h3>
                  <p class="item-meta">Qty: ${item.quantity} | Size: ${item.size || 'N/A'} | Mood: ${item.mood || 'N/A'} | Sugar: ${item.sugar || 'N/A'}</p>
                  <p class="item-price">₱${Number(item.price).toFixed(2)} x ${item.quantity} = ₱${itemTotal.toFixed(2)}</p>
              </div>
          </div>
      `;
  });
  container.innerHTML = html;
  subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
  deliveryFeeEl.textContent = `₱0.00`;
  totalWithFeeEl.textContent = `₱${subtotal.toFixed(2)}`;
  countEl.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
}
async function handleOrderConfirmation() {
  const customerInfo = {
    firstName: document.getElementById('customerFirstName').value.trim(),
    lastName: document.getElementById('customerLastName').value.trim(),
    email: document.getElementById('customerEmail').value.trim().toLowerCase(),
    phone: document.getElementById('customerPhone').value.trim(),
    address: [
    document.getElementById('customerStreet')?.value.trim(),
    document.getElementById('customerCity')?.value.trim(),
    document.getElementById('customerProvince')?.value.trim()
  ].filter(part => part).join(', ')
  };
  const paymentMethod = document.getElementById('paymentMethod').value;
  const errors = [];
  if (!customerInfo.firstName || customerInfo.firstName.length < 2) {
    errors.push('First name must be at least 2 characters');
  }
  if (!customerInfo.lastName || customerInfo.lastName.length < 2) {
    errors.push('Last name must be at least 2 characters');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(customerInfo.email)) {
    errors.push('Please enter a valid email address');
  }
  if (!customerInfo.phone) {
    errors.push('Phone number is required');
  } else if (!/^[0-9]{11}$/.test(customerInfo.phone)) {
    errors.push('Phone number must be exactly 11 digits and contain only numbers');
  }
  if (!customerInfo.address) {
    errors.push('Please enter a delivery address');
  }
  if (errors.length > 0) {
    showToast(errors.join(' '), 'error');
    return;
  }
  let deliveryFee = 0;
  try {
    const feeRes = await apiCall('/delivery-fee', {
      method: 'POST',
      body: JSON.stringify({ address: customerInfo.address })
    });
    deliveryFee = feeRes.fee || 0;
  } catch (err) {
    console.warn('Failed to fetch delivery fee, using default ₱80:', err);
    deliveryFee = 80;
  }
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalWithFee = subtotal + deliveryFee;
  document.getElementById('orderSubtotal').textContent = `₱${subtotal.toFixed(2)}`;
  document.getElementById('orderDeliveryFee').textContent = `₱${deliveryFee.toFixed(2)}`;
  document.getElementById('orderTotalWithFee').textContent = `₱${totalWithFee.toFixed(2)}`;
  const orderItems = cart.map(item => ({
    productId: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    size: item.size,
    mood: item.mood,
    sugar: item.sugar
  }));
  const customerId = getCustomerIdFromToken() || "000000000000000000000000";
  const payload = {
    customerId: customerId,
    customerEmail: customerInfo.email,
    items: orderItems,
    totalAmount: subtotal,
    paymentMethod: paymentMethod,
    deliveryAddress: customerInfo.address
  };
  try {
    await apiCall('/orders', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    showToast('Order placed successfully! 🎉', 'success');
    cart = [];
    localStorage.setItem('tambayanCart', JSON.stringify(cart));
    updateCartUI();
    closeOrderConfirmationModal();
    closeCartModal();
    showView('dashboard');
    loadRecentOrders();
    loadCurrentOrderForTracker();
  } catch (err) {
    if (err.message.includes("Insufficient stock")) {
      showToast(`Stock error: ${err.message}`, 'error');
    } else {
      showToast('Failed to place order: ' + err.message, 'error');
    }
  }
}
function closeOrderConfirmationModal() {
  const modal = document.getElementById('orderConfirmationModal');
  if (!modal) return;
  modal.style.display = 'none';
}
function openChangePasswordModal() {
  const modal = document.getElementById('changePasswordModal');
  if (modal) {
    modal.style.display = 'block';
    const currentPasswordInput = document.getElementById('currentPassword');
    if (currentPasswordInput) {
      currentPasswordInput.value = '';
    }
    const newPasswordInput = document.getElementById('newPassword');
    if (newPasswordInput) {
      newPasswordInput.value = '';
    }
    const confirmPasswordInput = document.getElementById('confirmNewPassword');
    if (confirmPasswordInput) {
      confirmPasswordInput.value = '';
    }
    const cancelBtn = document.getElementById('cancelPasswordBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function() {
        modal.style.display = 'none';
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        confirmPasswordInput.value = '';
      });
    }
  } else {
    console.error("Change password modal element with ID 'changePasswordModal' not found in the HTML.");
  }
}
async function loadMyOrders() {
    const tbody = document.getElementById('myOrdersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5">Loading your orders...</td></tr>';
    try {
        const orders = await apiCall('/customer/orders?limit=20');
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
async function handleReorder(order) {
  if (!order.items || !Array.isArray(order.items)) return;
  if (allMenuItems.length === 0) {
    await loadMenuItems();
  }
  order.items.forEach(item => {
    const fullItem = allMenuItems.find(mi => mi.id === (item.productId || item.id));
    if (!fullItem) return;
    let size = null;
    let mood = null;
    let sugar = null;
    if (fullItem.category === 'Drinks') {
      size = item.size ?? 'M';
      mood = item.mood ?? 'Hot';
      sugar = item.sugar ?? '50%';
    }
    addToCart(fullItem, item.quantity, size, mood, sugar);
  });
  showToast(`Items from order #${order.orderNumber} added to cart!`, 'success');
  updateCartUI();
  showView('menu');
}
function handleFeedback(order) {
    showToast(`Feedback form for order #${order.orderNumber} would open here.`, 'info');
}
async function loadProfileSettings() {
    try {
        const profile = await apiCall('/user/profile');
        document.getElementById('firstName').value = profile.firstName || '';
        document.getElementById('lastName').value = profile.lastName || '';
        document.getElementById('email').value = profile.email || '';
        document.getElementById('phone').value = profile.phoneNumber || '';
        if (profile.address) {
          const parts = profile.address.split(',').map(p => p.trim());
          document.getElementById('address').value = parts[0] || '';
          document.getElementById('city').value = parts[1] || '';
          document.getElementById('province').value = parts[2] || '';
        } else {
          document.getElementById('address').value = '';
          document.getElementById('city').value = '';
          document.getElementById('province').value = '';
        }
        if (profile.birthday) {
            const date = new Date(profile.birthday);
            document.getElementById('birthday').value = date.toISOString().split('T')[0];
        } else {
            document.getElementById('birthday').value = '';
        }
        document.getElementById('gender').value = profile.gender || '';
    } catch (err) {
        console.error('Error loading profile settings:', err);
        showToast('Failed to load profile: ' + err.message, 'error');
    }
    loadSavedProfilePicture();
}
async function saveProfileSettings(e) {
  e.preventDefault();
  const street = document.getElementById('address').value.trim();
  const city = document.getElementById('city').value.trim();
  const province = document.getElementById('province').value.trim();

  const fullAddress = [street, city, province].filter(part => part).join(', ');

  const formData = {
      firstName: document.getElementById('firstName').value.trim(),
      lastName: document.getElementById('lastName').value.trim(),
      email: document.getElementById('email').value.trim().toLowerCase(),
      phoneNumber: document.getElementById('phone').value.trim(),
      address: fullAddress, // ✅ Required by backend (was missing)
      street: street,       // optional – backend uses TryGetProperty
      city: city,           // optional
      province: province,   // optional
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
  if (!formData.phoneNumber) {
    errors.push('Phone number is required');
  } else if (!/^[0-9]{11}$/.test(formData.phoneNumber)) {
    errors.push('Phone number must be exactly 11 digits and contain only numbers');
  }
  if (errors.length > 0) {
    showToast(errors.join(' '), 'error');
    return;
  }

  try {
    const response = await apiCall('/user/profile', {
      method: 'PUT',
      body: JSON.stringify(formData)
    });
    // Backend returns updated profile? If not, fall back to formData
    const updatedProfile = response?.user || response || formData;
    localStorage.setItem('customerInfo', JSON.stringify(updatedProfile));
    document.querySelector('.welcome').textContent = `Welcome back, ${updatedProfile.firstName}!`;
    showToast('Profile updated successfully!', 'success');
  } catch (err) {
    showToast('Failed to update profile: ' + err.message, 'error');
  }
}
function validatePhoneInput(e) {
  const phoneField = e.target.querySelector('#phone') || e.target.querySelector('#customerPhone');
  if (phoneField) {
    const phoneValue = phoneField.value.trim();
    if (phoneValue && !/^[0-9]{11}$/.test(phoneValue)) {
      e.preventDefault();
      showToast('Phone number must be exactly 11 digits and contain only numbers', 'error');
      return false;
    }
  }
  return true;
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
    const subtotalEl = document.getElementById('cartSubtotal');
    const deliveryFeeEl = document.getElementById('cartDeliveryFee');
    const totalWithFeeEl = document.getElementById('cartTotalWithFee');
    const countEl = document.getElementById('cartItemCount');
    if (!container || !subtotalEl || !deliveryFeeEl || !totalWithFeeEl || !countEl) return;
    if (cart.length === 0) {
        container.innerHTML = '<p>Your cart is empty.</p>';
        if (subtotalEl) subtotalEl.textContent = '₱0.00';
        if (deliveryFeeEl) deliveryFeeEl.textContent = '₱0.00';
        if (totalWithFeeEl) totalWithFeeEl.textContent = '₱0.00';
        if (countEl) countEl.textContent = '0';
        document.getElementById('checkoutBtn')?.setAttribute('disabled', 'true');
        return;
    }
    let html = '';
    let subtotal = 0;
    cart.forEach((item, index) => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
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
    if (subtotalEl) subtotalEl.textContent = `₱${subtotal.toFixed(2)}`;
    if (deliveryFeeEl) deliveryFeeEl.textContent = `₱0.00`;
    if (totalWithFeeEl) totalWithFeeEl.textContent = `₱${subtotal.toFixed(2)}`;
    if (countEl) countEl.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
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
    showAlert(
      'Clear Cart', 
      'Are you sure you want to clear your entire cart?', 
      true, 
      () => {
        cart = [];
        localStorage.setItem('tambayanCart', JSON.stringify(cart));
        updateCartUI();
        loadCartIntoModal();
        showToast('Cart cleared.', 'info');
      },
      () => {}
    );
}
async function deleteAccount() {
  document.getElementById('deleteConfirmModal').style.display = 'flex';
  document.getElementById('passwordInput').focus();
}
async function setupDeleteConfirmation() {
  const deleteConfirmModal = document.getElementById('deleteConfirmModal');
  const passwordInput = document.getElementById('passwordInput');
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  cancelDeleteBtn.addEventListener('click', function() {
    deleteConfirmModal.style.display = 'none';
    passwordInput.value = '';
  });
  confirmDeleteBtn.addEventListener('click', async function() {
    const password = passwordInput.value.trim();
    if (!password) {
      showToast('Please enter your password.', 'error');
      return;
    }
    try {
      showAlert(
        'Confirm Account Deletion',
        'Are you absolutely sure you want to delete your account? This action cannot be undone and all your data will be permanently removed.',
        true,
        async () => {
          try {
            await apiCall('/user', {
              method: 'DELETE',
              body: JSON.stringify({
                passwordConfirmation: password
              })
            });
            localStorage.removeItem('customerToken');
            localStorage.removeItem('customerInfo');
            localStorage.removeItem('tambayanCart');
            showToast('Your account has been successfully deleted. You will be redirected to the login page.', 'success');
            setTimeout(() => {
              window.location.href = '/html/login.html';
            }, 2000);
          } catch (err) {
            showToast('Account deletion failed: ' + err.message, 'error');
          }
        },
        () => {}
      );
      deleteConfirmModal.style.display = 'none';
      passwordInput.value = '';
    } catch (err) {
      showToast('Failed to verify password: ' + err.message, 'error');
    }
  });
  deleteConfirmModal.addEventListener('click', function(e) {
    if (e.target === deleteConfirmModal) {
      deleteConfirmModal.style.display = 'none';
      passwordInput.value = '';
    }
  });
}
async function changePassword(e) {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    const confirmNewPassword = document.getElementById('confirmNewPassword').value.trim();
    if (!currentPassword || !newPassword || !confirmNewPassword) {
        showToast('All password fields are required.', 'error');
        return;
    }
    if (newPassword !== confirmNewPassword) {
        showToast('New passwords do not match.', 'error');
        return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(newPassword)) {
        showToast('New password must be at least 8 characters and include uppercase, lowercase, number, and symbol.', 'error');
        return;
    }
    try {
        await apiCall('/user/change-password', {
            method: 'POST',
            body: JSON.stringify({
                currentPassword,
                newPassword
            })
        });
        showToast('Password changed successfully!', 'success');
        document.getElementById('changePasswordForm').reset();
    } catch (err) {
        showToast('Change Password Failed: ' + err.message, 'error');
    }
}
function initializeProfileFormListeners() {
    document.getElementById('changePasswordForm')?.addEventListener('submit', changePassword);
    document.querySelector('.open-change-password-btn')?.addEventListener('click', openChangePasswordModal);
    document.getElementById('closePasswordModal')?.addEventListener('click', function() {
        const modal = document.getElementById('changePasswordModal');
        if (modal) {
            modal.style.display = 'none';
        }
    });
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('changePasswordModal');
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    document.querySelector('.account-actions .btn-danger')?.addEventListener('click', deleteAccount);
    document.getElementById('profilePictureInput')?.addEventListener('change', handleProfilePictureUpload);
    document.getElementById('profileForm')?.addEventListener('submit', saveProfileSettings);
}
function handleProfilePictureUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file (JPEG, PNG, GIF, etc.)', 'error');
    return;
  }
  const reader = new FileReader();
  reader.onload = function(e) {
    const imageUrl = e.target.result;
    const profileImage = document.getElementById('profileImage');
    if (profileImage) {
      profileImage.src = imageUrl;
      profileImage.style.display = 'block';
      const defaultAvatar = document.querySelector('.default-avatar-icon');
      if (defaultAvatar) {
        defaultAvatar.style.display = 'none';
      }
    }
    localStorage.setItem('profilePicture', imageUrl);
  };
  reader.readAsDataURL(file);
}
function loadSavedProfilePicture() {
  const savedPicture = localStorage.getItem('profilePicture');
  if (savedPicture) {
    const profileImage = document.getElementById('profileImage');
    if (profileImage) {
      profileImage.src = savedPicture;
      profileImage.style.display = 'block';
      const defaultAvatar = document.querySelector('.default-avatar-icon');
      if (defaultAvatar) {
        defaultAvatar.style.display = 'none';
      }
    }
  }
}
function closeModalById(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}
function showToast(message, type = 'info', duration = 3000) {
  const toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    console.error('Toast container not found in DOM');
    return;
  }
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode === toastContainer) {
        toastContainer.removeChild(toast);
      }
    }, 300);
  }, duration);
}