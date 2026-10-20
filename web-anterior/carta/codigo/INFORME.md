# INFORME DE ANÁLISIS ESTÁTICO Y RECONSTRUCCIÓN DE REGLAS DE NEGOCIO
## Cliente: CAPRICHOS (Cafetería Artesanal, Lima) — Plataforma OlaClick (Nuxt 3)

**Fecha de análisis:** 13 de Octubre de 2026  
**Entorno de salida:** `/home/jose/JoseEM/caprichos/web-anterior/carta/codigo/`  
**Autorización:** Desarrollador / Propietario de Caprichos  
**Modalidad de ejecución:** Análisis estático de bundles JavaScript, deshidratación de estados SSR `__NUXT_DATA__`, y consultas seguras GET de solo lectura (rate limit: máx 1 req/s). Sin peticiones de escritura (POST/PUT/PATCH/DELETE).

---

## 1. Resumen Ejecutivo

El presente informe reconstruye de manera exhaustiva la arquitectura, flujos de usuario, reglas de negocio, esquemas de formulario, tarificación de envíos, métodos de pago y catálogo de microservicios de la tienda virtual anterior de **Caprichos** alojada en la plataforma OlaClick (`https://caprichos-per.ola.click`).

### Archivos Generados en `/home/jose/JoseEM/caprichos/web-anterior/carta/codigo/`
1. **`js/`**: Directorio con los **28 chunks JavaScript públicos** descargados del front-end Vite/Nuxt 3 (incluyendo `Ch2y0kWI.js` de 1.62 MB, `CsOqdhwp.js` de 439 KB, `Dg8-skhv.js` de 83.9 KB, y componentes de checkout y carrito `BVrLNmdE.js`, `BsDqLB2g.js`).
2. **`configuracion.json`**: Extracción completa de todos los ajustes de la empresa, horarios, tipos de pedido, métodos de pago, polígonos de delivery, redes sociales, diseño visual y flags desde el estado deshidratado `__NUXT_DATA__`, con enmascaramiento estricto de claves, tokens y cuentas bancarias (visibles solo últimos 3 dígitos).
3. **`api_respuestas/`**: Respuestas JSON originales obtenidas mediante peticiones GET públicas seguras a `https://api.olaclick.app` (`hosts.json`, `company.json`, `ecommerce_settings.json`, `payment_methods.json`, `order_settings.json`, `coupons.json`, `loyalty_settings.json`, `categories.json`, `gallery_images.json`, `chat_orchestrator_health.json`).
4. **`INFORME.md`**: El presente documento técnico de referencia.

---

## 2. Inventario de Endpoints de la API de OlaClick

A partir del análisis estático del core bundle (`Ch2y0kWI.js`) y el entry point (`Dg8-skhv.js`), se identificaron los servicios cliente (`Co`, `ig`, `Il`, `Dk`, `ni`, `Lwe`, `Oi`) que consumen la API base `https://api.olaclick.app`.

### Tabla de Endpoints y Microservicios

