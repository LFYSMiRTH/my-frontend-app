const API_BASE = 'https://tambayan-cafe-backend.onrender.com';

function goToLogin() {
  window.location.href = "/login";
}

const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const drinkGrid = document.getElementById('drinkGrid');
const drinkDetail = document.getElementById('drinkDetail');
const detailContent = document.getElementById('detailContent');
const closeBtn = document.querySelector('.close-btn');
const backBtn = document.querySelector('.back-btn');

const drinksData = [
  {
    name: "Spanish Latte",
    image: "../../Drinks/Spanish Latte.jpg",
    description: "A creamy blend of espresso, condensed milk, and frothy milk—sweet, rich, and smooth."
  },
  {
    name: "Caramel Macchiato",
    image: "../../Drinks/Caramel Macchiato.jpg",
    description: "Espresso poured over vanilla-infused milk, topped with caramel drizzle for a sweet finish."
  },
  {
    name: "Vanilla Cold Brew",
    image: "../../Drinks/vanilla cold brew.jpg",
    description: "Smooth cold brew steeped for 12 hours, sweetened with vanilla syrup—refreshingly bold."
  },
  {
    name: "Matcha Latte",
    image: "../../Drinks/Matcha Latte.jpg",
    description: "Premium ceremonial matcha whisked with steamed milk—earthy, vibrant, and calming."
  },
  {
    name: "Chocolate Overload",
    image: "../../Drinks/Chocolate Overload.jpg",
    description: "Decadent hot chocolate with dark and milk chocolate, topped with whipped cream and shavings."
  },
  {
    name: "Espresso Shot",
    image: "../../Drinks/Expresso Shot.jpg",
    description: "A concentrated 30ml shot of rich, aromatic coffee—pure and intense."
  },
  {
    name: "Iced Americano",
    image: "../../Drinks/Americano.jpg",
    description: "Espresso diluted with hot water for a smooth, clean coffee experience—bold but balanced."
  }
];

const sandwichesData = [
  {
    name: "Chicken Pesto",
    image: "../../Sandwiches/Chicken Pesto.jpg",
    description: "Grilled chicken breast with fresh basil pesto, mozzarella, and sun-dried tomatoes on ciabatta."
  },
  {
    name: "Clubhouse",
    image: "../../Sandwiches/Clubhouse.jpg",
    description: "Triple-layer sandwich with turkey, bacon, lettuce, tomato, and mayo on toasted multigrain bread."
  },
  {
    name: "Grilled Cheese Supreme",
    image: "../../Sandwiches/Grilled Cheese Supreme.jpg",
    description: "Three-cheese blend (cheddar, mozzarella, gouda) grilled to golden perfection with a hint of garlic butter."
  },
  {
    name: "Tuna Melt",
    image: "../../Sandwiches/Tuna Melt.jpg",
    description: "Creamy tuna salad topped with melted Swiss cheese on sourdough, grilled until crispy."
  }
];

const dessertsData = [
  {
    name: "Choco Lava Cake",
    image: "../../Dessert/Choco Lava Cake.jpg",
    description: "Warm chocolate cake with a molten center, served with vanilla ice cream."
  },
  {
    name: "Cookie Sandwich",
    image: "../../Dessert/Cookie Sandwich.jpg",
    description: "Two soft-baked chocolate chip cookies hugging a layer of creamy ice cream or frosting."
  },
  {
    name: "Ice Cream Parfait",
    image: "../../Dessert/Ice Cream Parfait.jpg",
    description: "Layers of premium ice cream, fresh fruit, granola, and honey drizzle in a chilled glass."
  },
  {
    name: "Tiramisu",
    image: "../../Dessert/Tiramisu.jpg",
    description: "Classic Italian dessert with coffee-soaked ladyfingers, mascarpone cream, and cocoa dust."
  }
];

let isModalOpen = false;
let currentCategory = null;

