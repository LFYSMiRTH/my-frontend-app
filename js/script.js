function goToLogin() {
  window.location.href = "login.html";
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
    image: "../Drinks/Spanish Latte.jpg",
    description: "A creamy blend of espresso, condensed milk, and frothy milk—sweet, rich, and smooth."
  },
  {
    name: "Caramel Macchiato",
    image: "../Drinks/Caramel Macchiato.jpg",
    description: "Espresso poured over vanilla-infused milk, topped with caramel drizzle for a sweet finish."
  },
  {
    name: "Vanilla Cold Brew",
    image: "../Drinks/vanilla cold brew.jpg",
    description: "Smooth cold brew steeped for 12 hours, sweetened with vanilla syrup—refreshingly bold."
  },
  {
    name: "Matcha Latte",
    image: "../Drinks/Matcha Latte.jpg",
    description: "Premium ceremonial matcha whisked with steamed milk—earthy, vibrant, and calming."
  },
  {
    name: "Chocolate Overload",
    image: "../Drinks/Chocolate Overload.jpg",
    description: "Decadent hot chocolate with dark and milk chocolate, topped with whipped cream and shavings."
  },
  {
    name: "Espresso Shot",
    image: "../Drinks/Expresso Shot.jpg",
    description: "A concentrated 30ml shot of rich, aromatic coffee—pure and intense."
  },
  {
    name: "Iced Americano",
    image: "../Drinks/Americano.jpg",
    description: "Espresso diluted with hot water for a smooth, clean coffee experience—bold but balanced."
  }
];

const sandwichesData = [
  {
    name: "Chicken Pesto",
    image: "../Sandwiches/Chicken Pesto.jpg",
    description: "Grilled chicken breast with fresh basil pesto, mozzarella, and sun-dried tomatoes on ciabatta."
  },
  {
    name: "Clubhouse",
    image: "../Sandwiches/Clubhouse.jpg",
    description: "Triple-layer sandwich with turkey, bacon, lettuce, tomato, and mayo on toasted multigrain bread."
  },
  {
    name: "Grilled Cheese Supreme",
    image: "../Sandwiches/Grilled Cheese Supreme.jpg",
    description: "Three-cheese blend (cheddar, mozzarella, gouda) grilled to golden perfection with a hint of garlic butter."
  },
  {
    name: "Tuna Melt",
    image: "../Sandwiches/Tuna Melt.jpg",
    description: "Creamy tuna salad topped with melted Swiss cheese on sourdough, grilled until crispy."
  }
];

const dessertsData = [
  {
    name: "Choco Lava Cake",
    image: "../Dessert/Choco Lava Cake.jpg",
    description: "Warm chocolate cake with a molten center, served with vanilla ice cream."
  },
  {
    name: "Cookie Sandwich",
    image: "../Dessert/Cookie Sandwich.jpg",
    description: "Two soft-baked chocolate chip cookies hugging a layer of creamy ice cream or frosting."
  },
  {
    name: "Ice Cream Parfait",
    image: "../Dessert/Ice Cream Parfait.jpg",
    description: "Layers of premium ice cream, fresh fruit, granola, and honey drizzle in a chilled glass."
  },
  {
    name: "Tiramisu",
    image: "../Dessert/Tiramisu.jpg",
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
const loginPassword = document.getElementById('loginPassword');

if (loginForm && loginPassword) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('loginUsername').value.trim();
    const password = loginPassword.value.trim();

    if (username === 'admin' && password === 'admin123') {
      localStorage.setItem(
        'adminData',
        JSON.stringify({
          username: 'admin',
          role: 'admin',
          isLoggedIn: true
        })
      );
      window.location.href = '../html/adminDashboard.html';
      return;
    }

    const user = { username, password };

    try {
      const response = await fetch('https://localhost:7179/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });

      if (response.ok) {
        const data = await response.json();
        loginPassword.classList.remove('input-error');
        localStorage.setItem('customerData', JSON.stringify(data));
        window.location.href = '../html/customerDashboard.html';
      } else {
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
  signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const user = {
      username: document.getElementById('signupUsername').value.trim(),
      email: document.getElementById('signupEmail').value.trim(),
      password: document.getElementById('signupPassword').value.trim()
    };

    try {
      const response = await fetch('https://localhost:7179/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });

      if (response.ok) {
        if (signupModal) signupModal.classList.add('hidden');
        alert('Account created successfully! You can now log in.');
      } else {
        const errorText = await response.text();
        console.error('Signup failed:', errorText);
        alert('Failed to create account. Please try again.');
      }
    } catch (err) {
      console.error('Signup error:', err);
      alert('Network error. Please check your connection.');
    }
  });
}

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