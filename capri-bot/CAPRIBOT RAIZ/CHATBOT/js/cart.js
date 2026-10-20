/**
 * CAPRICHOS - GESTIÓN DEL CARRITO DE COMPRAS
 * Con persistencia en localStorage y cálculo dinámico de subtotales
 */

class CartManager {
  constructor() {
    this.storageKey = "caprichos_cart_v1";
    this.items = [];
    this.listeners = [];
    this.deliveryMode = "delivery"; // 'delivery' | 'recojo'
    this.deliveryCost = 3.0; // Costo por defecto hasta fijar ubicación
    this.deliveryZoneInfo = null;
    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        this.items = JSON.parse(saved);
      }
    } catch (e) {
      console.warn("No se pudo cargar el carrito previo:", e);
      this.items = [];
    }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items));
    } catch (e) {
      console.error("Error guardando carrito:", e);
    }
    this.notify();
  }

  subscribe(listener) {
    if (typeof listener === "function") {
      this.listeners.push(listener);
      listener(this);
    }
  }

  notify() {
    for (const fn of this.listeners) {
      try {
        fn(this);
      } catch (err) {
        console.error("Error en listener de carrito:", err);
      }
    }
  }

  generateItemHash(item) {
    const key = [
      item.productId,
      item.size?.name || "",
      item.milk?.id || "",
      item.sweetener?.id || "",
      (item.toppings || []).map(t => t.id).sort().join(","),
      (item.notes || "").trim().toLowerCase()
    ].join("|");
    return key;
  }

  addItem(newItem) {
    const hash = this.generateItemHash(newItem);
    const existing = this.items.find(i => i.hash === hash);

    if (existing) {
      existing.quantity += newItem.quantity || 1;
    } else {
      this.items.push({
        cartId: "item_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        hash: hash,
        productId: newItem.productId,
        name: newItem.name,
        category: newItem.category,
        image: newItem.image,
        size: newItem.size || null,
        milk: newItem.milk || null,
        sweetener: newItem.sweetener || null,
        toppings: newItem.toppings || [],
        notes: newItem.notes || "",
        unitPrice: Number(newItem.unitPrice || 0),
        quantity: Number(newItem.quantity || 1)
      });
    }

    this.save();
    return true;
  }

  updateQuantity(cartId, delta) {
    const index = this.items.findIndex(i => i.cartId === cartId);
    if (index === -1) return;

    this.items[index].quantity += delta;
    if (this.items[index].quantity <= 0) {
      this.items.splice(index, 1);
    }
    this.save();
  }

  removeItem(cartId) {
    this.items = this.items.filter(i => i.cartId !== cartId);
    this.save();
  }

  clear() {
    this.items = [];
    this.save();
  }

  getItems() {
    return this.items;
  }

  getItemCount() {
    return this.items.reduce((acc, item) => acc + item.quantity, 0);
  }

  getSubtotal() {
    return this.items.reduce((acc, item) => acc + (item.unitPrice * item.quantity), 0);
  }

  setDeliveryMode(mode) {
    this.deliveryMode = mode === "recojo" ? "recojo" : "delivery";
    this.notify();
  }

  getDeliveryMode() {
    return this.deliveryMode;
  }

  setDeliveryZone(zoneInfo) {
    this.deliveryZoneInfo = zoneInfo;
    if (zoneInfo && typeof zoneInfo.costo === "number") {
      this.deliveryCost = zoneInfo.costo;
    }
    this.notify();
  }

  getEffectiveDeliveryCost() {
    if (this.deliveryMode === "recojo") {
      return 0.0;
    }
    const subtotal = this.getSubtotal();
    // Promoción Caprichos: Delivery GRATIS por compras mayores a S/ 70
    if (subtotal >= 70.0 && subtotal > 0) {
      return 0.0;
    }
    return Number(this.deliveryCost || 3.0);
  }

  isFreeDelivery() {
    return this.deliveryMode === "delivery" && this.getSubtotal() >= 70.0;
  }

  getTotal() {
    return this.getSubtotal() + this.getEffectiveDeliveryCost();
  }
}

// Instancia global del carrito
window.cart = new CartManager();
