/**
 * CAPRICHOS - CONTROLADOR PRINCIPAL DE LA APLICACIÓN WEB
 * Renderizado del catálogo, filtros, buscador, modal de producto y carrito
 */

document.addEventListener("DOMContentLoaded", () => {
  initApp();
});

let activeCategory = "all";
let currentModalProduct = null;
let currentModalSelection = {
  size: null,
  milk: null,
  sweetener: null,
  toppings: [],
  notes: "",
  quantity: 1
};

function initApp() {
  renderCategoryPills();
  renderProducts();
  setupSearch();
  setupCartUI();
  setupGlobalModals();

  // Suscribirse a cambios del carrito
  if (window.cart) {
    window.cart.subscribe(updateCartUI);
  }
}

// ==========================================
// RENDERIZADO DE CATEGORÍAS
// ==========================================
const CATEGORIES = [
  { id: "all", name: "Todos", icon: "✨" },
  { id: "calientes", name: "Calientes", icon: "☕" },
  { id: "frappes", name: "Frappés", icon: "🍹" },
  { id: "iced_frozen", name: "Iced & Frozen", icon: "🧊" },
  { id: "salados", name: "Salados", icon: "🥪" },
  { id: "croissants", name: "Croissants", icon: "🥐" },
  { id: "waffles", name: "Waffles", icon: "🧇" },
  { id: "postres", name: "Postres", icon: "🍩" },
  { id: "combos", name: "Promos & Combos", icon: "🎁" }
];

function renderCategoryPills() {
  const container = document.getElementById("categories-bar");
  if (!container) return;

  container.innerHTML = CATEGORIES.map(cat => `
    <button class="category-pill ${cat.id === activeCategory ? 'active' : ''}" data-cat="${cat.id}">
      <span class="cat-icon">${cat.icon}</span>
      <span class="cat-name">${cat.name}</span>
    </button>
  `).join("");

  container.querySelectorAll(".category-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      container.querySelectorAll(".category-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      activeCategory = btn.dataset.cat;
      renderProducts();
    });
  });
}

