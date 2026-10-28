---
id: RB-CAP-007
tipo: runbook
titulo: "Runbook: Configuración, Conexión y Operación del Chatbot de WhatsApp (Meta Cloud API y Modo Simulado)"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-25
relacionados: [RB-CAP-001, RB-CAP-005, SEC-CAP-001]
tags: [runbook, whatsapp, chatbot, meta, cloud-api, webhooks, operaciones, ley-29733]
---

# RB-CAP-007 — Configuración, Conexión y Operación del Chatbot de WhatsApp

| Campo | Valor |
|---|---|
| **Cuándo usarlo** | Puesta en marcha inicial del conector de WhatsApp, vinculación de cuenta comercial en Meta for Developers, alta y sincronización de plantillas oficiales, rotación del App Secret o Token de Sistema, resolución de incidencias en webhooks o cambio de modo (Meta Cloud API ↔ Simulado). |
| **Tiempo esperado** | Alta y configuración inicial: 15 a 25 minutos (sujeto a tiempos de aprobación de plantillas por Meta) · Diagnóstico de webhook o conmutación a modo simulado: menos de 2 minutos. |
| **Quién lo ejecuta** | Rol `ADMIN` (administrador general) o Soporte DevOps / Infraestructura. |
| **Módulos afectados** | `apps/api/src/modulos/chatbot/`, `apps/web/src/admin/reclamos/`, `apps/web/src/admin/configuracion/`, base de datos (`whatsapp_mensaje`, `cliente_whatsapp_consentimiento`, `encuesta_posventa`, `queja_whatsapp`). |

---

## 1. Arquitectura y Seguridad del Conector

El módulo de Chatbot de WhatsApp de Caprichos opera **dentro del núcleo de la API NestJS** (`apps/api/src/modulos/chatbot`) bajo arquitectura de puertos y adaptadores:

```
┌────────────────────────────────────────────────────────────────────────┐
│                          API NESTJS (Caprichos)                        │
│                                                                        │
│   [POST /whatsapp/webhook] ─── HMAC-SHA256 ────► WhatsappWebhookService│
│   [GET  /whatsapp/webhook] ─── Hub Challenge ──► (Idempotente)        │
│                                                       │                │
│                                                       ▼                │
│   ChatbotPlanificadorService ──────────────► WhatsAppMensajeriaPuerto  │
│   (Lock Redis cada 30s)                               │                │
│                                        ┌──────────────┴──────────────┐ │
│                                        ▼                             ▼ │
│                              WhatsAppMetaAdaptador       WhatsAppSimulado│
│                              (Meta Cloud API real)       (Modo seguro) │
└────────────────────────────────────────────────────────────────────────┘
```

### Reglas de Seguridad Obligatorias:
1. **Sin secretos en disco ni logs:** Nunca registrar en texto plano claves de API, tokens de acceso ni números de teléfono completos.
2. **Enmascaramiento auditado:** Los números de teléfono se almacenan y muestran únicamente como `+51 9*** ***21` y se indexan mediante SHA-256 (`telefono_hash`).
3. **Validación de Webhooks:** Todo evento entrante desde Meta (`POST /whatsapp/webhook`) se autentica mediante HMAC-SHA256 en tiempo constante (`crypto.timingSafeEqual`) contra el cuerpo crudo de la solicitud (`rawBody`).
4. **Cumplimiento de Ley 29733 (Protección de Datos Personales):** Si el cliente escribe **BAJA** o **STOP**, el sistema revoca inmediatamente su consentimiento en `cliente_whatsapp_consentimiento` y bloquea cualquier mensaje futuro que no sea estrictamente operativo de un pedido en curso.

---

## 2. Variables de Entorno Oficiales

Las variables se definen exclusivamente en el entorno de ejecución del contenedor (`docker-compose.yml` o inyección en Kubernetes / Swarm). **Nunca agregue valores reales a `.env.example` ni los versione en Git.**

