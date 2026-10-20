# Registro de Red: API de OlaClick (`api.olaclick.app`)

Este documento registra todas las peticiones de red dirigidas hacia la API de backend de OlaClick (`https://api.olaclick.app`) identificadas durante el análisis y recorrido del flujo completo de pedido y checkout para la tienda **Caprichos**.

> **Regla de seguridad estricta cumplida:**  
> Ninguna petición de escritura (POST/PUT/PATCH/DELETE) fue ejecutada contra servidores de producción reales durante la finalización del pedido. Las llamadas disparadas por el frontend se interceptaron y abortaron localmente vía `page.route` de Playwright, documentando su payload y esquema exacto.

---

## 1. Inventario de Endpoints

| Método | Endpoint / Ruta | Propósito | Momento del Flujo | Estado en Auditoría |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/ms-companies/public/hosts/{host}` | Identificación del comercio por subdominio | Carga inicial de la aplicación | Ejecutado (200 OK) |
| `GET` | `/ms-companies/public/companies/{companyId}` | Metadatos completos de la tienda y configuración general | Carga inicial de la aplicación | Ejecutado (200 OK) |
| `GET` | `/ms-companies/public/companies/{companyId}/ecommerce-settings` | Reglas de checkout, tipo de delivery, montos mínimos y propinas | Carga inicial y navegación a `/cart` | Ejecutado (200 OK) |
| `GET` | `/ms-orders/public/companies/{companyId}/order-settings` | Parámetros de pedidos (estados por defecto, reportes) | Carga inicial y navegación a `/cart` | Ejecutado (200 OK) |
| `GET` | `/ms-orders/public/companies/{companyId}/coupons` | Listado de cupones públicos activos | Carga del catálogo / carrito | Ejecutado (200 OK) |
| `GET` | `/ms-clients/public/companies/{companyId}/loyalty-settings` | Configuración del programa de puntos y recompensas | Carga inicial y carrito | Ejecutado (200 OK) |
| `PATCH` | `/ms-reports/public/company-visit` | Métrica de analítica interna de visitas | Carga de vistas | Telemetría estándar (200 OK) |
| `POST` | `/ms-clients/public/companies/{companyId}/clients` | Registro o lookup de cliente (Nombre y Teléfono) | Al pulsar "Confirmar" en Paso 1 (Datos de cliente) | **Interceptado / Abortado** (Simulado con mock 201) |
| `POST` | `/ms-clients/public/addresses` | Creación de dirección de entrega | Al pulsar "Confirmar dirección" en Paso 2 (Delivery) | **Interceptado / Abortado** (Simulado con mock 201) |
| `POST` | `/ms-orders/public/companies/{companyId}/carts` | Persistencia y sincronización del carrito en servidor | Al actualizar productos del pedido | **Interceptado / Abortado** (Simulado con mock 201) |
| `PATCH` | `/ms-orders/public/companies/{companyId}/carts/{cartId}` | Actualización debounced de productos del carrito | Al modificar cantidades | **Interceptado / Abortado** (Simulado con mock 200) |
| `GET` | `/ms-orders/public/companies/{companyId}/delivery-price` | Cálculo de tarifa por geocodificación / polígono | Al seleccionar dirección en Delivery | Analizado en lógica de frontend |
| `POST` | `/ms-orders/public/orders` | Creación de orden en estado `INITIATED` | Al pulsar "Confirmar dirección" o avanzar a checkout | **Interceptado & Abortado Estrictamente** |
| `PATCH` | `/ms-orders/public/companies/{companyId}/orders/{orderId}` | Actualización final de orden antes de confirmar | Al pulsar "Pedir" / Botón final | **Interceptado & Abortado Estrictamente** |

---

## 2. Detalle de Peticiones y Payloads

### 2.1. Registro / Lookup de Cliente

- **Método:** `POST`
- **Ruta:** `https://api.olaclick.app/ms-clients/public/companies/5816bd90-2af9-11eb-83a6-91c28df3eedf/clients`
- **Cabeceras:**
  - `Content-Type: application/json`
  - `Accept: application/json`
- **Cuerpo capturado (con datos falsos de prueba):**
```json
{
  "name": "PRUEBA NO ENVIAR",
  "phone_number": "900000000",
  "country_calling_code": "51"
}
```
- **Forma de respuesta resumida (esperada):**
```json
{
  "data": {
    "id": "c1234567-89ab-cdef-0123-456789abcdef",
    "name": "PRUEBA NO ENVIAR",
    "phone_number": "900000000",
    "country_calling_code": "51",
    "addresses": [],
    "available_points": 0
  }
}
```

---

### 2.2. Registro de Dirección de Entrega (Delivery)

- **Método:** `POST`
- **Ruta:** `https://api.olaclick.app/ms-clients/public/addresses`
- **Cabeceras:**
  - `Content-Type: application/json`