| Microservicio | Método | Ruta / Endpoint | Parámetros (Query / Body / Path) | Clasificación | Forma de Respuesta | Archivo y Línea JS |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ms-companies** | `GET` | `/ms-companies/public/hosts/${host}` | Path: `host` (ej. `caprichos-per.ola.click`) | **Lectura Pública** | `{ data: { company_id: string } }` | `Ch2y0kWI.js:10`, `Dg8-skhv.js:24` |
| **ms-companies** | `GET` | `/ms-companies/public/companies/${companyId}` | Path: `companyId` (UUID) | **Lectura Pública** | `{ data: { company: Object } }` | `Ch2y0kWI.js:10` |
| **ms-companies** | `GET` | `/ms-companies/public/companies/${companyId}/ecommerce-settings` | Path: `companyId` | **Lectura Pública** | `{ data: { ...ecommerceSettings } }` | `Ch2y0kWI.js:10` |
| **ms-companies** | `GET` | `/ms-companies/public/companies/${companyId}/delivery-area-cost` | Path: `companyId`, Query: `{ lat, lng, area_id }` | **Lectura Pública** | `{ data: { area_price: number, ... } }` | `Ch2y0kWI.js:10` |
| **ms-companies** | `GET` | `/ms-companies/public/companies/${companyId}/gallery-images` | Path: `companyId` | **Lectura Pública** | `{ data: Array<Image> }` | `Ch2y0kWI.js:10` |
| **ms-companies** | `GET` | `/ms-companies/public/companies/${companyId}/google/top-reviews` | Path: `companyId` | **Lectura Pública** | `{ data: Array<Review> }` | `Ch2y0kWI.js:10` |
| **ms-companies** | `POST` | `/ms-companies/public/companies/site-abuse-report` | Body: `{ company_id, reason, details }` | **Escritura** | `{ data: { success: boolean } }` | `Ch2y0kWI.js:10` |
| **ms-orders** | `GET` | `/ms-orders/public/companies/${companyId}/payment-methods` | Path: `companyId`, Query: params | **Lectura Pública** | `{ data: Array<PaymentMethod> }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `GET` | `/api/payment-methods` | Headers: forwarding host/tenant (BFF Nuxt) | **Lectura Pública** | `{ data: Array<FlatPaymentMethod> }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `GET` | `/ms-orders/public/companies/${companyId}/order-settings` | Path: `companyId` | **Lectura Pública** | `{ data: { ...orderSettings } }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `GET` | `/ms-orders/public/companies/${companyId}/coupons` | Path: `companyId` | **Lectura Pública** | `{ data: Array<Coupon> }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `GET` | `/ms-orders/public/companies/${companyId}/orders/${orderId}` | Path: `companyId`, `orderId` | **Lectura Pública** | `{ data: { ...order } }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `POST` | `/ms-orders/public/orders` | Body: `{ status: "INITIATED", company_id, service_type, combos, ... }` | **Escritura** | `{ data: { id: string, public_id, ... } }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `PATCH` | `/ms-orders/public/companies/${companyId}/orders/${orderId}` | Path: `companyId`, `orderId`, Body: datos a actualizar | **Escritura** | `{ data: { ...updatedOrder } }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `POST` | `/ms-orders/public/companies/${companyId}/apply-discount` | Body: `{ type: "coupon"\|"fidelity", code, order_id, currency, timezone }` | **Escritura / Validación** | `{ data: { ...orderWithDiscount } }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `GET` | `/ms-orders/public/companies/${companyId}/rider-live-position` | Path: `companyId` | **Lectura Pública** | `{ data: { lat, lng } }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `GET` | `/ms-orders/public/qrs/${qrId}` | Path: `qrId` | **Lectura Pública** | `{ data: { ...qrData } }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `GET` | `/ms-orders/public/carts/${cartId}` | Path: `cartId` | **Lectura Pública** | `{ data: { ...cart } }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `POST` | `/ms-orders/public/companies/${companyId}/carts` | Body: `{ client_id, combos, ... }` | **Escritura** | `{ data: { id: string, ... } }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `PATCH` | `/ms-orders/public/carts/${cartId}` | Path: `cartId`, Body: `{ combos, ... }` | **Escritura** | `{ data: { ...updatedCart } }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `DELETE` | `/ms-orders/public/carts/${cartId}` | Path: `cartId` | **Escritura** | `{ data: { success: boolean } }` | `Ch2y0kWI.js:8` |
| **ms-orders** | `GET` | `/ms-orders/public/companies/${companyId}/clients/${clientId}/recent-order-combos` | Path: `companyId`, `clientId` | **Lectura Pública** | `{ combos: Array<Combo> }` | `Ch2y0kWI.js:8` |
| **ms-products** | `GET` | `/ms-products/public/companies/${companyId}/categories` | Path: `companyId` | **Lectura Pública** | `{ data: Array<Category> }` | `Ch2y0kWI.js:37` |
| **ms-products** | `GET` | `/api/menu` | Headers de tenant (BFF Nuxt) | **Lectura Pública** | `{ data: { ...menuLight } }` | `Ch2y0kWI.js:37` |
| **ms-products** | `GET` | `/ms-products/public/companies/${companyId}/categories/${slug}` | Path: `companyId`, `slug` | **Lectura Pública** | `{ data: { ...category } }` | `Ch2y0kWI.js:37` |
| **ms-products** | `GET` | `/ms-products/public/companies/${companyId}/products/${slug}` | Path: `companyId`, `slug` | **Lectura Pública** | `{ data: { ...product } }` | `Ch2y0kWI.js:37` |
| **ms-clients** | `POST` | `/ms-clients/public/companies/${companyId}/clients` | Body: `{ name, phone_number, country_calling_code }` | **Escritura** | `{ data: { id: string, name, phone_number, ... } }` | `Ch2y0kWI.js:10` |
| **ms-clients** | `GET` | `/ms-clients/public/companies/${companyId}/clients/${clientId}` | Path: `companyId`, `clientId` | **Lectura Pública** | `{ data: { ...client } }` | `Ch2y0kWI.js:10` |
| **ms-clients** | `GET` | `/ms-clients/public/companies/${companyId}/loyalty-settings` | Path: `companyId` | **Lectura Pública** | `{ data: { loyalty_program: Object } }` | `Ch2y0kWI.js:10` |
| **ms-clients** | `POST` | `/ms-clients/public/addresses` | Body: `{ client_id, company_id, address, area_id, area_name, complement, reference }` | **Escritura** | `{ data: { id: string, address, ... } }` | `Ch2y0kWI.js:10` |
| **ms-clients** | `GET` | `/ms-clients/public/companies/${companyId}/order-ratings/${ratingId}` | Path: `companyId`, `ratingId` | **Lectura Pública** | `{ data: { ...rating } }` | `Ch2y0kWI.js:10` |
| **ms-clients** | `POST` | `/ms-clients/public/companies/${companyId}/order-ratings` | Body: `{ score, comment, order_id }` | **Escritura** | `{ data: { success: boolean } }` | `Ch2y0kWI.js:10` |
| **ms-payments** | `POST` | `/ms-payments/public/company-payments` | Body: `{ order_id, payment_method_id, amount, ... }` | **Escritura** | `{ data: { payment_intent_id, client_secret, ... } }` | `Ch2y0kWI.js:37` |
| **ms-payments** | `GET` | `/ms-payments/public/company-payments/filters` | Query: `?reference_id=...&payment_method_id=...` | **Lectura Pública** | `{ data: Array<PaymentIntent> }` | `Ch2y0kWI.js:37` |
| **ms-payments** | `GET` | `/ms-payments/public/company-payments/${paymentIntentId}` | Path: `paymentIntentId` | **Lectura Pública** | `{ data: { status, ... } }` | `Ch2y0kWI.js:37` |
| **ms-payments** | `POST` | `/ms-payments/public/company-payments/${paymentIntentId}/cancel` | Path: `paymentIntentId` | **Escritura** | `{ data: { cancelled: boolean } }` | `Ch2y0kWI.js:37` |
| **ms-reports** | `PATCH` | `/ms-reports/public/company-visit` | Query: `?company_id=...&date=YYYY-MM-DD` | **Escritura (Métrica)** | `{ data: { registered: boolean } }` | `Dg8-skhv.js:46` |
| **ms-chat-orchestrator** | `GET` | `/ms-chat-orchestrator/public/health` | Ninguno | **Lectura Pública** | `{ status: "ok", service: "ms-chat-orchestrator", uptime: number }` | `Ch2y0kWI.js:68` |
| **ms-chat-orchestrator** | `GET` | `/ms-chat-orchestrator/public/whatsapp/order-summary` | Query: `?order_id=...&company_id=...` | **Lectura Pública / Redirección** | Redirección o payload formateado para WhatsApp | `Ch2y0kWI.js:115` |

---

## 3. Definición y Flujo del Checkout

El flujo de checkout está implementado como una máquina de estados SPA dentro de la ruta `/checkout` (`BVrLNmdE.js` y `Ch2y0kWI.js:10`). No utiliza páginas URL separadas para cada paso, sino que cambia el estado `checkoutScreen` dentro del store Pinia `checkout` (`rt`).

### 3.1. Máquina de Estados y Transiciones de Pasos

Constantes definidas en `Ch2y0kWI.js:10`:
```javascript
const as = "CHECKOUT_STEP_ADDITIONAL_INFO";
const Sr = "CHECKOUT_STEP_CLIENT_INFO";
const bo = "CHECKOUT_STEP_DELIVERY_ADDRESS";
const V0 = "CHECKOUT_STEP_DELIVERY_AUTOCOMPLETE";
const lg = "CHECKOUT_STEP_DELIVERY_ADDRESS_CREATE";
const B0 = "CHECKOUT_STEP_DELIVERY_MAP";
const cg = "CHECKOUT_STEP_DELIVERY_MAP_ADDRESS_CREATE";
const Yr = "CHECKOUT_STEP_ORDER_SUMMARY";
```

#### Función de Transición Hacia Adelante (`WS`, `Ch2y0kWI.js:10`):
```javascript
function zS({serviceType: e, ecommerceSettingsServiceType: t, createdClient: n}) {
  return e === St ? !n : !!(t?.collect_client_info && !n);
}

