/**
 * CAPRICHOS - CHECKOUT Y ENVÍO A WHATSAPP
 * Gestión de datos del cliente, modalidad, validación y formateo del ticket
 */

class CheckoutManager {
  constructor() {
    this.storageKey = "caprichos_customer_v1";
    this.targetWhatsAppPhone = CAPRICHOS_WHATSAPP_PHONE;
    this.selectedPayment = "Yape";
    this.cashAmount = "";
    this.init();
  }

  init() {
    this.loadCustomerData();
    this.setupListeners();
  }

  loadCustomerData() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        const nameInput = document.getElementById("client-name");
        const phoneInput = document.getElementById("client-phone");
        const addrInput = document.getElementById("client-address");
        const refInput = document.getElementById("client-reference");

        if (nameInput && data.name) nameInput.value = data.name;
        if (phoneInput && data.phone) phoneInput.value = data.phone;
        if (addrInput && data.address) addrInput.value = data.address;
        if (refInput && data.reference) refInput.value = data.reference;
      }
    } catch (e) {
      console.warn("No se pudieron cargar datos guardados del cliente:", e);
    }
  }

  saveCustomerData(data) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(data));
    } catch (e) {
      console.warn("Error guardando datos del cliente:", e);
    }
  }

  setupListeners() {
    // Escuchar cambios de modalidad Delivery / Recojo
    const deliveryRadio = document.getElementById("mode-delivery");
    const recojoRadio = document.getElementById("mode-recojo");

    if (deliveryRadio) {
      deliveryRadio.addEventListener("change", () => {
        const lblDel = document.getElementById("lbl-mode-delivery");
        const lblRec = document.getElementById("lbl-mode-recojo");
        if (lblDel) lblDel.classList.add("selected");
        if (lblRec) lblRec.classList.remove("selected");
        this.handleModeChange("delivery");
      });
    }
    if (recojoRadio) {
      recojoRadio.addEventListener("change", () => {
        const lblDel = document.getElementById("lbl-mode-delivery");
        const lblRec = document.getElementById("lbl-mode-recojo");
        if (lblRec) lblRec.classList.add("selected");
        if (lblDel) lblDel.classList.remove("selected");
        this.handleModeChange("recojo");
      });
    }

    // Escuchar métodos de pago
    document.querySelectorAll(".payment-option-card").forEach(card => {
      card.addEventListener("click", () => {
        document.querySelectorAll(".payment-option-card").forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        this.selectedPayment = card.dataset.payment || "Yape";

        const cashBox = document.getElementById("cash-amount-container");
        if (cashBox) {
          cashBox.style.display = this.selectedPayment === "Efectivo" ? "block" : "none";
        }
      });
    });
  }

  handleModeChange(mode) {
    if (window.cart) {
      window.cart.setDeliveryMode(mode);
    }

    const deliverySection = document.getElementById("delivery-location-section");
    const recojoSection = document.getElementById("recojo-info-section");

    if (mode === "recojo") {
      if (deliverySection) deliverySection.style.display = "none";
      if (recojoSection) recojoSection.style.display = "block";
    } else {
      if (deliverySection) deliverySection.style.display = "block";
      if (recojoSection) recojoSection.style.display = "none";
      // Refrescar Leaflet
      setTimeout(() => {
        if (window.deliveryMap && window.deliveryMap.map) {
          window.deliveryMap.map.invalidateSize();
        }
      }, 200);
    }
  }

  formatPhonePeru(phone) {
    if (!phone) return "";
    let clean = phone.replace(/\D/g, "");
    if (clean.startsWith("51") && clean.length === 11) {
      clean = clean.substring(2);
    }
    return clean;
  }

  buildWhatsAppMessage() {
    const cart = window.cart;
    const items = cart.getItems();

    if (!items || items.length === 0) {
      alert("Tu carrito está vacío. Agrega tus antojos antes de continuar.");
      return null;
    }

    // Obtener campos del cliente
    const nameInput = document.getElementById("client-name");
    const phoneInput = document.getElementById("client-phone");
    const addrInput = document.getElementById("client-address");
    const refInput = document.getElementById("client-reference");
    const saveCheck = document.getElementById("client-save-data");

    const name = nameInput ? nameInput.value.trim() : "";
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const address = addrInput ? addrInput.value.trim() : "";
    const reference = refInput ? refInput.value.trim() : "";

    // Validaciones
    if (!name) {
      alert("Por favor ingresa tu Nombre y Apellido.");
      if (nameInput) nameInput.focus();
      return null;
    }

    const cleanPhone = this.formatPhonePeru(phone);
    if (!cleanPhone || cleanPhone.length < 9) {
      alert("Por favor ingresa un número de celular o WhatsApp válido (9 dígitos).");
      if (phoneInput) phoneInput.focus();
      return null;
    }

    const isDelivery = cart.getDeliveryMode() === "delivery";

    if (isDelivery && !address) {
      alert("Por favor ingresa tu dirección o referencia de entrega.");
      if (addrInput) addrInput.focus();
      return null;
    }

    // Guardar datos si el checkbox está activo
    if (saveCheck && saveCheck.checked) {
      this.saveCustomerData({
        name,
        phone: cleanPhone,
        address: isDelivery ? address : "",
        reference: isDelivery ? reference : ""
      });
    }

    // Obtener ubicación GPS si es delivery
    let locationData = null;
    if (isDelivery && window.deliveryMap) {
      locationData = window.deliveryMap.getLocationData();
    }

    const subtotal = cart.getSubtotal();
    const deliveryFee = cart.getEffectiveDeliveryCost();
    const total = cart.getTotal();

    // ---------------------------------------------------------
    // CONSTRUCCIÓN DEL MENSAJE FORMATEADO PARA WHATSAPP
    // ---------------------------------------------------------
    let msg = `*¡HOLA CAPRICHOS! DESEO REALIZAR UN PEDIDO:* 🍓☕\n\n`;

    msg += `📋 *DETALLE DEL PEDIDO:*\n`;
    items.forEach((item, index) => {
      msg += `• *${item.quantity}x ${item.name}*`;
      if (item.size) {
        msg += ` (${item.size.name})`;
      }
      msg += `\n`;

      if (item.milk && item.milk.name) {
        msg += `   - Leche: ${item.milk.name}\n`;
      }
      if (item.sweetener && item.sweetener.name) {
        msg += `   - Endulzante: ${item.sweetener.name}\n`;
      }
      if (item.toppings && item.toppings.length > 0) {
        const topNames = item.toppings.map(t => t.name).join(", ");
        msg += `   - Toppings: ${topNames}\n`;
      }
      if (item.notes) {
        msg += `   - Nota especial: ${item.notes}\n`;
      }
      msg += `   - Subtotal: S/ ${(item.unitPrice * item.quantity).toFixed(2)}\n`;
    });

    msg += `\n💵 *RESUMEN DE CUENTA:*\n`;
    msg += `- Subtotal productos: S/ ${subtotal.toFixed(2)}\n`;
    if (isDelivery) {
      if (cart.isFreeDelivery()) {
        msg += `- Costo de Delivery: ¡GRATIS! 🎉 (Promo compras > S/ 70)\n`;
      } else {
        const zonaLabel = locationData?.zone?.zona ? ` (${locationData.zone.zona})` : "";
        msg += `- Costo de Delivery: S/ ${deliveryFee.toFixed(2)}${zonaLabel}\n`;
      }
    } else {
      msg += `- Modalidad: Recojo en Tienda (S/ 0.00)\n`;
    }
    msg += `*👉 TOTAL A PAGAR: S/ ${total.toFixed(2)}*\n\n`;

    msg += `👤 *DATOS DEL CLIENTE:*\n`;
    msg += `- Nombre: ${name}\n`;
    msg += `- Celular: ${cleanPhone}\n`;

    if (isDelivery) {
      msg += `- Modalidad: 🛵 Delivery a Domicilio\n`;
      msg += `- Dirección: ${address}\n`;
      if (reference) {
        msg += `- Referencia: ${reference}\n`;
      }
      if (locationData && locationData.gmapsUrl) {
        msg += `- 📍 *Ubicación GPS:* ${locationData.gmapsUrl}\n`;
      }
    } else {
      msg += `- Modalidad: 🛍️ Recojo en Tienda Caprichos (2:00 pm - 10:00 pm)\n`;
    }

    msg += `\n💳 *MÉTODO DE PAGO:* ${this.selectedPayment}`;
    if (this.selectedPayment === "Efectivo") {
      const cashInput = document.getElementById("cash-amount-input");
      const amount = cashInput ? cashInput.value.trim() : "";
      if (amount) {
        msg += ` (Paga con: S/ ${amount})`;
      }
    }
    msg += `\n\n`;
    msg += `_Por favor confírmenme el pedido para enviarles la captura del pago y coordinar el despacho. ¡Muchas gracias!_ ✨`;

    return msg;
  }

  sendToWhatsApp() {
    const message = this.buildWhatsAppMessage();
    if (!message) return;

    // Obtener número destino (por defecto el oficial de Caprichos)
    const phone = this.targetWhatsAppPhone || CAPRICHOS_WHATSAPP_PHONE;
    const cleanDestPhone = phone.replace(/\D/g, "");

    const encoded = encodeURIComponent(message);
    const waUrl = `https://wa.me/${cleanDestPhone}?text=${encoded}`;

    // Abrir WhatsApp en nueva pestaña
    window.open(waUrl, "_blank");

    if (window.showToast) {
      window.showToast("🚀 ¡Abriendo WhatsApp con tu pedido listo!");
    }
  }

  setCustomWhatsAppNumber(newPhone) {
    if (newPhone) {
      this.targetWhatsAppPhone = newPhone.replace(/\D/g, "");
    }
  }
}

// Instancia global
window.checkout = new CheckoutManager();