if (modalOverlay && drinkGrid) {
  function openCategoryModal(category) {
    if (isModalOpen) return;

    currentCategory = category;
    let items = [];
    let title = '';

    if (category === 'drinks') {
      items = drinksData;
      title = 'Drinks';
    } else if (category === 'sandwiches') {
      items = sandwichesData;
      title = 'Sandwiches';
    } else if (category === 'dessert') {
      items = dessertsData;
      title = 'Desserts';
    } else {
      return;
    }

    modalTitle.textContent = title;

    drinkGrid.innerHTML = '';
    items.forEach((item, index) => {
      const card = document.createElement('div');
      card.classList.add('drink-card');
      card.setAttribute('data-index', index);

      card.innerHTML = `
        <img src="${item.image}" alt="${item.name}">
        <div class="drink-name">${item.name}</div>
      `;
      drinkGrid.appendChild(card);

      card.addEventListener('click', () => showItemDetail(index));
    });

    modalOverlay.classList.remove('hidden');
    setTimeout(() => {
      modalOverlay.classList.add('active');
      isModalOpen = true;
    }, 10);
  }

  function showItemDetail(index) {
    let item;
    if (currentCategory === 'drinks') {
      item = drinksData[index];
    } else if (currentCategory === 'sandwiches') {
      item = sandwichesData[index];
    } else if (currentCategory === 'dessert') {
      item = dessertsData[index];
    }

    detailContent.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <h4>${item.name}</h4>
      <p>${item.description}</p>
    `;
    drinkGrid.classList.add('hidden');
    drinkDetail.classList.remove('hidden');
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    setTimeout(() => {
      modalOverlay.classList.add('hidden');
      drinkDetail.classList.add('hidden');
      drinkGrid.classList.remove('hidden');
      drinkGrid.innerHTML = '';
      detailContent.innerHTML = '';
      isModalOpen = false;
      currentCategory = null;
    }, 400);
  }

  if (backBtn) {
    backBtn.addEventListener('click', () => {
      drinkDetail.classList.add('hidden');
      drinkGrid.classList.remove('hidden');
    });
  }

  const drinksCategory = document.querySelector('.category-item[data-category="drinks"]');
  const sandwichesCategory = document.querySelector('.category-item[data-category="sandwiches"]');
  const dessertCategory = document.querySelector('.category-item[data-category="dessert"]');

  if (drinksCategory) {
    drinksCategory.addEventListener('click', () => openCategoryModal('drinks'));
  }

  if (sandwichesCategory) {
    sandwichesCategory.addEventListener('click', () => openCategoryModal('sandwiches'));
  }

  if (dessertCategory) {
    dessertCategory.addEventListener('click', () => openCategoryModal('dessert'));
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });
}

const signupModal = document.getElementById('signupModal');
const openSignup = document.getElementById('openSignup');
const closeSignup = document.getElementById('closeSignup');

if (openSignup && closeSignup && signupModal) {
  openSignup.addEventListener('click', (e) => {
    e.preventDefault();
    signupModal.classList.remove('hidden');
  });

  closeSignup.addEventListener('click', (e) => {
    e.preventDefault();
    signupModal.classList.add('hidden');
  });

  window.addEventListener('click', (e) => {
    if (e.target === signupModal) {
      signupModal.classList.add('hidden');
    }
  });
}

const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');
const forgotPasswordLink = document.getElementById('openForgotPassword');

if (loginForm && loginUsername && loginPassword) {
  const toggleForgotPassword = () => {
    const hasInput = loginUsername.value.trim() !== '' || loginPassword.value.trim() !== '';
    if (forgotPasswordLink) {
      forgotPasswordLink.style.pointerEvents = hasInput ? 'auto' : 'none';
      forgotPasswordLink.style.opacity = hasInput ? '1' : '0.5';
    }
  };

  loginUsername.addEventListener('input', toggleForgotPassword);
  loginPassword.addEventListener('input', toggleForgotPassword);

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();

    const user = { username, password };
    try {
      const response = await fetch(`${API_BASE}/api/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });

      if (response.ok) {
        const data = await response.json();
        loginPassword.classList.remove('input-error');

        // ✅ STORE TOKEN PER ROLE
        if (data.role === 'admin') {
          localStorage.setItem('adminToken', data.token);
          localStorage.setItem('adminInfo', JSON.stringify({
            id: data.id,
            username: data.username,
            email: data.email
          }));
          window.location.href = '/html/adminDashboard.html';
        } else if (data.role === 'staff') {
          localStorage.setItem('staffToken', data.token);
          localStorage.setItem('staffInfo', JSON.stringify({
            id: data.id,
            username: data.username,
            email: data.email
          }));
          window.location.href = '/staff.html';
        } else if (data.role === 'customer') {
          localStorage.setItem('customerToken', data.token);
          localStorage.setItem('customerInfo', JSON.stringify({
            id: data.id,
            username: data.username,
            email: data.email
          }));
          window.location.href = '/customerDashboard.html';
        }
      } else {
        alert('Invalid username or password. Please try again.');
        loginPassword.classList.add('input-error');
        setTimeout(() => {
          loginPassword.classList.remove('input-error');
        }, 500);
      }
    } catch (err) {
      console.error('Login error:', err);
      loginPassword.classList.add('input-error');
      setTimeout(() => {
        loginPassword.classList.remove('input-error');
      }, 500);
    }
  });

  loginPassword.addEventListener('input', () => {
    loginPassword.classList.remove('input-error');
  });
}