function WS({checkoutScreen: e, serviceType: t, ecommerceSettings: n, createdClient: o}) {
  const r = n?.[t.toLowerCase()] || null,
        a = t === St, // St = "DELIVERY"
        s = zS({serviceType: t, ecommerceSettingsServiceType: r, createdClient: o});

  if (!e) { // Inicio del checkout
    return r?.additional_input ? as : (s ? Sr : (a ? bo : Yr));
  }
  if (e === as) {
    return s ? Sr : (a ? bo : Yr);
  }
  if (e === Sr) {
    return a ? bo : Yr;
  }
  return Yr;
}
```

#### Función de Transición Hacia Atrás (`tj`, `Ch2y0kWI.js:10`):
```javascript
function tj({checkoutScreen: e, serviceType: t, ecommerceSettings: n, createdClient: o}) {
  const r = n?.[t.toLowerCase()] || null,
        a = t === St,
        s = zS({serviceType: t, ecommerceSettingsServiceType: r, createdClient: o});

  if (e === Yr) return a ? bo : (s ? Sr : (r?.additional_input ? as : null));
  if (e === V0 || e === lg || e === B0 || e === cg) return bo;
  if (e === bo) return s ? Sr : (r?.additional_input ? as : null);
  if (e === Sr) return r?.additional_input ? as : null;
  return null;
}
```

---

### 3.2. Formulario y Validaciones: Campos, Expresiones Regulares y Mensajes de Error

#### A. Datos del Cliente (`CheckoutScreenClientInfo`, `Ch2y0kWI.js:68`)
- **Contenedor:** Modal/Pantalla con ID de formulario `REF_FORM_STEP_CLIENT_INFO` (`I8`).
- **Campos:**
  1. `name` (Nombre completo):
     - **Regla:** `p => !!p || t("messages.your_name_is_required")` ("Tu nombre es requerido").
     - **Control:** Input texto, `autocomplete: off`, bordes redondeados.
     - **Persistencia:** Al escribir, se almacena en la cookie `COOKIE_CLIENT_NAME` con duración de 365 días (`I4`).
  2. `phone_number` / `checkout-client-phone`:
     - **Componente:** Selector internacional de teléfono (`sT`) acoplado a la librería de países `AZ` (versión 4). En Perú utiliza el código `+51`.
     - **Validación Front:** `nationalNumber` no vacío y validación de longitud para Perú (9 dígitos numéricos).
     - **Validación Backend (422):** Si el servidor retorna `422` o `errors.phone_number`, muestra: `"the_number_you_entered_is_invalid"` ("El número ingresado no es válido").
- **Envío:** Llama a `Il.getOrCreateClient({ name, phone_number, country_calling_code })`.

#### B. Dirección de Entrega Manual (`CheckoutScreenDeliveryAddressCreate`, `Ch2y0kWI.js:68`)
Se activa cuando `google_maps_validation` es `false` (configuración activa de Caprichos).
- **Contenedor:** Formulario `formRef` con ID `REF_FORM_STEP_DELIVERY_ADDRESS_CREATE` (`M8`).
- **Campos:**
  1. `street_avenue` (Calle / Jirón / Avenida):
     - **Regla:** `O => !!O || t("your_field_is_required_f", [t("street_avenue")])` ("La calle o avenida es obligatoria").
  2. `number` (Número / Lote):
     - **Regla:** `O => !!O || t("your_field_is_required_m", [t("number")])` ("El número es obligatorio").
     - **Composición:** La dirección enviada a la API es `${street_avenue} #${number}`.
  3. `district` (Distrito / Área):
     - **Regla:** Si la tienda tiene tarifas por barrios (`Wv`), selección requerida de la lista `deliveryBairros`. Si selecciona `"another_district"`, exige `neighborhood_name`.
  4. `complement` (Piso / Departamento / Interior):
     - **Regla:** Si `additional_address_information` está habilitado en `ecommerceSettings`, es obligatorio: `O => !!O || t("your_field_is_required_m", [t("complement")])`. En caso contrario es opcional.
  5. `reference` (Referencia de entrega):
     - **Regla:** Opcional (hasta 120 caracteres).