// ==========================================
// RENDERIZADO DEL CATÁLOGO DE PRODUCTOS
// ==========================================
function renderProducts(query = "") {
  const container = document.getElementById("products-grid");
  if (!container) return;

  const q = query.toLowerCase().trim();

  let filtered = CAPRICHOS_MENU.filter(p => {
    const matchCat = activeCategory === "all" || p.category === activeCategory;
    const matchQuery = !q ||
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.categoryName.toLowerCase().includes(q);
    return matchCat && matchQuery;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-results-box">
        <div class="empty-icon">🔍</div>
        <h3>No encontramos ese producto</h3>
        <p>Prueba buscando con otro nombre como <em>Frappé</em>, <em>Waffle</em>, <em>Sándwich</em> o <em>Dona</em>.</p>
        <button class="btn-secondary" onclick="resetFilters()">Ver toda la carta</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(p => {
    const priceText = p.sizes && p.sizes.length > 1
      ? `Desde S/ ${p.sizes[0].price.toFixed(2)}`
      : `S/ ${p.defaultPrice.toFixed(2)}`;

    const badgeHtml = p.badge
      ? `<span class="product-badge">${p.badge}</span>`
      : "";

    // Manejo de imagen con fallback visual seguro
    const imgHtml = `
      <div class="card-img-wrapper">
        ${badgeHtml}
        <img src="${p.image}" alt="${p.name}" class="product-card-img" loading="lazy" onerror="this.src='assets/CartaDigital.pdf'; this.classList.add('img-fallback');" />
      </div>
    `;

    return `
      <article class="product-card" onclick="openProductModal('${p.id}')">
        ${imgHtml}
        <div class="card-body">
          <div class="card-cat-tag">${p.categoryName}</div>
          <h3 class="card-title">${p.name}</h3>
          <p class="card-desc">${p.description}</p>
          <div class="card-footer">
            <span class="card-price">${priceText}</span>
            <button class="btn-add-item" onclick="event.stopPropagation(); openProductModal('${p.id}')" aria-label="Agregar ${p.name}">
              <span>Agregar</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");
}

function resetFilters() {
  activeCategory = "all";
  const searchInput = document.getElementById("search-input");
  if (searchInput) searchInput.value = "";
  renderCategoryPills();
  renderProducts();
}

// ==========================================
// BUSCADOR EN TIEMPO REAL
// ==========================================
function setupSearch() {
  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("clear-search-btn");

  if (!searchInput) return;

  searchInput.addEventListener("input", (e) => {
    const val = e.target.value;
    if (clearBtn) clearBtn.style.display = val ? "block" : "none";
    renderProducts(val);
  });

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      searchInput.value = "";
      clearBtn.style.display = "none";
      renderProducts();
      searchInput.focus();
    });
  }
}

// ==========================================
// MODAL DE DETALLE Y PERSONALIZACIÓN DE PRODUCTO
// ==========================================
function openProductModal(productId) {
  const product = CAPRICHOS_MENU.find(p => p.id === productId);
  if (!product) return;

  currentModalProduct = product;
  currentModalSelection = {
    size: product.sizes ? product.sizes[0] : null,
    milk: product.allowsMilk ? BEVERAGE_CUSTOM_OPTIONS.milks[0] : null,
    sweetener: product.allowsSweetener ? BEVERAGE_CUSTOM_OPTIONS.sweeteners[0] : null,
    toppings: [],
    notes: "",
    quantity: 1
  };

  const modal = document.getElementById("product-modal");
  const content = document.getElementById("product-modal-body");
  if (!modal || !content) return;

  let optionsHtml = "";

  // 1. Selector de Tamaños (si tiene)
  if (product.sizes && product.sizes.length > 0) {
    optionsHtml += `
      <div class="modal-section">
        <label class="modal-section-title">Elige el Tamaño:</label>
        <div class="options-grid size-options">
          ${product.sizes.map((s, idx) => `
            <button type="button" class="option-btn ${idx === 0 ? 'selected' : ''}" onclick="selectModalSize(${idx}, this)">
              <span class="opt-name">${s.name}</span>
              <span class="opt-price">S/ ${s.price.toFixed(2)}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  // 2. Selector de Leche (para bebidas)
  if (product.allowsMilk) {
    optionsHtml += `
      <div class="modal-section">
        <label class="modal-section-title">Tipo de Leche:</label>
        <div class="options-grid">
          ${BEVERAGE_CUSTOM_OPTIONS.milks.map((m, idx) => `
            <button type="button" class="option-btn ${idx === 0 ? 'selected' : ''}" onclick="selectModalMilk(${idx}, this)">
              <span class="opt-name">${m.name}</span>
              ${m.price > 0 ? `<span class="opt-price">+ S/ ${m.price.toFixed(2)}</span>` : '<span class="opt-free">Incluido</span>'}
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  // 3. Selector de Endulzante
  if (product.allowsSweetener) {
    optionsHtml += `
      <div class="modal-section">
        <label class="modal-section-title">Endulzante:</label>
        <div class="options-grid">
          ${BEVERAGE_CUSTOM_OPTIONS.sweeteners.map((sw, idx) => `
            <button type="button" class="option-btn ${idx === 0 ? 'selected' : ''}" onclick="selectModalSweetener(${idx}, this)">
              <span class="opt-name">${sw.name}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  // 4. Selector de Toppings y Adicionales (para frappés)
  if (product.allowsFrappeCustom) {
    optionsHtml += `
      <div class="modal-section">
        <label class="modal-section-title">Toppings & Extras:</label>
        <div class="options-grid">
          ${BEVERAGE_CUSTOM_OPTIONS.toppings.map((top, idx) => `
            <button type="button" class="option-btn check-opt" onclick="toggleModalTopping(${idx}, this)">
              <span class="opt-name">${top.name}</span>
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  // 5. Notas e instrucciones especiales
  optionsHtml += `
    <div class="modal-section">
      <label class="modal-section-title" for="modal-notes">Instrucciones o Cambios Especiales:</label>
      <textarea id="modal-notes" class="modal-textarea" placeholder="Ej: poco hielo, helado aparte, sin café, sin chantilly..." oninput="currentModalSelection.notes = this.value"></textarea>
    </div>
  `;

  content.innerHTML = `
    <div class="modal-product-header">
      <div class="modal-img-container">
        <img src="${product.image}" alt="${product.name}" onerror="this.src='assets/CartaDigital.pdf'; this.classList.add('img-fallback');" />
      </div>
      <div class="modal-header-info">
        <span class="modal-cat">${product.categoryName}</span>
        <h2 class="modal-title">${product.name}</h2>
        <p class="modal-desc">${product.description}</p>
      </div>
    </div>
    <div class="modal-body-content">
      ${optionsHtml}
    </div>
  `;

  updateModalTotal();
  modal.classList.add("open");
  document.body.classList.add("modal-open");
}

function closeProductModal() {
  const modal = document.getElementById("product-modal");
  if (modal) {
    modal.classList.remove("open");
    document.body.classList.remove("modal-open");
  }
}

function selectModalSize(index, element) {
  if (!currentModalProduct || !currentModalProduct.sizes) return;
  currentModalSelection.size = currentModalProduct.sizes[index];

  element.parentElement.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
  element.classList.add("selected");
  updateModalTotal();
}

function selectModalMilk(index, element) {
  currentModalSelection.milk = BEVERAGE_CUSTOM_OPTIONS.milks[index];
  element.parentElement.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
  element.classList.add("selected");
  updateModalTotal();
}

function selectModalSweetener(index, element) {
  currentModalSelection.sweetener = BEVERAGE_CUSTOM_OPTIONS.sweeteners[index];
  element.parentElement.querySelectorAll(".option-btn").forEach(b => b.classList.remove("selected"));
  element.classList.add("selected");
}

function toggleModalTopping(index, element) {
  const top = BEVERAGE_CUSTOM_OPTIONS.toppings[index];
  const foundIdx = currentModalSelection.toppings.findIndex(t => t.id === top.id);

  if (foundIdx >= 0) {
    currentModalSelection.toppings.splice(foundIdx, 1);
    element.classList.remove("selected");
  } else {
    currentModalSelection.toppings.push(top);
    element.classList.add("selected");
  }
  updateModalTotal();
}

function changeModalQty(delta) {
  currentModalSelection.quantity = Math.max(1, (currentModalSelection.quantity || 1) + delta);
  const qtyEl = document.getElementById("modal-qty-display");
  if (qtyEl) qtyEl.innerText = currentModalSelection.quantity;
  updateModalTotal();
}

function calculateModalUnitPrice() {
  if (!currentModalProduct) return 0;
  let basePrice = currentModalSelection.size
    ? currentModalSelection.size.price
    : currentModalProduct.defaultPrice;

  if (currentModalSelection.milk && currentModalSelection.milk.price) {
    basePrice += currentModalSelection.milk.price;
  }

  if (currentModalSelection.toppings && currentModalSelection.toppings.length > 0) {
    currentModalSelection.toppings.forEach(t => {
      basePrice += t.price || 0;
    });
  }

  return basePrice;
}

function updateModalTotal() {
  const unitPrice = calculateModalUnitPrice();
  const qty = currentModalSelection.quantity || 1;
  const total = unitPrice * qty;

  const totalEl = document.getElementById("modal-btn-total");
  if (totalEl) {
    totalEl.innerText = `S/ ${total.toFixed(2)}`;
  }
}

function addCurrentProductToCart() {
  if (!currentModalProduct || !window.cart) return;

  const unitPrice = calculateModalUnitPrice();
  const notesEl = document.getElementById("modal-notes");
  const notes = notesEl ? notesEl.value.trim() : "";

  window.cart.addItem({
    productId: currentModalProduct.id,
    name: currentModalProduct.name,
    category: currentModalProduct.category,
    image: currentModalProduct.image,
    size: currentModalSelection.size,
    milk: currentModalSelection.milk,
    sweetener: currentModalSelection.sweetener,
    toppings: [...currentModalSelection.toppings],
    notes: notes,
    unitPrice: unitPrice,
    quantity: currentModalSelection.quantity || 1
  });

  closeProductModal();
  showToast(`✅ ¡${currentModalProduct.name} agregado al carrito!`);
}

// ==========================================
// INTERFAZ Y DRAWER DEL CARRITO
// ==========================================
function setupCartUI() {
  const openCartBtns = document.querySelectorAll(".btn-open-cart");
  const closeCartBtn = document.getElementById("btn-close-cart");
  const cartDrawer = document.getElementById("cart-drawer");
  const cartBackdrop = document.getElementById("cart-backdrop");

  openCartBtns.forEach(b => {
    b.addEventListener("click", () => openCart());
  });

  if (closeCartBtn) {
    closeCartBtn.addEventListener("click", () => closeCart());
  }

  if (cartBackdrop) {
    cartBackdrop.addEventListener("click", () => closeCart());
  }

  // Switch de pestañas del drawer (Carrito vs Checkout)
  const tabCartBtn = document.getElementById("tab-btn-cart");
  const tabCheckoutBtn = document.getElementById("tab-btn-checkout");

  if (tabCartBtn && tabCheckoutBtn) {
    tabCartBtn.addEventListener("click", () => switchCartTab("cart"));
    tabCheckoutBtn.addEventListener("click", () => switchCartTab("checkout"));
  }

  const goCheckoutBtn = document.getElementById("btn-go-to-checkout");
  if (goCheckoutBtn) {
    goCheckoutBtn.addEventListener("click", () => switchCartTab("checkout"));
  }

  const btnSendWa = document.getElementById("btn-send-whatsapp");
  if (btnSendWa) {
    btnSendWa.addEventListener("click", () => {
      if (window.checkout) {
        window.checkout.sendToWhatsApp();
      }
    });
  }

  const btnGps = document.getElementById("btn-use-gps");
  if (btnGps) {
    btnGps.addEventListener("click", () => {
      if (window.deliveryMap) {
        window.deliveryMap.useCurrentGPS();
      }
    });
  }
}

function openCart() {
  const drawer = document.getElementById("cart-drawer");
  const backdrop = document.getElementById("cart-backdrop");
  if (drawer && backdrop) {
    drawer.classList.add("open");
    backdrop.classList.add("open");
    document.body.classList.add("drawer-open");
  }
}

function closeCart() {
  const drawer = document.getElementById("cart-drawer");
  const backdrop = document.getElementById("cart-backdrop");
  if (drawer && backdrop) {
    drawer.classList.remove("open");
    backdrop.classList.remove("open");
    document.body.classList.remove("drawer-open");
  }
}

function switchCartTab(tab) {
  const tabCartBtn = document.getElementById("tab-btn-cart");
  const tabCheckoutBtn = document.getElementById("tab-btn-checkout");
  const viewCart = document.getElementById("cart-items-view");
  const viewCheckout = document.getElementById("cart-checkout-view");

  if (tab === "checkout") {
    if (window.cart && window.cart.getItemCount() === 0) {
      alert("Agrega primero tus productos al carrito.");
      return;
    }
    if (tabCartBtn) tabCartBtn.classList.remove("active");
    if (tabCheckoutBtn) tabCheckoutBtn.classList.add("active");
    if (viewCart) viewCart.style.display = "none";
    if (viewCheckout) viewCheckout.style.display = "block";

    // Inicializar mapa si aún no se ha abierto
    setTimeout(() => {
      if (window.deliveryMap) {
        window.deliveryMap.init("delivery-map");
      }
    }, 150);
  } else {
    if (tabCartBtn) tabCartBtn.classList.add("active");
    if (tabCheckoutBtn) tabCheckoutBtn.classList.remove("active");
    if (viewCart) viewCart.style.display = "block";
    if (viewCheckout) viewCheckout.style.display = "none";
  }
}

function updateCartUI(cartInstance) {
  const count = cartInstance.getItemCount();
  const subtotal = cartInstance.getSubtotal();
  const deliveryFee = cartInstance.getEffectiveDeliveryCost();
  const total = cartInstance.getTotal();

  // Actualizar badges
  document.querySelectorAll(".cart-count-badge").forEach(el => {
    el.innerText = count;
    el.style.display = count > 0 ? "inline-flex" : "none";
  });

  // Barra flotante inferior en móviles
  const mobileBar = document.getElementById("mobile-cart-bar");
  if (mobileBar) {
    mobileBar.style.display = count > 0 ? "flex" : "none";
    const totalEl = mobileBar.querySelector(".mobile-cart-total");
    const countEl = mobileBar.querySelector(".mobile-cart-count");
    if (totalEl) totalEl.innerText = `S/ ${total.toFixed(2)}`;
    if (countEl) countEl.innerText = `${count} producto${count > 1 ? 's' : ''}`;
  }

  // Renderizar lista en el drawer
  const container = document.getElementById("cart-items-list");
  const emptyBox = document.getElementById("cart-empty-message");
  const checkoutSummaryBox = document.getElementById("cart-summary-box");

  if (!container) return;

  const items = cartInstance.getItems();

  if (items.length === 0) {
    if (container) container.innerHTML = "";
    if (emptyBox) emptyBox.style.display = "flex";
    if (checkoutSummaryBox) checkoutSummaryBox.style.display = "none";
    return;
  }

  if (emptyBox) emptyBox.style.display = "none";
  if (checkoutSummaryBox) checkoutSummaryBox.style.display = "block";

  container.innerHTML = items.map(item => {
    const details = [];
    if (item.size) details.push(item.size.name);
    if (item.milk) details.push(item.milk.name);
    if (item.sweetener) details.push(item.sweetener.name);
    if (item.toppings && item.toppings.length > 0) {
      details.push(item.toppings.map(t => t.name).join(", "));
    }
    if (item.notes) details.push(`<em>"${item.notes}"</em>`);

    const detailsHtml = details.length > 0
      ? `<div class="cart-item-details">${details.join(" • ")}</div>`
      : "";

    return `
      <div class="cart-item-card">
        <img src="${item.image}" alt="${item.name}" class="cart-item-img" onerror="this.src='assets/CartaDigital.pdf'; this.classList.add('img-fallback');" />
        <div class="cart-item-info">
          <h4 class="cart-item-title">${item.name}</h4>
          ${detailsHtml}
          <div class="cart-item-price">S/ ${(item.unitPrice * item.quantity).toFixed(2)}</div>
        </div>
        <div class="cart-item-actions">
          <div class="qty-stepper">
            <button type="button" class="btn-qty" onclick="cart.updateQuantity('${item.cartId}', -1)">-</button>
            <span class="qty-num">${item.quantity}</span>
            <button type="button" class="btn-qty" onclick="cart.updateQuantity('${item.cartId}', 1)">+</button>
          </div>
          <button type="button" class="btn-remove-item" onclick="cart.removeItem('${item.cartId}')" title="Eliminar">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
  }).join("");

  // Totales
  const subtotalEl = document.getElementById("summary-subtotal");
  const deliveryEl = document.getElementById("summary-delivery");
  const totalEl = document.getElementById("summary-total");
  const freeNotice = document.getElementById("free-delivery-notice");

  if (subtotalEl) subtotalEl.innerText = `S/ ${subtotal.toFixed(2)}`;

  if (deliveryEl) {
    if (cartInstance.getDeliveryMode() === "recojo") {
      deliveryEl.innerHTML = `<span class="badge-free">S/ 0.00 (Recojo)</span>`;
    } else if (cartInstance.isFreeDelivery()) {
      deliveryEl.innerHTML = `<span class="badge-free">¡GRATIS! 🎉</span>`;
    } else {
      deliveryEl.innerText = `S/ ${deliveryFee.toFixed(2)}`;
    }
  }

  if (totalEl) totalEl.innerText = `S/ ${total.toFixed(2)}`;

  if (freeNotice) {
    if (cartInstance.getDeliveryMode() === "delivery") {
      if (subtotal < 70) {
        const falta = (70 - subtotal).toFixed(2);
        freeNotice.style.display = "block";
        freeNotice.innerHTML = `🛵 Agrega <strong>S/ ${falta}</strong> más para tener <strong>Delivery GRATIS</strong> 🎉`;
      } else {
        freeNotice.style.display = "block";
        freeNotice.innerHTML = `🎉 ¡Felicidades! Tienes <strong>Delivery GRATIS</strong> en este pedido.`;
      }
    } else {
      freeNotice.style.display = "none";
    }
  }
}

// ==========================================
// TOAST DE NOTIFICACIÓN
// ==========================================
function showToast(message) {
  let toast = document.getElementById("toast-notification");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-notification";
    toast.className = "toast-notification";
    document.body.appendChild(toast);
  }

  toast.innerHTML = message;
  toast.classList.add("show");

  clearTimeout(window._toastTimeout);
  window._toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 2800);
}
window.showToast = showToast;

// ==========================================
// MODAL DE CONFIGURACIÓN DE NÚMERO (TESTER)
// ==========================================
function setupGlobalModals() {
  const testerBtn = document.getElementById("btn-open-wa-tester");
  const testerModal = document.getElementById("tester-modal");
  const closeTesterBtn = document.getElementById("btn-close-tester");
  const saveTesterBtn = document.getElementById("btn-save-tester");

  if (testerBtn && testerModal) {
    testerBtn.addEventListener("click", () => {
      testerModal.classList.add("open");
    });
  }

  if (closeTesterBtn && testerModal) {
    closeTesterBtn.addEventListener("click", () => {
      testerModal.classList.remove("open");
    });
  }

  if (saveTesterBtn) {
    saveTesterBtn.addEventListener("click", () => {
      const input = document.getElementById("tester-phone-input");
      if (input && input.value) {
        if (window.checkout) {
          window.checkout.setCustomWhatsAppNumber(input.value);
        }
        showToast(`📲 Número de WhatsApp actualizado a: ${input.value}`);
        testerModal.classList.remove("open");
      }
    });
  }
}
