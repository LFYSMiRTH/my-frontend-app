const API_BASE = 'https://tambayan-cafe-backend.onrender.com/api';

function goToLogin() {
  window.location.href = "/html/login.html";
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
    if (e.target === signupModal) signupModal.classList.add('hidden');
  });
}

// ===== LOGIN FORM HANDLER =====
const loginForm = document.getElementById('loginForm');
const loginUsername = document.getElementById('loginUsername');
const loginPassword = document.getElementById('loginPassword');

if (loginForm && loginUsername && loginPassword) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = loginUsername.value.trim();
    const password = loginPassword.value.trim();

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", [...response.headers]);

      if (response.ok) {
        const data = await response.json();
        console.log("Login response data:", data);
        loginPassword.classList.remove('input-error');

        // ✅ STORE TOKEN BASED ON USER ROLE
        const user = data.user;

        if (!user || !user.role) {
          alert("Login response format invalid.");
          return;
        }

        const role = user.role.toLowerCase().trim();

        if (role === 'admin') {
          localStorage.setItem('adminToken', data.token);
          localStorage.setItem('adminInfo', JSON.stringify(user));
          setTimeout(() => {
            window.location.href = '/html/adminDashboard.html';
          }, 100);
        } else if (role === 'staff') {
          localStorage.setItem('staffToken', data.token);
          localStorage.setItem('staffInfo', JSON.stringify(user));
          window.location.href = '/html/staffDashboard.html';
        } else if (role === 'customer') {
          localStorage.setItem('customerToken', data.token);
          localStorage.setItem('customerInfo', JSON.stringify(user));
          window.location.href = '/html/customerDashboard.html';
        } else {
          alert("Unknown role. Access denied.");
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
      alert('Login failed: ' + (err.message || 'Network error'));
      loginPassword.classList.add('input-error');
      setTimeout(() => {
        loginPassword.classList.remove('input-error');
      }, 500);
    }
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
      const res = await fetch(`${API_BASE}/user/check-username?username=${encodeURIComponent(username)}`);
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
      const res = await fetch(`${API_BASE}/user/check-email?email=${encodeURIComponent(email)}`);
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
      const response = await fetch(`${API_BASE}/user/register`, {
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
    const res = await fetch(`${API_BASE}/user/forgot-password`, {
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
    const res = await fetch(`${API_BASE}/user/verify-reset-code`, {
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
    const res = await fetch(`${API_BASE}/user/reset-password`, {
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
      window.location.href = '/html/login.html';
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
      { name: "John Timothy Yanto", image: "/Team/image1.jpg" },
      { name: "Marq Kenjie Buencosejo", image: "/Team/image2.jpeg" },
      { name: "Russel Pelea", image: "/Team/image3.jpeg" },
      { name: "Allan Alamo", image: "/Team/image4.jpg" },
      { name: "Timothy Jade Montano", image: "/Team/image5.jpg" }
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