- **Envío:** Llama a `Il.createAddress({ client_id, company_id, address, area_id, area_name, complement, reference })`.

#### C. Dirección vía Google Maps (`CheckoutScreenDeliveryAddressAutocomplete`, `Ch2y0kWI.js:68`)
Se activa si `google_maps_validation` es `true`.
- **Campos:** Input de búsqueda conectado a Google Places Autocomplete API.
- **Reglas Front:**
  - Mínimo 4 caracteres (`d.value.trim().length >= 4`).
  - Debe contener un espacio (`d.value.includes(" ")`).
  - **Expresión Regular Estricta:** `/\d/.test(d.value)` (debe contener al menos un dígito numérico para garantizar altura o numeración de calle).
  - Al seleccionar lugar, abre mapa con pin interactivo (`CHECKOUT_STEP_DELIVERY_MAP`) para ajustar latitud/longitud.

#### D. Información Adicional del Pedido (`CheckoutScreenAdditionalInfo`, `Ch2y0kWI.js:68`)
- **Contenedor:** Formulario `formRef` con ID `REF_FORM_STEP_ADDITIONAL_INFO` (`T8`).
- **Activación:** Solo si `ecommerceSettings[serviceType].additional_input` no es nulo.
- **Campos:**
  - `additionalInfo`: Texto libre.
  - **Límite de caracteres:** Máximo 80 caracteres (`f_ = 80`).
  - **Reglas:**
    - `d => !!d || t("required_field")`
    - `d => !!d && d.length <= 80 || t("max_slot0_characters", [80])`

#### E. Comentarios / Instrucciones de Cocina (`DeliverySection`, `Ch2y0kWI.js:66`)
- **Campo:** `orderComments` (Área de texto de 2 filas).
- **Placeholder:** `"Escribe aquí detalles o instrucciones especiales para tu pedido"`.
- **Regla:** Opcional. Se sanitiza con `.trim()`.

---

## 4. Métodos de Pago Configurables