const signupForm = document.getElementById('signupForm');
if (signupForm) {
  const usernameInput = document.getElementById('signupUsername');
  const emailInput = document.getElementById('signupEmail');
  const passwordInput = document.getElementById('signupPassword');
  const usernameError = document.getElementById('usernameError');
  const emailError = document.getElementById('emailError');
  const passwordError = document.getElementById('passwordError');
  const strengthBar = document.getElementById('strengthBar');

  usernameInput.addEventListener('input', () => {
    usernameError.textContent = '';
    usernameInput.classList.remove('input-error');
  });

  emailInput.addEventListener('input', () => {
    emailError.textContent = '';
    emailInput.classList.remove('input-error');
  });

  usernameInput.addEventListener('blur', async () => {
    const username = usernameInput.value.trim();
    if (username.length < 3) return;

    try {
      const res = await fetch(`${API_BASE}/api/user/check-username?username=${encodeURIComponent(username)}`);
      const result = await res.json();
      if (result.exists) {
        usernameError.textContent = 'Username already taken.';
        usernameInput.classList.add('input-error');
      }
    } catch (err) {
      console.error('Username check failed:', err);
    }
  });

  emailInput.addEventListener('blur', async () => {
    const email = emailInput.value.trim();
    if (!email.includes('@')) return;

    try {
      const res = await fetch(`${API_BASE}/api/user/check-email?email=${encodeURIComponent(email)}`);
      const result = await res.json();
      if (result.exists) {
        emailError.textContent = 'Email already registered.';
        emailInput.classList.add('input-error');
      }
    } catch (err) {
      console.error('Email check failed:', err);
    }
  });

  passwordInput.addEventListener('input', () => {
    const password = passwordInput.value;
    const strength = checkPasswordStrength(password);
    updateStrengthUI(strength);
  });

  function checkPasswordStrength(password) {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  }

  function updateStrengthUI(strength) {
    const width = Math.min(100, strength * 20);
    strengthBar.style.width = `${width}%`;
    strengthBar.className = '';
    if (strength < 3) strengthBar.classList.add('weak');
    else if (strength < 5) strengthBar.classList.add('medium');
    else strengthBar.classList.add('strong');

    passwordError.textContent = strength < 5
      ? 'Use 8+ characters with uppercase, lowercase, number, and symbol.'
      : '';
  }

  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    usernameError.textContent = '';
    emailError.textContent = '';
    passwordError.textContent = '';
    let hasError = false;

    if (checkPasswordStrength(password) < 5) {
      passwordError.textContent = 'Password is not strong enough.';
      passwordInput.classList.add('input-error');
      hasError = true;
    }

    if (hasError) return;

    const user = { username, email, password };

    try {
      const response = await fetch(`${API_BASE}/api/user/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });

      const result = await response.json();

      if (response.ok) {
        if (signupModal) signupModal.classList.add('hidden');
        alert('Account created successfully! You can now log in.');
        signupForm.reset();
        if (strengthBar) strengthBar.style.width = '0%';
      } else {
        if (result.error === 'UsernameExists') {
          usernameError.textContent = 'Username already taken.';
          usernameInput.classList.add('input-error');
        } else if (result.error === 'EmailExists') {
          emailError.textContent = 'Email already registered.';
          emailInput.classList.add('input-error');
        } else if (result.error === 'WeakPassword') {
          passwordError.textContent = 'Password does not meet security requirements.';
          passwordInput.classList.add('input-error');
        } else {
          alert('Failed to create account. Please try again.');
        }
      }
    } catch (err) {
      console.error('Signup error:', err);
      alert('Network error. Please check your connection.');
    }
  });
}

const forgotPasswordModal = document.getElementById('forgotPasswordModal');
const verifyCodeModal = document.getElementById('verifyCodeModal');
const newPasswordModal = document.getElementById('newPasswordModal');

document.getElementById('openForgotPassword')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (forgotPasswordModal) forgotPasswordModal.classList.remove('hidden');
});

document.getElementById('backToLoginFromForgot')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (forgotPasswordModal) forgotPasswordModal.classList.add('hidden');
});

[forgotPasswordModal, verifyCodeModal, newPasswordModal].forEach(modal => {
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.classList.add('hidden');
    });
  }
});

document.getElementById('backToEmailStep')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (verifyCodeModal) verifyCodeModal.classList.add('hidden');
  if (forgotPasswordModal) forgotPasswordModal.classList.remove('hidden');
});

document.getElementById('backToCodeStep')?.addEventListener('click', (e) => {
  e.preventDefault();
  if (newPasswordModal) newPasswordModal.classList.add('hidden');
  if (verifyCodeModal) verifyCodeModal.classList.remove('hidden');
});

document.getElementById('forgotPasswordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('resetEmail')?.value.trim();

  if (!email) return;

  try {
    const res = await fetch(`${API_BASE}/api/user/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    if (res.ok) {
      window.tempResetEmail = email;
      if (forgotPasswordModal) forgotPasswordModal.classList.add('hidden');
      if (verifyCodeModal) verifyCodeModal.classList.remove('hidden');
      if (document.getElementById('verificationCode')) {
        document.getElementById('verificationCode').value = '';
      }
    } else {
      alert('Failed to send code. Please try again.');
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    alert('Network error. Please check your connection.');
  }
});

document.getElementById('verifyCodeForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = document.getElementById('verificationCode')?.value.trim();

  if (!window.tempResetEmail) {
    alert('Session expired. Please start over.');
    if (verifyCodeModal) verifyCodeModal.classList.add('hidden');
    if (forgotPasswordModal) forgotPasswordModal.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/user/verify-reset-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: window.tempResetEmail, code })
    });

    if (res.ok) {
      if (verifyCodeModal) verifyCodeModal.classList.add('hidden');
      if (newPasswordModal) newPasswordModal.classList.remove('hidden');
      if (document.getElementById('newPassword')) document.getElementById('newPassword').value = '';
      if (document.getElementById('confirmNewPassword')) document.getElementById('confirmNewPassword').value = '';
    } else {
      alert('Invalid or expired code. Please check your email.');
    }
  } catch (err) {
    console.error('Verify code error:', err);
    alert('Verification failed. Please try again.');
  }
});