- **Cuerpo capturado (con datos falsos de prueba):**
```json
{
  "client_id": "c1234567-89ab-cdef-0123-456789abcdef",
  "company_id": "5816bd90-2af9-11eb-83a6-91c28df3eedf",
  "address": "Av. Malecón Checa #123",
  "complement": "Piso 2",
  "reference": "Frente a parque"
}
```
- **Forma de respuesta resumida (esperada):**
```json
{
  "data": {
    "id": "addr_98765432-10fe-dcba-9876-543210fedcba",
    "client_id": "c1234567-89ab-cdef-0123-456789abcdef",
    "address": "Av. Malecón Checa #123",
    "complement": "Piso 2",
    "reference": "Frente a parque",
    "city": "Lima",
    "latitude": null,
    "longitude": null,
    "area_id": null
  }
}
```

---

### 2.3. Creación de Orden Inicial (`INITIATED`)

- **Método:** `POST`
- **Ruta:** `https://api.olaclick.app/ms-orders/public/orders`
- **Cabeceras:**
  - `Content-Type: application/json`
- **Cuerpo capturado en vivo al avanzar a checkout (Abortado en Playwright):**
```json
{
  "company_id": "5816bd90-2af9-11eb-83a6-91c28df3eedf",
  "country_code": "PE",
  "timezone": "America/Lima",
  "combos": [
    {
      "product_id": "p_combo",
      "variant_id": "pr_combo",
      "quantity": 1,
      "comment": "Combo compartir sin azúcar",
      "modifiers": [
        { "modifier_id": "m_bev", "quantity": 1 },
        { "modifier_id": "m_donut", "quantity": 1 }
      ],
      "type": "combo"
    },
    {
      "product_id": "p_simple",
      "variant_id": "pr_simple",
      "quantity": 1,
      "comment": null,
      "modifiers": [],
      "type": null
    }
  ],
  "service_type": "DELIVERY",
  "status": "INITIATED",
  "currency": "PEN",
  "client_id": "client_mock_123",
  "address_id": "addr_mock_1",
  "delivery_price": 0
}
```
*(Para modalidad En el Local (`ONSITE`) o Para Llevar (`TAKEAWAY`), no se envían `address_id` ni `delivery_price`, y `service_type` cambia a `"ONSITE"` o `"TAKEAWAY"`).*

- **Forma de respuesta resumida:**
```json
{
  "data": {
    "id": "order_uuid_here",
    "public_id": "CAP-8492",
    "status": "INITIATED",
    "total": 45.00,
    "combos_price": 45.00,
    "service_type": "DELIVERY"
  }
}
```

---

### 2.4. Actualización / Finalización de Orden

- **Método:** `PATCH`
- **Ruta:** `https://api.olaclick.app/ms-orders/public/companies/5816bd90-2af9-11eb-83a6-91c28df3eedf/orders/{orderId}`
- **Cabeceras:**
  - `Content-Type: application/json`
- **Cuerpo de ejemplo (datos recolectados):**
```json
{
  "timezone": "America/Lima",
  "status": "INITIATED",
  "scheduled_delivery_date": "2026-10-13T21:00:00+00:00",
  "comment": "Poco azúcar por favor",
  "currency": "PEN",
  "meta_data": {
    "assigned_payment": {
      "payment_method_id": "cda35c3c-d97d-4312-8f46-331525955ed6",
      "payment_method_code": "yape",
      "payment_method_description": "977503006 a nombre de: María José Morillo Ruiz",
      "tip_type": "AMOUNT",
      "tip_value": 2
    }
  }
}
```

---

### 2.5. Consulta de Cupones

- **Método:** `GET`
- **Ruta:** `https://api.olaclick.app/ms-orders/public/companies/5816bd90-2af9-11eb-83a6-91c28df3eedf/coupons`
- **Respuesta real observada:**
```json
{
  "data": []
}
```
*(El comercio Caprichos no tenía cupones públicos vigentes).*

---

### 2.6. Configuración de E-commerce

- **Método:** `GET`
- **Ruta:** `https://api.olaclick.app/ms-companies/public/companies/5816bd90-2af9-11eb-83a6-91c28df3eedf/ecommerce-settings`
- **Respuesta resumida:**
```json
{
  "data": {
    "checkout_type": "WHATSAPP",
    "delivery": {
      "average_time": "20 - 45min.",
      "minimum_amount_to_allow": 14.5,
      "minimum_amount_for_free": 70,
      "prices": {
        "type": "FIXED",
        "fixed": 0,
        "ranges": [
          { "min": 0, "max": 2020, "price": 0, "enabled": true },
          { "min": 2021, "max": 3605, "price": 3, "enabled": true }
        ],
        "area": { "enable_out_of_area": true }
      }
    },
    "onsite": { "active": true, "tip": { "active": true, "type": "AMOUNT", "options": [0, 0.5, 2] } },
    "takeaway": { "active": true, "tip": { "active": true, "type": "AMOUNT", "options": [0, 0.5, 2] } }
  }
}
```