Configurados en el store `paymentMethods` y expuestos a través de `flatPaymentMethods` (`Ch2y0kWI.js:8`, `configuracion.json` y `api_respuestas/payment_methods.json`):

| Código (`code`) | Nombre / Tipo | Disponibilidad por Servicio | Requiere Comprobante | Online vs Offline | Configuración Real de Caprichos (Datos Enmascarados) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`credit_card`** | Tarjeta de Crédito / Débito | Delivery: Sí<br>Takeaway: Sí<br>Onsite: Sí | No | Online / POS | Sin recargo (`fee: null`). Procesado mediante POS físico o pasarela configurada. |
| **`transfer`** | Transferencia Bancaria Directa | Delivery: Sí<br>Takeaway: Sí<br>Onsite: Sí | Sí (WhatsApp) | Offline | BCP Ahorro Soles: `***...074`<br>Interbank Ahorro Soles: `***...217`<br>Titular: Maria Jose Morillo Ruiz |
| **`yape`** | Billetera Digital Yape | Delivery: Sí<br>Takeaway: Sí<br>Onsite: Sí | Sí (WhatsApp) | Offline | Teléfono Yape: `***...006`<br>Titular: María José Morillo Ruiz |
| **`plin`** | Billetera Digital Plin | Delivery: Sí<br>Takeaway: Sí<br>Onsite: Sí | Sí (WhatsApp) | Offline | Teléfono Plin: `***...006`<br>Titular: María José Morillo Ruiz |
| **`cash`** | Efectivo contra entrega | Delivery: Sí<br>Takeaway: Sí<br>Onsite: Sí | No | Offline | Descripción: *"100% Contra-Entrega"*. En checkout exige indicar el monto con el que se pagará (`amountAvailableToPay`) si el cliente solicita vuelto. |

### Regla de Validación de Efectivo (`P1`, `Ch2y0kWI.js:68`):
```javascript
if (selectedPaymentMethodCode === "cash") {
  const amount = Number(client.amountAvailableToPay);
  if (!amount) return "Ingresa el monto con el que pagarás";
  if (!Number.isFinite(amount) || amount < checkoutOrderTotal) {
    return `El monto debe ser mayor a ${checkoutOrderTotal} (Total a pagar)`;
  }
}
```

---

## 5. Tipos de Pedido (`DELIVERY`, `TAKEAWAY`, `ONSITE`)

En `Ch2y0kWI.js:8` (`orderTypes`), se definen los tres modos de atención:

### 5.1. Cuadro Comparativo de Modalidades

| Característica | `DELIVERY` (A Domicilio) | `TAKEAWAY` (Para Llevar) | `ONSITE` (Consumo en Local) |
| :--- | :--- | :--- | :--- |
| **Identificador Interno** | `St = "DELIVERY"` | `En = "TAKEAWAY"` | `Mo = "ONSITE"` |
| **Estado Activo en Caprichos** | **Sí** (`active: true`) | **Sí** (`active: true`) | **Sí** (`active: true`) |
| **Tiempo Estimado** | `20 - 45 min.` | Inmediato / Preparación | Inmediato / Preparación |
| **Monto Mínimo de Pedido** | **S/. 14,50** (`minimum_amount_to_allow`) | S/. 0,00 | S/. 0,00 |
| **Monto para Envío Gratis** | **S/. 70,00** (`minimum_amount_for_free`) | No aplica | No aplica |
| **Recolección Datos Cliente** | **Obligatorio** (`collect_client_info: true`) | **Obligatorio** (`collect_client_info: true`) | **Obligatorio** (`collect_client_info: true`) |
| **Dirección Requerida** | **Sí** (calle, número, referencia) | No | No (Opcional mesa / barra) |
| **Pedidos Programados** | **Sí** (`scheduled_orders_enabled: true`) | **Sí** (`scheduled_orders_enabled: true`) | **Sí** (`scheduled_orders_enabled: true`) |
| **Propina Habilitada** | No en configuración delivery | **Sí** (Valores: S/. 0, S/. 0.50, S/. 2.00) | **Sí** (Valores: S/. 0, S/. 0.50, S/. 2.00) |
| **Asignación de Repartidor** | Automática a repartidores propios (`riders_selected`: Yefri Sanchez, marvil) | No aplica | No aplica |

---

## 6. Cálculo de Totales, Descuentos, Cupones, Propinas y Envíos

### 6.1. Fórmula Matemática de Totales (`Ch2y0kWI.js:37, 49`)

```
Subtotal Productos = Σ [ (selectedProductPriceToPay + selectedModifiersTotalPrice) × quantity ]
Descuento Cupón/Fidelidad = applyDiscountToOrder(couponCode)
Costo de Envío = calculateDeliveryPrice(distancia, polígonos, subtotal)
Propina = Ld(order, tipType, tipValue)
Tarifa de Servicio = orderPaymentFeeAmount (0.00 en Caprichos)

TOTAL ORDEN = Subtotal Productos - Descuento + Costo de Envío + Propina + Tarifa de Servicio
```