document.getElementById('newPasswordForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = document.getElementById('newPassword')?.value;
  const confirm = document.getElementById('confirmNewPassword')?.value;

  if (pass !== confirm) {
    alert('Passwords do not match.');
    return;
  }

  if (!window.tempResetEmail) {
    alert('Session expired. Please restart the process.');
    if (newPasswordModal) newPasswordModal.classList.add('hidden');
    if (forgotPasswordModal) forgotPasswordModal.classList.remove('hidden');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/user/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: window.tempResetEmail,
        code: document.getElementById('verificationCode')?.value,
        newPassword: pass
      })
    });

    if (res.ok) {
      if (newPasswordModal) newPasswordModal.classList.add('hidden');
      alert('✅ Password reset successfully! You can now log in.');
      window.location.href = '/login';
    } else {
      alert('Failed to reset password. Please try again.');
    }
  } catch (err) {
    console.error('Reset password error:', err);
    alert('Reset failed. Please check your connection.');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const teamImage = document.getElementById('teamImage');
  const teamName = document.getElementById('teamName');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  if (teamImage && teamName && prevBtn && nextBtn) {
    const teamMembers = [
      {
        name: "John Timothy Yanto",
        image: "/Team/image1.jpg"
      },
      {
        name: "Marq Kenjie Buencosejo",
        image: "/Team/image2.jpeg"
      },
      {
        name: "Russel Pelea",
        image: "/Team/image3.jpeg"
      },
      {
        name: "Allan Alamo",
        image: "/Team/image4.jpg"
      },
      {
        name: "Timothy Jade Montano",
        image: "/Team/image5.jpg"
      }
    ];

    let currentIndex = 0;

    function updateTeamMember(index) {
      const member = teamMembers[index];
      teamImage.src = member.image;
      teamName.textContent = member.name;
    }

    function showNext() {
      currentIndex = (currentIndex + 1) % teamMembers.length;
      updateTeamMember(currentIndex);
    }

    function showPrev() {
      currentIndex = (currentIndex - 1 + teamMembers.length) % teamMembers.length;
      updateTeamMember(currentIndex);
    }

    updateTeamMember(currentIndex);

    prevBtn.addEventListener('click', showPrev);
    nextBtn.addEventListener('click', showNext);
  }
});

function initPasswordToggles() {
  document.querySelectorAll('.password-wrapper .toggle-password:not([data-initialized])')
    .forEach(button => {
      button.setAttribute('data-initialized', 'true');
      button.addEventListener('click', function () {
        const input = this.previousElementSibling;
        const icon = this.querySelector('i');
        if (!input || !icon) return;

        if (input.type === 'password') {
          input.type = 'text';
          icon.classList.replace('fa-eye', 'fa-eye-slash');
        } else {
          input.type = 'password';
          icon.classList.replace('fa-eye-slash', 'fa-eye');
        }
      });
    });
}

document.addEventListener('DOMContentLoaded', initPasswordToggles);