| Variable | Descripción | Modo Simulado | Modo Meta Real |
|---|---|:---:|:---:|
| `WHATSAPP_TOKEN` | Token permanente de usuario del sistema Meta con permisos de mensajería | Opcional (vacío) | **Requerido** |
| `WHATSAPP_PHONE_ID` | Identificador numérico del número de teléfono en Meta Business Manager | Opcional (vacío) | **Requerido** |
| `WHATSAPP_VERIFY_TOKEN` | Token secreto pactado para verificar la suscripción GET del webhook | Opcional | **Requerido** |
| `WHATSAPP_APP_SECRET` | Clave secreta de la aplicación Meta para validar la firma HMAC-SHA256 | Opcional | **Requerido** |
| `ADMIN_WHATSAPP_NUMBERS` | Números de teléfono del personal administrativo autorizados (separados por coma) | Opcional | Opcional |
| `OPENAI_API_KEY` | Clave para el motor de lenguaje de fases posteriores | Opcional | Opcional |
| `OPENAI_MODEL` | Nombre del modelo de IA (ej. `gpt-4o-mini`) | Opcional | Opcional |

> [!NOTE]
> **Detección Automática de Adaptador:**
> Si `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID` están presentes y no vacíos, el sistema inicia automáticamente con `WhatsAppMetaAdaptador`. Si falta cualquiera de ellos, arranca en modo seguro con `WhatsAppSimuladoAdaptador` (los mensajes se guardan en la base de datos con estado `SIMULADO` y se notifican internamente sin realizar llamadas a la API de Meta ni contactar a clientes).

---

## 3. Procedimiento de Alta y Conexión con Meta Cloud API