Código fuente en `Cn` (`Ch2y0kWI.js:49`):
```javascript
checkoutOrderTotal = computed(() => {
  const b = createdOrder?.total || 0,
        T = moneyFormatOptions.precision, // 2 decimales
        S = tipSettings.value,
        I = Ld(createdOrder, S?.type || "AMOUNT", tipValue, T),
        O = S?.active ? b + I + orderPaymentFeeAmount : b + orderPaymentFeeAmount;
  return Yk(O, T); // Redondeo seguro flotante
});
```

### 6.2. Función de Cálculo de Propinas (`Ld`, `Ch2y0kWI.js:37`)
```javascript
function Ld(order, tipType, tipValue, precision = 2) {
  if (!order) return 0;
  if (tipType === "AMOUNT") return tipValue;
  if (tipType === "PERCENTAGE") return Yk((order.total * tipValue) / 100, precision);
  return 0;
}
```
En Caprichos, el tipo de propina configurado es **`AMOUNT`** (Monto fijo en soles) con opciones:
- Opción 1: `S/. 0.00`
- Opción 2: `S/. 0.50`
- Opción 3: `S/. 2.00`
- Mensaje asociado: *"Para colaboradores de Caprichos"*.

### 6.3. Descuentos y Cupones (`Co.applyDiscountToOrder`, `Ch2y0kWI.js:8, 49`)
- Endpoint: `POST /ms-orders/public/companies/${companyId}/apply-discount`
- Cuerpo: `{ type: "coupon" | "fidelity", code, order_id, currency: "PEN", timezone: "America/Lima" }`.
- Si el cupón es inválido, captura el error y evalúa la clave i18n `coupon_error.${errorKey}` con fallback: `"coupon_error.this_coupon_is_not_valid"` ("Este cupón no es válido").
- Consulta pública realizada: La llamada GET pública a `/ms-orders/public/companies/5816bd90-2af9-11eb-83a6-91c28df3eedf/coupons` retornó `[]` (no hay cupones públicos vigentes en la cuenta).

### 6.4. Reglas de Cobertura y Tarificación de Envíos (`Ch2y0kWI.js:10, 66`)
La empresa tiene configuradas tres modalidades de cálculo de delivery en `ecommerceSettings.delivery`:

#### A. Regla de Envío Gratuito por Monto Mínimo (`B2`, `Ch2y0kWI.js:66`):
```javascript
function B2({ecommerceSettings: t, orderDeliveryPrice: n, orderCombosPrice: o, minAmountForFreeDeliveryIsEnabled: r, minAmountForFreeDelivery: a}) {
  if (n !== 0) return false;
  if (r && o >= a) return true; // Si subtotal >= S/. 70.00 -> Envío Gratis
  // ...
}
```

#### B. Tarificación por Rangos de Distancia (`ranges`):
- **Rango 1 (0 a 2020 metros / 2.02 km):** Tarifa `S/. 0.00` (Gratis en zona inmediata de Campoy).
- **Rango 2 (2021 a 3605 metros / 3.61 km):** Tarifa `S/. 3.00`.
- **Distancia Máxima:** `3.61 km` (`max_distance_km: 3.61`, `price_per_km: 0.83`).

#### C. Polígono Geográfico de Cobertura (`polygons`):
- Polígono ID: `2c86de00-4093-11ef-89a9-17a89c8ce181`
- Precio asignado al polígono: `S/. 4.00`
- Vértices: **59 coordenadas geográficas** que delimitan el área de Campoy, Mangomarca y zonas aledañas en San Juan de Lurigancho (coordenadas completas guardadas en `configuracion.json`).
- `enable_out_of_area: true`: Se permite registrar pedidos fuera del polígono directo con evaluación de costo de entrega.

---

## 7. Pedidos Programados (`ScheduleSection`, `Ch2y0kWI.js:65`)

El componente `ScheduleSection` administra cuándo se preparará y entregará el pedido.

### Opciones Disponibles:
1. **"Lo antes posible" (`today` / `nr`):**
   - Regla estricta: Se deshabilita (`is-disabled: true`) si la tienda está actualmente cerrada (`!companyIsOpen`).
2. **"Programado" (`personalized` / `Wr`):**
   - Se selecciona automáticamente si la tienda está cerrada pero `scheduled_orders_enabled` está activo.
   - Permite elegir:
     - **Día (`choose_the_day`):** Días disponibles calculados a partir de los horarios activos en `attentionHours`.
     - **Horario (`availableTimesForSelectedDay`):** Bloques horarios de 15 o 30 minutos dentro del rango de atención configurado (14:00 a 22:00 en Caprichos).

---

## 8. Estados del Pedido y de la Tienda

