import os

informe_content = """# Inventario y Auditoría Técnica de Enlaces, Redirecciones y Mensajería WhatsApp
**Proyecto:** Replicación de la Web de Pedidos de Caprichos (Lima, Perú)  
**Origen Analizado:** `https://caprichos-per.ola.click` (Plataforma OlaClick, Nuxt 3 SSR)  
**Fecha de Auditoría:** 13 de Octubre de 2026  
**Entregables:** `enlaces.csv` e `INFORME.md` en `/home/jose/JoseEM/caprichos/web-anterior/carta/enlaces/`  

---

## 1. Resumen Ejecutivo

El presente informe constituye el inventario exhaustivo y auditoría técnica de todos los enlaces salientes, destinos externos, navegación interna, redireccionamientos HTTP y puntos de integración con WhatsApp de la plataforma anterior de pedidos de **Caprichos** (`https://caprichos-per.ola.click`).

El análisis combinó tres fuentes de evidencia técnica:
1. **Inspección del DOM y Chunks JavaScript descargados:** Análisis directo de los bundles públicos de Nuxt 3 (`Dg8-skhv.js`, `Ch2y0kWI.js`, `CsOqdhwp.js`, `Cy2cMPyS.js`, etc.) y el diccionario de traducciones (`/_i18n/d9a04b91/es/messages.json`).
2. **Pruebas de Red y Redirecciones con curl (`-sIL`):** Verificación de encabezados HTTP, cadenas de redirección (301, 302) y códigos de estado en destinos externos, con una cadencia estrictamente limitada a 1 petición por segundo.
3. **Exploración de Páginas y HTML:** Verificación de las rutas `/`, `/products`, `/info`, `/combos`, `/frio`, `/caliente`, `/salado`, `/postres`, `/favoritos`, `/cart`, `/checkout` y una muestra de productos individuales.

---

## 2. Inventario de Enlaces Externos, Redes Sociales y Plataforma

A continuación se detalla cada destino externo localizado en la interfaz web, botones de landing, cabeceras, pie de página y módulos de checkout.

| Categoría / Tipo | Texto Visible | URL Exacta (href) | Destino Final (tras Redirecciones) | Redirección / Estado HTTP | Usuario / Teléfono / Parámetros | ¿Responde? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **WhatsApp (Landing / Header)** | *Ir al enlace* (Icono) / *Whatsapp* (Botón) | `https://api.whatsapp.com/send?phone=51977503006&text=%F0%9F%91%8B+Hola%2C+vengo+de+http%3A%2F%2Fcaprichos-per.ola.click%0ADeseo+realizar+el+siguiente+pedido%3A%0A` | Idéntica | Directo (200 OK) | **Número:** `+51 977 503 006`<br>**Mensaje pre-escrito:**<br>👋 Hola, vengo de http://caprichos-per.ola.click<br>Deseo realizar el siguiente pedido:<br> | **SÍ** (200) |
| **WhatsApp (Carrito / Checkout)** | *WhatsApp Negocio* (Soporte directo) | `https://api.whatsapp.com/send?phone=51977503006` | Idéntica | Directo (200 OK) | **Número:** `+51 977 503 006`<br>(Abre chat directo sin texto inicial) | **SÍ** (200) |
| **Instagram** | *Ir al enlace* (Icono Instagram) | `https://www.instagram.com/caprichoscampoy` | `https://www.instagram.com/caprichoscampoy` | Directo (200 OK) | **Usuario:** `@caprichoscampoy` | **SÍ** (200) |
| **Facebook** | *Ir al enlace* (Icono Facebook) | `https://www.facebook.com/caprichosC` | `https://www.facebook.com/caprichosC` | Directo (200 en Navegador; 400 en CLI por políticas anti-bot de Meta) | **Página / Usuario:** `caprichosC` | **SÍ** (200 en Navegador) |
| **TikTok** | *Ir al enlace* (Icono TikTok) | `https://www.tiktok.com/@caprichoscampoy` | `https://www.tiktok.com/@caprichoscampoy` | Directo (200 OK) | **Usuario:** `@caprichoscampoy` | **SÍ** (200) |
| **Reseñas Restaurant Guru** | *Restaurantguru.com* (Botón de Landing) | `https://es.restaurantguru.com/Caprichos-Campoy-San-Juan-de-Lurigancho` | `https://es.restaurantguru.com/Caprichos-Campoy-San-Juan-de-Lurigancho` | Directo (200 en Navegador; 405/503 Cloudflare en curl) | **Perfil:** Caprichos Campoy, San Juan de Lurigancho | **SÍ** (200 en Navegador) |
| **Google Maps (Ubicación)** | *C. 11, Lima 15457, Perú* | `https://www.google.com/maps/search/?api=1&query=-12.0196436,-76.963255` | Idéntica | Directo (200 OK) | **Coordenadas:** Lat `-12.0196436`, Lng `-76.963255` (Campoy, SJL, Lima) | **SÍ** (200) |
| **OlaClick (Banner Chatbot)** | *Empieza ahora* | `https://olaclick.com/es/chatbot-whatsapp-restaurantes-bares/` | `https://olaclick.com/es/chatbot-whatsapp/` | 301 Moved Permanently ➔ 200 OK | Promoción oficial del chatbot de WhatsApp | **SÍ** (200) |
| **OlaClick (Registro Panel)** | *Crear mi menú digital* | `https://panel.olaclick.app/register` | `https://panel.olaclick.app/register` | Directo (200 OK) | Enlace de captación de restaurantes de OlaClick | **SÍ** (200) |
| **OlaClick (Footer POS)** | *OlaClick version 4.00.f684a4e-v2* / *Crea tu menú digital con* | `https://olaclick.com/es/punto-de-venta` | `https://olaclick.com/es/punto-de-venta/` | 301 Moved Permanently ➔ 200 OK | Enlace corporativo de software TPV / Punto de Venta | **SÍ** (200) |
| **OlaClick (Términos Legales)** | *Términos de uso* (Checkout) | `https://olaclick.com/es/terms-and-condition/` | `https://olaclick.com/es/terminos-y-condiciones/` | 301 Moved Permanently ➔ 200 OK | Términos y condiciones generales de la plataforma | **SÍ** (200) |
| **OlaClick (Privacidad)** | *Política de privacidad* (Checkout) | `https://olaclick.com/es/politica-de-privacidad-de-la-plataforma/` | `https://olaclick.com/es/politica-de-privacidad/` | 301 Moved Permanently ➔ 200 OK | Política de tratamiento de datos personales | **SÍ** (200) |
| **OpenStreetMap** | *OpenStreetMap* (Atribución del mapa en checkout) | `https://www.openstreetmap.org/copyright` | `https://www.openstreetmap.org/copyright` | Directo (200 OK) | Licencia de mapas interactivos de OlaClick | **SÍ** (200) |
| **Teléfono Fijo (`tel:`)** | *No visible en interfaz* | **NO OBSERVADO** | **NO OBSERVADO** | N/A | El negocio no configuró línea telefónica fija (`telephone: null` en backend). Solo opera vía WhatsApp móvil. | N/A |
| **Correo Electrónico (`mailto:`)** | *No visible en interfaz* | **NO OBSERVADO** | **NO OBSERVADO** | N/A | No existe ningún hipervínculo `mailto:` ni dirección de correo visible en el frontend ni en metadatos. | N/A |
| **Libro de Reclamaciones** | *No visible en interfaz* | **NO OBSERVADO** | **NO OBSERVADO** | N/A | La plantilla de OlaClick para esta tienda no tiene integrado el enlace del Libro de Reclamaciones exigido por Indecopi. | N/A |

---

## 3. Mapa de Redireccionamientos y Comportamiento de Rutas

Durante el rastreo de URLs internas y externas se registraron los siguientes comportamientos de redirección:

### 3.1. Redirecciones a Nivel de Servidor y Protocolo
1. **Redirección Forzada a HTTPS:**
   - **Solicitud:** `http://caprichos-per.ola.click/`
   - **Respuesta:** HTTP/1.1 `301 Moved Permanently`
   - **Encabezado Location:** `https://caprichos-per.ola.click/`
   - **Servidor:** CloudFront / AWS (POP: MIA3-P8).

2. **Ruta de Checkout con Carrito Vacío (`/checkout`):**
   - **Solicitud:** `https://caprichos-per.ola.click/checkout`
   - **Respuesta:** HTTP/2 `302 Found`
   - **Encabezado Location:** `/cart`
   - **Comportamiento Nuxt:** El middleware de rutas de OlaClick detecta que la tienda no tiene productos en sesión local (`localStorage`) y redirige automáticamente al usuario a la vista de carrito vacío (`/cart`).

3. **Normalización Canónica de URLs de OlaClick:**
   - `https://olaclick.com/es/chatbot-whatsapp-restaurantes-bares/` ➔ 301 ➔ `https://olaclick.com/es/chatbot-whatsapp/`
   - `https://olaclick.com/es/terms-and-condition/` ➔ 301 ➔ `https://olaclick.com/es/terminos-y-condiciones/`
   - `https://olaclick.com/es/politica-de-privacidad-de-la-plataforma/` ➔ 301 ➔ `https://olaclick.com/es/politica-de-privacidad/`
   - `https://olaclick.com/es/punto-de-venta` ➔ 301 ➔ `https://olaclick.com/es/punto-de-venta/`

---

## 4. Ingeniería Inversa de WhatsApp: Puntos de Generación y Construcción del Mensaje

El sistema de pedidos de Caprichos en OlaClick utiliza WhatsApp como motor principal de cierre de pedidos y atención al cliente. Tras descompilar y analizar los bundles JavaScript (`Ch2y0kWI.js` y `Dg8-skhv.js`), se identificaron todos los puntos de generación y la lógica exacta de formateo.

### 4.1. Todos los Puntos donde se Genera el Enlace WhatsApp
1. **Botón Flotante y Cabecera de Redes Sociales (`SocialNetworks.vue`):**
   - Se muestra en `/`, `/products`, `/info` y en las páginas de categoría.
   - Enlace generado:
     ```text
     https://api.whatsapp.com/send?phone=51977503006&text=%F0%9F%91%8B+Hola%2C+vengo+de+http%3A%2F%2Fcaprichos-per.ola.click%0ADeseo+realizar+el+siguiente+pedido%3A%0A
     ```
   - **Mensaje predeterminado:** Saludo con la URL del negocio y el texto de intención de pedido vacío.

2. **Botón Principal de la Landing Page (`OrderTypeForLandingBadge.vue`):**
   - En la página de bienvenida (`/`), cuando el botón configurado es de tipo `whatsapp_number`.
   - Llama internamente a la función de JavaScript:
     ```javascript
     const url = nf({
       phone: n.landingContent.value, // "51977503006"
       message: r("whatsapp_messages.empty_cart", { companyUrl: originUrl })
     });
     window.open(url, "_blank");
     ```

3. **Cabecera de Soporte en Carrito y Checkout (`CartHeader.vue`):**
   - Cuando el cliente está visualizando el carrito o la pantalla de checkout, el botón de ayuda/contacto abre:
     ```javascript
     nf({ phone: companyWhatsapp }); // https://api.whatsapp.com/send?phone=51977503006
     ```
   - Abre un chat directo sin texto prellenado para consultas inmediatas.

4. **Botón Final de Confirmación de Pedido (`OrderSendWhatsappButton.vue`):**
   - Es el botón crucial que envía el pedido formalmente a la cafetería.
   - Lógica de activación:
     ```javascript
     if (c.value) {
       // Si el microservicio de orquestación de chat está activo:
       return `${s.public.apiBaseUrl}/ms-chat-orchestrator/public/whatsapp/order-summary?order_id=${n.order.id}&company_id=${r.companyId}`;
     }
     if (r.company) {
       // Fallback a generación directa de mensaje de WhatsApp:
       return nf({
         phone: r.companyWhatsapp,
         message: tTe({
           order: n.order,
           company: r.company,
           moneyFormatOptions: a.moneyFormatOptions,
           t: i,
           originUrl: l
         })
       });
     }
     ```

5. **Página de Seguimiento de Pedido (`/tracking`):**
   - Si el cliente abre la página de seguimiento, se genera un botón de contacto para consultar el estado:
     ```javascript
     nf({
       phone: r.companyWhatsapp,
       message: a("please_i_would_like_information_about_the_progress_of_my_order", [n.order?.public_id])
     });
     // Texto: "👋 Quisiera saber el avance de mi pedido [ID], actualmente marcado como [ESTADO]. Gracias!"
     ```

---

### 4.2. Función Constructora de URL (`nf`)
En el archivo `enlaces/js/Ch2y0kWI.js` (línea offset 1112351), la función central constructora de URLs está definida como:

```javascript
const n_e = "https://api.whatsapp.com/send";

function nf({ phone: e, message: t, utm_source: n, utm_medium: o, utm_campaign: r } = {}) {
  const a = new URL(n_e);
  if (e) a.searchParams.set("phone", e.replace(/\D/g, ""));
  if (t) a.searchParams.set("text", t);
  if (n) a.searchParams.set("utm_source", n);
  if (o) a.searchParams.set("utm_medium", o);
  if (r) a.searchParams.set("utm_campaign", r);
  return a.toString();
}
```

---

### 4.3. Estructura y Plantilla del Mensaje de Pedido Completo (`tTe`)
La función `tTe` ensambla el texto completo del pedido combinando múltiples bloques estructurados mediante funciones modulares:

```text
[1. SALUDO / ENCABEZADO]
👋 Hola, vengo de http://caprichos-per.ola.click
Deseo realizar el siguiente pedido:

[2. NÚMERO DE ORDEN E IDENTIFICADOR]
Order N.{orderQuantity} - {public_id}

[3. FECHA Y HORA]
🗓️ {dd/MM/yyyy} ⏰ {HH:mm}

[4. MODALIDAD DEL SERVICIO]
*Tipo de servicio: {Delivery | Retiro en tienda | Consumo en el local}*

[5. DATOS DEL CLIENTE]
Nombre: {clientName}
Teléfono: {country_code} {phone_number}
Dirección: {clientAddress} (https://www.google.com/maps/search/?api=1&query={lat},{lng})   <-- Solo si es Delivery

[6. LISTA DE PRODUCTOS]
*📝 Productos*

{cantidad} {producto} - {variante} *{precio}*
  Comentario: {comentario_específico_del_producto}
    {cantidad_modificador} {nombre_modificador} {precio_modificador}

[7. RESUMEN FINANCIERO]
*🧾 Resumen*

Subtotal: {combos_price}
Descuentos: -{discountAmount}
Servicio: {servicePrice}
Entrega: {deliveryPrice | Por definir}
*Total a pagar: {orderTotalPrice}*

[8. LISTA DE PAGOS Y FORMA DE PAGO]
*💲 Pago*
Estado del pago: {Pendiente | Pagado}
- {Método de pago}: {total} (Monto recibido: {received_amount}, Vuelto: {monto_vuelto}) + {tip} Propina

[9. COMENTARIOS ADICIONALES]
*Comentarios adicionales:*
_{comentario_general_del_cliente}_

[10. CIERRE Y LLAMADO A LA ACCIÓN]
👆 Envíanos este mensaje ahora. En cuanto lo recibamos estaremos atendiéndole.
```

---

### 4.4. Diccionario de Textos de WhatsApp (i18n Oficial en Español)
Extraído directamente de `enlaces/js/es_messages.json` (`/_i18n/d9a04b91/es/messages.json`):

| Clave i18n | Texto en Español | Uso en el Flujo |
| :--- | :--- | :--- |
| `whatsapp_messages.empty_cart` | `👋 Hola, vengo de {companyUrl}\nDeseo realizar el siguiente pedido:\n` | Mensaje inicial de bienvenida / catálogo |
| `whatsapp.inbound.title` | `👋 Vengo de {companyUrl}` | Saludo de orden entrante desde la web |
| `whatsapp.outbound.title` | `👋 {clientName}, aquí está el resumen de su pedido.` | Resumen enviado desde el panel hacia el cliente |
| `whatsapp.order_quantity` | `Order N.{orderQuantity}` | Número de orden correlativo diario |
| `whatsapp.service_type` | `Tipo de servicio: {serviceType}` | Delivery / Retiro en tienda |
| `whatsapp.client_name` | `Nombre: {clientName}` | Nombre ingresado en el formulario |
| `whatsapp.client_phone` | `Teléfono: {clientPhone}` | Celular con código de país |
| `whatsapp.client_address` | `Dirección: {clientAddress}` | Dirección con enlace a coordenadas |
| `whatsapp.product_list_title` | `📝 Productos` | Encabezado de la lista de ítems |
| `whatsapp.comment` | `Comentario` | Indicación por producto (ej. sin azúcar) |
| `whatsapp.summary` | `🧾 Resumen` | Encabezado del balance económico |
| `whatsapp.subtotal` | `Subtotal: {subtotal}` | Suma de productos sin delivery |
| `whatsapp.discount_price` | `Descuentos: -{discountAmount}` | Cupones o descuentos aplicados |
| `whatsapp.service_price` | `Servicio: {servicePrice}` | Cargo por servicio si aplica |
| `whatsapp.delivery_price` | `Entrega: {deliveryPrice}` | Costo de envío según zona o distancia |
| `whatsapp.to_be_defined_delivery_price` | `Por definir` | Cuando la tarifa requiere cálculo manual |
| `whatsapp.order_total_price` | `*Total a pagar: {orderTotalPrice}*` | Importe total final en Soles |
| `whatsapp.payments_list_title` | `💲 Pago` | Encabezado de la sección de pago |
| `whatsapp.payment_status` | `Estado del pago: {paymentStatus}` | Pendiente / Pagado / Fallido |
| `whatsapp.payment_methods` | `Métodos de pago:` | Desglose de pasarela, Yape, Plin o efectivo |
| `whatsapp.payment_received` | `Monto recibido` | Billete con el que pagará el cliente |
| `whatsapp.money_change` | `Vuelto` | Cálculo de vuelto para el repartidor |
| `whatsapp.tips` | `Propina` | Propina voluntaria para el equipo |
| `whatsapp.additional_comments` | `Comentarios adicionales` | Notas de entrega (ej. timbre descompuesto) |
| `whatsapp.inbound.order_summary_label` | `👆 Envíanos este mensaje ahora. En cuanto lo recibamos estaremos atendiéndole.` | Instrucción final al usuario |

---

## 5. Recorrido de Páginas, Categorías y Estado de Operación

### 5.1. Páginas y Categorías Auditadas
Se recorrieron y verificaron las siguientes rutas en el entorno en vivo y en los volcados HTML:
1. `https://caprichos-per.ola.click/` (Landing con botones de acción y acceso al menú).
2. `https://caprichos-per.ola.click/products` (Catálogo completo con carrusel de categorías).
3. `https://caprichos-per.ola.click/info` (Horarios de atención, dirección y redes).
4. `https://caprichos-per.ola.click/combos` (Promociones 3x2, packs y combos dúo).
5. `https://caprichos-per.ola.click/frio` (Frappés, frozen, iced coffee, tés helados).
6. `https://caprichos-per.ola.click/caliente` (Espresso, cappuccino, lattes, chocolate caliente).
7. `https://caprichos-per.ola.click/salado` (Club sándwich, empanadas, petit panes, sándwiches artesanales).
8. `https://caprichos-per.ola.click/postres` (Donas, galletas, waffles artesanales, kekes).
9. `https://caprichos-per.ola.click/favoritos` (Productos destacados de mayor demanda).
10. `https://caprichos-per.ola.click/cart` (Vista del carrito de compras).
11. `https://caprichos-per.ola.click/checkout` (Flujo de checkout y pasarela).

### 5.2. Estado Operativo de la Tienda y Restricciones Observadas
- **Estado de Horario:** La tienda opera normalmente de lunes a domingo de **14:00 a 22:00 horas**.
- **Mensaje en Interfaz:** Cuando se accede fuera de horario o en modo catálogo, la interfaz de OlaClick muestra el botón:
  > **"Cerrado - Pedir para luego"**
- **Modalidad "Pedir para luego":** Al interactuar con este botón, la aplicación permite programar el pedido para la apertura habitual o continuar en modo consulta.
- **Cumplimiento de Reglas de Seguridad:**
  - En estricto cumplimiento de las reglas del usuario, **NUNCA se envió ni confirmó un pedido real**.
  - No se invocaron endpoints de mutación (`POST/PUT/PATCH/DELETE`).
  - No se generaron chats no solicitados al número comercial de WhatsApp.

---

## 6. Conclusiones y Recomendaciones para la Nueva Web

1. **Unificación de Enlaces de WhatsApp:**  
   En la nueva web, se recomienda mantener el número corporativo (`+51 977 503 006`) y conservar la estructura de mensaje enriquecido que detalla productos, modificadores, método de pago y vuelto, ya que este formato minimiza la fricción operativa con los baristas y repartidores.
2. **Corrección de Redirecciones Obsoletas:**  
   Los enlaces de pie de página de la plataforma anterior apuntaban a URLs redirigidas (como `/es/chatbot-whatsapp-restaurantes-bares/` y `/es/terms-and-condition/`). En la nueva plataforma propia, todos los enlaces deben apuntar a sus rutas canónicas directas.
3. **Incorporación del Libro de Reclamaciones:**  
   La tienda anterior en OlaClick carecía de Libro de Reclamaciones virtual y políticas personalizadas del comercio. La nueva web debe incorporar obligatoriamente el enlace y formulario de Libro de Reclamaciones conforme a la normativa peruana.
4. **Optimización de Enlaces de Redes Sociales:**  
   Mantener la consistencia de los identificadores:
   - Instagram: `@caprichoscampoy`
   - TikTok: `@caprichoscampoy`
   - Facebook: `caprichosC`
   - Restaurant Guru: perfil activo de reseñas en Campoy.
"""

output_path = "/home/jose/JoseEM/caprichos/web-anterior/carta/enlaces/INFORME.md"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(informe_content)
print(f"Report written cleanly to {output_path}")