### Paso 1: Crear la Aplicación en Meta for Developers
1. Inicie sesión en [Meta for Developers](https://developers.facebook.com/) con la cuenta comercial oficial de Caprichos.
2. Vaya a **Mis apps → Crear app**.
3. Seleccione el tipo **Otro** y elija el caso de uso **Negocios**.
4. Nombre de la aplicación: `Caprichos Chatbot`.
5. Vincule la aplicación a la cuenta de Meta Business Manager del negocio.

### Paso 2: Configurar el Producto WhatsApp
1. En el panel lateral de la aplicación, añada el producto **WhatsApp**.
2. En **WhatsApp → Configuración de la API**:
   - Copie el **Identificador de número de teléfono** (`Phone Number ID`) y asígnelo a `WHATSAPP_PHONE_ID`.
   - Copie el **Identificador de la cuenta de WhatsApp Business** (`WABA ID`).

### Paso 3: Generar Token Permanente de Usuario del Sistema
1. En [Meta Business Manager](https://business.facebook.com/settings/system-users):
2. Vaya a **Usuarios → Usuarios del sistema → Agregar**.
3. Nombre: `Bot-Caprichos-API` con rol **Empleado** o **Administrador**.
4. Presione **Asignar activos**:
   - En **Apps**, seleccione `Caprichos Chatbot` con control total.
   - En **Cuentas de WhatsApp**, seleccione la cuenta de Caprichos con permisos de administración y mensajería.
5. Presione **Generar nuevo token**:
   - Seleccione la app `Caprichos Chatbot`.
   - Marque los permisos obligatorios:
     - `whatsapp_business_messaging`
     - `whatsapp_business_management`
   - Vigencia del token: **Nunca caduca** (permanente).
6. Copie el token generado y guárdelo en su gestor de secretos seguro para inyectarlo como `WHATSAPP_TOKEN`.

### Paso 4: Configurar el Webhook
1. En la consola de Meta for Developers, diríjase a **WhatsApp → Configuración → Webhooks**.
2. Presione **Editar**:
   - **URL de devolución de llamada:** `https://api.caprichos.pe/whatsapp/webhook`
   - **Token de verificación:** Ingrese un valor alfanumérico seguro (ej. 32 caracteres generados al azar) y configúrelo idéntico en `WHATSAPP_VERIFY_TOKEN`.
3. Presione **Verificar y guardar**. Meta enviará una solicitud `GET` que la API validará y responderá con el desafío en menos de 1 segundo.
4. En los campos de webhook del objeto `messages`, presione **Administrar** y active la suscripción a:
   - `messages` (mensajes entrantes de texto, botones, listas e imágenes)

### Paso 5: Obtener y Configurar el App Secret
1. En la consola de Meta, diríjase a **Configuración de la app → Básica**.
2. En el campo **Clave secreta de la app**, presione **Mostrar**.
3. Copie el secreto y configúrelo en la variable de entorno `WHATSAPP_APP_SECRET`.

---

## 4. Gestión de Plantillas de Utilidad Oficiales

Cuando la ventana de 24 horas del cliente está cerrada, Meta prohíbe el envío de texto libre. Caprichos utiliza plantillas de categoría **UTILIDAD** aprobadas previamente en Meta:

Consulte el documento [`docs/operacion/PLANTILLAS-WHATSAPP.md`](./PLANTILLAS-WHATSAPP.md) para la lista completa y textos exactos para aprobación.

### Catálogo de Plantillas en Código:
1. `caprichos_delivery_en_camino`: Aviso cuando el motorizado sale de la cafetería con el pedido.
2. `caprichos_delivery_en_puerta`: Aviso cuando el repartidor llega al domicilio del cliente.
3. `caprichos_delivery_insistencia`: Aviso 3 si el cliente no responde tras 3 minutos en la puerta.
4. `caprichos_delivery_espera_agotada`: Aviso de reprogramación con botones interactivos cuando se supera la tolerancia máxima de espera.
5. `caprichos_pago_confirmado`: Confirmación tras la validación humana del comprobante por Caja.
6. `caprichos_recojo_listo`: Aviso para pedidos en modalidad recojo en tienda.
7. `caprichos_encuesta_posventa`: Encuesta de satisfacción posventa con botones de calificación.

### Procedimiento para Dar de Alta una Plantilla en Meta:
1. Inicie sesión en [Meta Business Suite → Administrador de WhatsApp → Plantillas de mensajes](https://business.facebook.com/wa/manage/message-templates/).
2. Presione **Crear plantilla**.
3. Categoría: **Utilidad** (NO elija Marketing).
4. Idioma: **Español** (`es`).
5. Copie el texto y los parámetros exactos especificados en [`PLANTILLAS-WHATSAPP.md`](./PLANTILLAS-WHATSAPP.md).
6. Envíe la plantilla a revisión (el tiempo de respuesta de Meta suele ser inferior a 15 minutos para plantillas de utilidad).

---

## 5. Parámetros Operativos del Chatbot en el Panel Web

Los avisos al cliente de delivery se registran una vez por pedido y etapa (tabla `mensaje_reparto`) y se copian en `mensaje_chat`. Si un aviso está apagado no se envía ni se registra. El administrador puede encender o apagar cualquier aviso y modificar los tiempos de espera desde **Configuración del local → Parámetros del sistema** (`/admin/mirest?tab=parametros`):

| Clave | Tipo | Valor por Defecto | Efecto Operativo |
|---|:---:|:---:|---|
| `chatbot_activo` | Sí/No | `true` | Interruptor general del motor conversacional del chatbot. |
| `chatbot_ia_activo` | Sí/No | `false` | Activa la IA de lenguaje (OpenAI) para preguntas libres y recomendaciones. |
| `chatbot_ia_tope_mensual_usd` | Numérico | `20` | Tope máximo mensual en USD antes de desconectar automáticamente la IA. |
| `whatsapp_aviso_salida_activo` | Sí/No | `si` | Aviso 1 al cliente cuando el pedido sale en camino (evento de salida). |
| `whatsapp_aviso_llegada_activo` | Sí/No | `si` | Aviso 2 al cliente al llegar a la puerta; también activa la insistencia (aviso 3). |
| `whatsapp_aviso_espera_activo` | Sí/No | `si` | Aviso de espera agotada con reprogramación (4), y retiro automático de la movilidad (5). |
| `whatsapp_aviso_recojo_activo` | Sí/No | `si` | Aviso cuando el pedido para llevar o recojo está listo en barra. |
| `whatsapp_aviso_pago_confirmado_activo` | Sí/No | `si` | Aviso 6 al cliente cuando Caja acepta el pedido delivery o se confirma su pago. |
| `whatsapp_aviso_listo_activo` | Sí/No | `si` | Aviso 7 al cliente cuando el pedido delivery queda LISTO en cocina. |
| `whatsapp_aviso_entregado_activo` | Sí/No | `si` | Aviso 8 de agradecimiento al cliente cuando el pedido delivery se entrega. |
| `whatsapp_aviso_recibido_activo` | Sí/No | `si` | Aviso 9 al cliente cuando crea un pedido desde la carta virtual con celular (cualquier modalidad). Con Yape, Plin o transferencia también deja la conversación para una persona de Caja (VALIDAR_PAGO, urgente). |
| `whatsapp_aviso_encuesta_activo` | Sí/No | `si` | Activa el envío automático de la encuesta de satisfacción. |
| `asistido_espera_min` | Numérico | `3` | Minutos de espera sin respuesta humana en ATENCION_PERSONA antes de activar el modo asistido del bot. |
| `reparto_insistencia_min` | Numérico | `3` | Minutos en la puerta antes del aviso 3 de insistencia. Tras espera máxima + este valor, la movilidad se retira. |
| `reparto_espera_max_min` | Numérico | `10` | Minutos en la puerta para avisar al cliente que la movilidad se retirará (espera agotada). |
| `reprog_recargo_modo` | Texto | `IGUAL_ENVIO` | Costo de volver a enviar tras el retiro: `IGUAL_ENVIO` (mismo costo del envío del pedido; si fue gratis, tarifa de la zona), `FIJO` (usa `reparto_recargo_reprogramacion`) o `SIN_COSTO`. |
| `reparto_recargo_reprogramacion` | Numérico | `0.00` | Monto fijo del reenvío tras el retiro; solo se usa si `reprog_recargo_modo` es `FIJO`. |
| `encuesta_espera_min` | Numérico | `30` | Minutos posteriores a la entrega antes de enviar la encuesta. |
| `encuesta_puntaje_queja` | Numérico | `2` | Calificación (1 a 5) a partir de la cual se genera queja automática. |

---

## 6. Reglas de Operación y Comportamiento del Chatbot

### A. Flujo de Pedidos
1. **Límites de cantidad:** Se eliminó el tope previo de 20 unidades por producto. Ahora el techo técnico es de 9,999 unidades para pedidos corporativos o eventos, y la validación final se realiza contra el pago.
2. **Nombre por envase en bebidas:** En categorías de bebidas (`FRAPPES`, `ICED`, `FROZEN`, `CALIENTES`), el bot pregunta interactivamente si desea colocar un nombre personalizado a cada vaso para su rotulación en barra (ej. "Para María Elena"), con confirmación obligatoria Sí/No.
3. **Captura inteligente de teléfono:** Cuando el cliente interactúa por primera vez, el bot le ofrece el botón interactivo *Usar este número* con su propio teléfono detectado. El prefijo internacional `51` ya no descarta la coincidencia.
4. **Comprobantes tributarios:** El flujo solo admite **Boleta** o **Factura** (exigiendo RUC y razón social válidos). No se admiten notas de venta informales.
5. **Mensaje de pago digital y cocina:** Al subir un voucher o elegir pago digital, el bot informa explícitamente al cliente: *«Pasa a cocina apenas validemos tu pago»*. La comanda **no aparece en la pantalla de Cocina** hasta que Caja valida y aprueba el comprobante en `/admin/mensajes`.

### B. Flujo de Reservas
1. **Franjas horarias dinámicas:** El bot consulta las franjas horarias disponibles para la **fecha elegida** (no las del día de hoy), calculando las mesas libres según el horario oficial.
2. **Robustez en nombres y notas:** La nota, el nombre y los datos ingresados por el cliente no se confunden con una petición de hablar con una persona aunque contengan palabras como *"personas"*, *"atención"* o *"ayuda"*.
3. **Alerta urgente en campana:** Toda solicitud de reserva genera una notificación en tiempo real en la campana de avisos para el personal de Salón y Caja con el contador actualizado de reservas pendientes.

### C. Horario de atención: Demo vs Producción
> [!IMPORTANT]
> **HORARIO DE ATENCIÓN TEMPORAL EN DEMO:**
> Para permitir pruebas continuas y revisiones de agentes a cualquier hora, la demo tiene configurado el horario **24/7**.
> **Antes de pasar a producción:** Debe restaurarse el horario comercial real: **Lunes a Sábado de 14:00 a 22:00, con Domingo cerrado**, configurado en `LocalService` o parámetros del local. Fuera de ese rango, el bot informa al cliente que el local está cerrado y ofrece revisar la carta para el día siguiente.

### D. Modo Pruebas vs Modo Público
- En desarrollo, el número de Meta tiene un **límite estricto de 5 destinatarios de prueba**.
- Para conectar el número comercial real del negocio y abrir el bot al público, siga paso a paso la [Guía: Cómo hacer público el bot de WhatsApp](./GUIA-hacer-publico-el-bot-de-whatsapp.md).

### E. Modo Asistido en ATENCION_PERSONA
Cuando un chat entra en `ATENCION_PERSONA` (por demora, queja, solicitud de asesor o error), el cliente no queda silenciado ni desatendido:
1. **Regla de activación temporal y acciones inmediatas:**
   - Si no hay respuesta humana (`SALE`, `PERSONA`) en `asistido_espera_min` (por defecto 3 minutos), el bot reanuda respuestas con alcance acotado.
   - Si el cliente pulsa botones o escribe intenciones directas (`menu`, `carta`, `pedir`, `estado`, `horario`, `persona`), el bot responde **de inmediato sin esperar los 3 minutos**.
   - **Exclusiones:** No aplica si el chat está tomado por un asesor (`tomado_por !== null`), si un asesor humano escribió hace menos de 3 minutos, o si la conversación está en `VALIDAR_PAGO` (la decisión de pago se mantiene 100 % humana en Caja).
2. **Preservación de propiedad y prioridad:**
   - El modo asistido **NO** libera la conversación (`duenio` se mantiene como `PERSONA`).
   - El indicador `urgente: true` se preserva para mantener visible el chat en la cola de Mensajes de Caja.
3. **Nuevo pedido independiente:**
   - El cliente puede registrar un nuevo pedido independiente sin interferir con el pedido en curso. El nuevo pedido ingresa normalmente al flujo operativo.
4. **Solicitudes de cambio o cancelación de pedidos:**
   - El bot **NUNCA** cancela ni modifica pedidos por su cuenta.
   - En su lugar, registra formalmente una solicitud de cambio (`crearSolicitudCambio`) para Caja con el mensaje: *«Registre tu solicitud de cancelacion; una persona de Caja la confirma.»* (advirtiendo que si el pedido ya está en preparación, listo o en camino, podría no ser posible). Emite notificación prioritaria en campana y módulo de Mensajes.
5. **Consultas libres e Inteligencia Artificial:**
   - Si `chatbot_ia_activo` está encendido y tiene API key válida, resuelve dudas libres mediante el módulo de IA (`ia/`).
   - Si la IA está apagada, responde con la frase fija: *«Ya avise a una persona; mientras tanto puedo ayudarte con esto:»* acompañada de botones interactivos (`[Ver la carta]`, `[Estado de mi pedido]`, `[Hablar con persona]`), todos con longitud estricta ≤ 20 caracteres.
   - La frase fija cuenta con rate-limiting en Redis y contexto: como máximo se envía una vez cada 3 minutos por conversación para evitar spam.
6. **Reglas de oro inviolables:**
   - El bot y la IA **NUNCA** aprueban comprobantes ni pagos.
   - El bot y la IA **NUNCA** cancelan ni reembolsan pedidos directamente.
   - El bot y la IA **NUNCA** alteran ítems ni estados de pedidos en progreso de forma autónoma.

### F. Cierre comercial y promociones
1. **Cierre comercial determinista:**
   - Después de toda respuesta de IA o de la ficha de producto del catálogo (`CARTA_PRODUCTO_DETALLE`) que mencione un producto concreto, el **código** (nunca el modelo LLM) adjunta una frase corta, cálida y sobria animando a la compra (rotación entre *«¿Te animas a pedirlo?»*, *«¿Te gustaría pedirlo ahora?»*, *«¿Te provoca probarlo hoy?»*) sin presión ni falsas urgencias.
   - El prompt de sistema de la IA prohíbe explícitamente al modelo emitir cierres comerciales, instrucciones de botones o frases pasivas del tipo *«Si deseas pedirlo, recuerda hacerlo a través del menú de botones»*.
2. **Botones interactivos de respuesta (límite WhatsApp):**
   - Cumplimiento estricto del límite de la API de WhatsApp Cloud: máximo **3 botones** por mensaje interactivo y títulos con longitud estricta **≤ 20 caracteres**.
   - Prioridad de botones para producto concreto:
     1. `[Pedir este producto]` (19 caracteres, ID `ped_prod_${id}`): Inicia directamente el flujo de pedido en dicho producto (selección de tamaño si tiene más de uno, o cantidad y opciones), sin volver a consultar modalidad genérica.
     2. `[Ver la promo]` (12 caracteres, ID `btn_promo_${id}`): Si existe una promoción activa vinculada.
     3. `[Volver al menú]` (15 caracteres, ID `btn_menu`) o `[Hablar con persona]` (18 caracteres, ID `btn_persona`).
   - Si la respuesta recomienda múltiples productos: botones `[Hacer un pedido]` (15 caracteres) y `[Ver la carta]` (12 caracteres).
3. **Promociones calculadas por código (Anti-Alucinación):**
   - El bot consulta ofertas vigentes en el canal WhatsApp y horario actual (combos, lleva y paga, descuentos porcentuales o fijos).
   - Si existe una oferta aplicable, adjunta **una sola línea** con el beneficio exacto calculado por código: nombre, precio regular, precio promocional y ahorro (ej. *«Con el Dúo Irresistible pagas S/ 37.00 en vez de S/ 41.00 (ahorras S/ 4.00)»*).
   - Si no hay oferta vigente, no se inventa ninguna promoción.
   - Todos los precios, montos y ahorros son calculados matemáticamente con centavos exactos (`redondearMonto`) y formateados como `S/ XX.XX`.
4. **Validación y corrección de precios de la IA:**
   - El modelo LLM recibe el catálogo únicamente como contexto de solo lectura.
   - El código audita los montos mencionados en el texto de la IA contra los precios reales del catálogo (precio base y presentaciones). Si se detecta cualquier precio divergente o inventado, el código descarta la alucinación y la reemplaza por la ficha técnica determinista oficial.
5. **Respeto a interruptores de negocio:**
   - Si los pedidos están deshabilitados en el local (`funcionesActivas.pedido === false`), no se muestra `[Pedir este producto]` y se prioriza `[Hablar con persona]`.
   - Si el local está cerrado, se respetan los avisos de horario fuera de atención.
   - No se duplica el cierre si el cliente ya se encuentra en el flujo de pedido de ese producto.

---

## 7. Gestión de Quejas de WhatsApp vs Libro de Reclamaciones

Las calificaciones bajas (1 o 2 estrellas) o reclamos por chat se registran en `queja_whatsapp` y se gestionan en:
**Panel Administrativo → Reclamos → Pestaña «Quejas de WhatsApp (Chatbot)»** (`/admin/reclamos`).

- **Diferenciación Legal:** Estas quejas son **informales** y operativas. No están sujetas al plazo perentorio de 15 días hábiles del Código de Protección y Defensa del Consumidor (Ley 29571).
- **Flujo de Atención:** Un cajero o administrador puede revisar el caso, marcar la queja como `EN_REVISION`, registrar una nota de acuerdo con el cliente y marcarla como `RESUELTA` (todas las transiciones requieren confirmación Sí/No).
- **Escalamiento:** Si el cliente solicita formalmente el Libro de Reclamaciones, el personal debe orientarlo a registrarse en la carta pública (`/carta/legal/reclamaciones`).

---

## 8. Diagnóstico y Resolución de Problemas Frecuentes

### Problema A: El Webhook devuelve 401 Unauthorized
- **Causa:** `WHATSAPP_APP_SECRET` no coincide o la cabecera `X-Hub-Signature-256` está ausente.
- **Solución:** Verifique en la consola de Meta la clave secreta de la app e inyéctela en la variable de entorno sin espacios en blanco.

### Problema B: Error `[FUERA_DE_VENTANA_24H]` en logs
- **Causa:** Se intentó enviar un mensaje iniciado por el negocio con texto libre habiendo transcurrido más de 24 horas desde la última interacción del cliente.
- **Solución:** El conector conmuta automáticamente al envío de plantilla aprobada. Si la plantilla no está creada o aprobada en Meta, se registrará el error y se alertará internamente a Caja para coordinar telefónicamente.

### Problema C: Error `[PLANTILLA_NO_APROBADA]`
- **Causa:** El nombre o idioma (`es`) de la plantilla configurada en el sistema no coincide exactamente con el registrado en Meta Business Suite.
- **Solución:** Verifique en Meta Business Suite que el nombre de la plantilla figure en estado **Aprobada** (color verde).

### Problema D: Cambiar temporalmente a Modo Simulado (Contingencia)
Si Meta presenta intermitencias o se requiere aislar el entorno para pruebas sin contactar clientes:
1. Elimine o vacíe las variables `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`.
2. Reinicie el contenedor de la API.
3. El sistema entrará en **Modo Simulado**: los mensajes saldrán con estado `SIMULADO` en la base de datos y la campana de notificaciones seguirá alertando al equipo.