### 8.1. Estados del Ciclo de Vida del Pedido
Definidos en `Ch2y0kWI.js:37`:
```javascript
const a9 = "INITIATED";                        // Pedido iniciado en checkout
const Ou = "PENDING";                          // Pendiente de confirmación/pago
const Hk = "PREPARING";                        // En preparación en cocina (Default de Caprichos)
const Uk = "READY";                            // Listo para entrega/recojo
const jk = "DRIVER_ON_THE_WAY_TO_DESTINATION"; // Repartidor en camino
const zk = "DRIVER_ARRIVED_AT_DESTINATION";    // Repartidor llegó a la dirección
const Ah = "DELIVERED";                        // Pedido entregado al cliente
const tl = "FINALIZED";                        // Pedido finalizado con éxito
const s9 = "CANCELLED";                        // Pedido cancelado
```
*Ajuste específico de Caprichos:* `default_inbound_order_status: "PREPARING"` (cuando un pedido entra, se marca directamente como en preparación).

### 8.2. Estados de Operación de la Tienda
1. **Abierta (`companyIsOpen: true`):**
   - Calculado mediante `qB(attentionHours, timezone)`. La hora actual del cliente debe coincidir con los intervalos activos de Lunes a Domingo (14:00 - 22:00).
2. **Cerrada (`companyIsOpen: false`):**
   - Si `scheduled_orders_enabled` está activo: Solo permite pedidos programados para el siguiente horario de apertura.
3. **Modo Solo Lectura / Catálogo (`companyReceiveOrders: false`):**
   - El front-end evalúa (`Ch2y0kWI.js:8`):
     ```javascript
     f = computed(() => {
       return !company ||
              companyMenuType === "readonly" ||
              companyMonthlyOrdersCount >= currentMainMonthlyOrdersLimit ||
              (checkoutType === "WHATSAPP" && !companyWhatsapp) ? false : ...
     });
     ```
   - **Explicación del estado actual de Caprichos:**
     - En el plan gratuito/vencido (`current_subscriptions: []`, plan más alto `"P2"` expirado), el límite de pedidos mensual por defecto es `mR = 10` pedidos.
     - Cuando la cuenta alcanza el límite o expira la suscripción, `companyReceiveOrders` pasa a ser `false`.
     - **Consecuencia visual:** El botón "Agregar al carrito" / "Pedir" se oculta en todos los productos (`u(a).companyReceiveOrders ? ... : null`), dejando la web en modo puramente visual / catálogo informativo.

---

## 9. Mensajes y Flujo de WhatsApp

El envío del pedido finaliza a través de un mensaje estructurado hacia la cuenta oficial de WhatsApp del negocio (`51977503006`).

### 9.1. Generador de Plantilla (`tTe`, `Ch2y0kWI.js:84`)
La función construye el texto codificado en URI (`encodeURIComponent`) con el siguiente formato exacto:

```
[Título de pedido: "Nuevo pedido desde la web"]
Pedido - [ID público del pedido, ej. #1042]
[Fecha y hora programada o de creación]

*[Modalidad de Servicio: DELIVERY / PARA LLEVAR / EN LOCAL]*

*Datos del cliente:*
[Nombre del cliente]
[Teléfono del cliente]
[Dirección y referencia si es DELIVERY]

*Productos:*
• [Cantidad]x [Nombre de Producto] [Variante] - [Precio]
  + [Modificador seleccionado, ej. Leche de almendras (+S/. 3.00)]
  Nota: [Comentario del producto]

*Resumen:*
Subtotal: S/. [Monto]
Descuento: S/. [Monto] (si aplica)
Propina: S/. [Monto] (si aplica)
Costo de envío: S/. [Monto o "Gratis"]
*Total: S/. [Monto Total]*

*Método de pago:*
[Nombre del método: Yape / Plin / Transferencia / Efectivo]
[Estado del pago: Pendiente de confirmación]

[Instrucciones de pago o enlace de seguimiento]
```

### 9.2. Mecanismo de Despacho (`OrderSendWhatsappButton`, `Ch2y0kWI.js:115`)
- Si el servicio de orquestación de chat está activo: redirige a `${apiBaseUrl}/ms-chat-orchestrator/public/whatsapp/order-summary?order_id=${order.id}&company_id=${companyId}`.
- Si no, recurre al fallback directo:
  `https://api.whatsapp.com/send?phone=51977503006&text=${tTe(...)}`.

---

## 10. Feature Flags y Configuración de Runtime

### 10.1. Feature Flags Activos Identificados en el Código

