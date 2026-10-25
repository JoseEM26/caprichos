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

El administrador puede encender o apagar cualquier aviso y modificar los tiempos de espera desde **Configuración del local → Parámetros del sistema** (`/admin/mirest?tab=parametros`):

| Clave | Tipo | Valor por Defecto | Efecto Operativo |
|---|:---:|:---:|---|
| `whatsapp_aviso_salida_activo` | Sí/No | `false` | Envía aviso 1 al cliente al marcarse la salida del repartidor. |
| `whatsapp_aviso_llegada_activo` | Sí/No | `false` | Envía aviso 2 al cliente al marcarse la llegada a la puerta. |
| `whatsapp_aviso_espera_activo` | Sí/No | `false` | Envía aviso de espera agotada y ofrece reprogramación con recargo. |
| `whatsapp_aviso_recojo_activo` | Sí/No | `false` | Envía aviso cuando el pedido para llevar está listo en barra. |
| `whatsapp_aviso_pago_confirmado_activo` | Sí/No | `false` | Envía confirmación al cliente cuando Caja aprueba el voucher. |
| `whatsapp_aviso_encuesta_activo` | Sí/No | `false` | Activa el envío automático de la encuesta de satisfacción. |
| `reparto_insistencia_min` | Numérico | `3` | Minutos en la puerta antes del aviso 3 de insistencia. |
| `reparto_espera_max_min` | Numérico | `10` | Tolerancia máxima en puerta antes de retirar al motorizado. |
| `reparto_recargo_reprogramacion` | Numérico | `0.00` | Recargo en soles por segundo intento de entrega tras reprogramación. |
| `encuesta_espera_min` | Numérico | `30` | Minutos posteriores a la entrega antes de enviar la encuesta. |
| `encuesta_puntaje_queja` | Numérico | `2` | Calificación (1 a 5) a partir de la cual se genera queja automática. |

---

## 6. Gestión de Quejas de WhatsApp vs Libro de Reclamaciones

Las calificaciones bajas (1 o 2 estrellas) o reclamos por chat se registran en `queja_whatsapp` y se gestionan en:
**Panel Administrativo → Reclamos → Pestaña «Quejas de WhatsApp (Chatbot)»** (`/admin/reclamos`).

- **Diferenciación Legal:** Estas quejas son **informales** y operativas. No están sujetas al plazo perentorio de 15 días hábiles del Código de Protección y Defensa del Consumidor (Ley 29571).
- **Flujo de Atención:** Un cajero o administrador puede revisar el caso, marcar la queja como `EN_REVISION`, registrar una nota de acuerdo con el cliente y marcarla como `RESUELTA` (todas las transiciones requieren confirmación Sí/No).
- **Escalamiento:** Si el cliente solicita formalmente el Libro de Reclamaciones, el personal debe orientarlo a registrarse en la carta pública (`/carta/legal/reclamaciones`).

---

## 7. Diagnóstico y Resolución de Problemas Frecuentes

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