| Feature Flag | Valor en Caprichos | Archivo y Línea JS | Impacto Funcional |
| :--- | :--- | :--- | :--- |
| `scheduled_orders_enabled` | `true` | `Ch2y0kWI.js:8, 49` | Permite a los clientes agendar pedidos para fechas y horas futuras. |
| `collect_client_info` | `true` | `Ch2y0kWI.js:10, 49` | Exige nombre y teléfono antes de proceder al resumen de compra. |
| `google_maps_validation` | `false` | `Ch2y0kWI.js:68` | Desactiva Google Autocomplete; usa formulario manual de calle, número y referencia. |
| `enable_repeat_last_order` | `true` | `Ch2y0kWI.js:8` | Habilita botón para repetir combos de la última orden (`recent-order-combos`). |
| `enable_suggested_products`| `true` | `Ch2y0kWI.js:8` | Muestra carrusel de productos recomendados / venta cruzada en el carrito. |
| `order_here_enabled` | `true` | `Ch2y0kWI.js:8` | Habilita el botón global de pedir en el encabezado. |
| `onsite_qr_ordering` | `false` | `Ch2y0kWI.js:8` | No exige escanear QR de mesa obligatorio para pedidos en local. |
| `scheduled_report_enabled` | `false` | `Ch2y0kWI.js:10` | Reportes diarios automáticos por WhatsApp/correo deshabilitados. |
| `loyalty_program.active` | `false` | `Ch2y0kWI.js:10` | Programa de fidelización de puntos inactivo (`rewards: []`). |

### 10.2. Variables de Runtime (`runtimeConfig.public`)
Extraídas del runtime Nuxt (`Dg8-skhv.js:2, 44` y `products.html`):
- `appEnv`: `"prod"`
- `appVersion`: `"4.00.f684a4e"`
- `apiBaseUrl`: `"https://api.olaclick.app"`
- `awsS3BaseUrl`: `"https://assets.olaclick.app"`
- `websocketHost`: `"wss://knr0gr5370.execute-api.us-east-1.amazonaws.com/default"`
- `gtmId`: `"GTM-T4V3LF5"`
- `facebookPixelId`: `1027185266782342`

---

## 11. Huecos y Limitaciones (Lo que no se pudo determinar)

De acuerdo con las reglas de rigor del análisis estático, se documentan los elementos clasificados como **NO OBSERVADO** y su justificación:

1. **Lógica interna de base de datos de cupones del backend:**
   - **NO OBSERVADO:** Las fórmulas privadas de algoritmos de cupones (ej. cupones de un solo uso por cliente, cupones condicionados a categorías específicas).
   - *Motivo:* El endpoint público `GET /ms-orders/public/companies/.../coupons` retornó una lista vacía `[]`, y la lógica detallada de validación de códigos privados reside en el backend cerrado de `ms-orders` (`POST .../apply-discount`), el cual no debe llamarse con datos de prueba reales para no disparar escrituras no autorizadas.
2. **Respuesta completa del webhook de pasarelas de pago online en vivo:**
   - **NO OBSERVADO:** El payload exacto del callback emitido por DLocal o Stripe tras completar un pago exitoso con tarjeta.
   - *Motivo:* Cumplimiento estricto de la regla de seguridad nº 1 (nunca pagar, procesar ni enviar pedidos reales ni llamar endpoints de cargo).
3. **Historial de pedidos pasados del cliente:**
   - **NO OBSERVADO:** Órdenes previas reales asociadas a clientes de la base de datos de Caprichos.
   - *Motivo:* Restricción de privacidad y seguridad; los endpoints `GET /ms-orders/public/companies/.../clients/{clientId}/recent-order-combos` requieren un UUID de cliente autenticado o generado por sesión.
4. **Tarifas dinámicas de pasarelas externas no configuradas:**
   - **NO OBSERVADO:** Porcentajes de recargo bancario por pasarela de pago (`payment_method_fee`), ya que en todos los métodos configurados en Caprichos el campo se encuentra en `null` (la empresa absorbe el costo o no aplica comisión al cliente).

---

## 12. Conclusión y Recomendaciones para la Replicación

La arquitectura de Caprichos en OlaClick es un sistema desacoplado Nuxt 3 con catálogo REST y ordenamiento híbrido (BFF Nuxt + microservicios en Go/Node en AWS). Para replicar exitosamente el sistema con independencia tecnológica total:
1. **Adopción de Datos:** Toda la estructura de datos se encuentra preservada en `/home/jose/JoseEM/caprichos/web-anterior/carta/codigo/configuracion.json` y el catálogo en `/home/jose/JoseEM/caprichos/web-anterior/carta/datos/catalogo.json`.
2. **Lógica de Checkout:** Debe implementarse un formulario reactivo que respete la máquina de estados documentada (`Cliente` -> `Dirección` -> `Resumen`), con las validaciones de 9 dígitos en celular peruano y mínimo de compra de S/. 14,50 para delivery.
3. **Envío por WhatsApp:** Utilizar la plantilla formateada en el apartado 9.1 para mantener la experiencia de usuario y la recepción de pedidos sin necesidad de pagar planes mensuales en plataformas cerradas.
