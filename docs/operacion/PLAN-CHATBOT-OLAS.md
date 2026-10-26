---
id: PLAN-CAP-BOT
tipo: plan
titulo: "Plan por olas del chatbot de WhatsApp y registro de avances"
estado: borrador
producto: caprichos
version: "0.1"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-25
relacionados: [RB-CAP-007, PLANTILLAS-WHATSAPP, FT-BOT-01, FT-BOT-02, FT-BOT-03, FT-ATN-01, FT-ATN-02, FT-ATN-03]
tags: [chatbot, whatsapp, meta, plan, avances]
---

# Plan por olas del chatbot de WhatsApp

Este documento registra qué se decidió, qué se construye en cada ola y qué se probó. No contiene claves, tokens ni números de teléfono. Es un borrador del equipo técnico: la IA propone y el humano decide.

## 1. Decisiones firmadas (25/10/2026)

| Decisión | Detalle |
|---|---|
| Dónde vive el bot | Módulo dentro de la API (`apps/api/src/modulos/chatbot`), no un proyecto aparte. |
| Mensajería | Una capa con dos adaptadores intercambiables: Meta real y simulado. Sin credenciales se usa el simulado (no envía nada). |
| Orden | Primero avisos automáticos y encuesta (Fase 1, hecha), luego conversación del bot y pedido, luego IA. |
| Quejas | No se avisa a un grupo de WhatsApp. Se guardan en tabla, se ven en Reclamos con fuente «WhatsApp» y se notifica por la campana. |
| Pruebas de esta etapa | Solo programación: pruebas automáticas con el adaptador simulado. Sin Playwright. La prueba real la hace el responsable con su celular. |
| Quién aprueba | La IA nunca aprueba pagos ni documentos. El pago lo confirma una persona de Caja. |
| Menú y textos idénticos al mockup Chatbot.dc.html | El menú principal se envía como mensaje interactivo de lista con el botón 'Ver opciones' y las filas del mockup: Hacer un pedido, Reservar mesa, Ver la carta, Mi pedido, Preguntar algo, Hablar con persona. Los textos y emojis replican fielmente el guión del mockup. La información mostrada se alimenta en tiempo real de la base de datos (LocalService, CatalogoService, OfertasService y SeguimientoService); la IA nunca inventa datos ni aprueba pagos. |

## 2. Estado de la conexión con Meta (etapa de pruebas)

Completado y verificado el 25/10/2026:

- App de pruebas de Meta publicada, separada de la app del bot actual (el bot actual no se tocó).
- Número de prueba de Meta con el celular del responsable como destinatario.
- Webhook verificado, suscrito al campo `messages`, con la clave secreta de la app cargada para validar la firma.
- La cuenta de WhatsApp de prueba suscrita a la app de pruebas (paso que Meta no hace solo, ver lecciones).
- Entrada de mensajes reales comprobada: llegan, se guardan y se asocian a una conversación.

### Lecciones aprendidas con Meta (para no repetirlas)

1. **Una URL de webhook por app.** Por eso la prueba va en una app aparte del bot actual.
2. **Meta solo verifica el webhook cuando cambia la URL o el token.** Si la API se reinicia con otros valores, hay que volver a verificar.
3. **App en modo desarrollo = solo webhooks de prueba del panel.** Para recibir mensajes reales hay que publicar la app. Publicar es gratis y reversible.
4. **La cuenta de WhatsApp debe estar suscrita a la app** (`subscribed_apps`). El botón «Test» del panel funciona aunque no lo esté, pero los mensajes reales no llegan hasta suscribirla.
5. **El token temporal dura 24 horas.** Para uso continuo hace falta un token permanente de un usuario del sistema (paso de producción).
6. **El número de prueba solo puede enviar a destinatarios verificados** (hasta 5). Puede recibir de cualquiera, pero no se puede contestar a quien no esté verificado.
7. **El túnel temporal cambia de dirección cada vez que se enciende.** Hay que volver a registrar el webhook con la nueva.
8. **Fuera de las 24 horas solo se permiten plantillas aprobadas** (ver `PLANTILLAS-WHATSAPP.md`).
9. **Meta ya puede identificar al usuario por BSUID sin telefono; el envio usa el campo recipient.**

## 3. Olas de trabajo

| Ola | Agente | Alcance | Estado |
|---|---|---|---|
| 0 | bot-contactos | Nombre del contacto (perfil de WhatsApp y edición manual con confirmación). Corrección del remitente sin teléfono, que dejaba la conversación con teléfono vacío y mezclaba remitentes. | En curso |
| 1 | A. Envío real | Que Mensajes envíe por Meta (texto en ventana de 24 horas, plantilla fuera), con estado de cada mensaje y errores claros. Reemplaza la pasarela simulada de la consola. | Pendiente |
| 1 | B. Motor de conversación | Menú de bienvenida, botones y listas, memoria del paso por cliente, horario del local, pase a una persona y comando BAJA. Sin pedidos todavía. | Pendiente |
| 2 | C. Pedido por botones | Categoría, producto y opciones, carrito, entrega y confirmación, con las mismas reglas de la carta (ofertas, agotados, local abierto, tarifas); usa los textos y botones exactos del mockup. FT-BOT-01. | Pendiente |
| 2 | D. Pago por WhatsApp | Datos de pago, voucher, aprobación por Caja y seguimiento del pedido; usa los textos y botones exactos del mockup. FT-BOT-02. Depende de C. | Pendiente |
| 2 | E. Cambios y derivación | Cambios después del pedido y pase a una persona si el bot no entiende (una repregunta y luego deriva); usa los textos y botones exactos del mockup. FT-ATN-02. | Pendiente |
| 3 | F. Reservas | Pedir una reserva por WhatsApp con las reglas existentes; usa los textos y botones exactos del mockup. | Pendiente |
| 3 | G. IA para dudas | OpenAI con herramientas de solo lectura (carta, precios, horario, estado del pedido), tope de gasto, sin inventar datos y con pase a persona; usa los textos y botones exactos del mockup. FT-BOT-03. | Pendiente |
| 4 | H. Avisos internos | Pedido nuevo y aviso a Almacén por WhatsApp a los números del equipo. Sin grupos; usa los textos y botones exactos del mockup. | Pendiente |
| 4 | I. Configuración y seguridad | Textos del bot editables, interruptor por función, consumo de IA, límite de mensajes por teléfono y privacidad de datos (Ley 29733); usa los textos y botones exactos del mockup. | Pendiente |

Reglas de ejecución: máximo 2 o 3 agentes a la vez, cada ola verificada (tipos, pruebas unitarias y construcción) y subida en commits ordenados antes de pasar a la siguiente.

## 4. Decisiones pendientes del negocio

| Para la ola | Decisión | Quién |
|---|---|---|
| 2 | Texto de los datos de pago (Yape, Plin, cuentas) y cobro de delivery | Kevin |
| 3 | Tope mensual de gasto en OpenAI | Kevin y José |
| 3 | Tono del bot (formal o cercano) | Kevin |
| Producción | Texto definitivo de la política de privacidad y los términos (hoy son de ejemplo) | Kevin y su asesor legal |

## 5. Pendiente para producción (no es de esta etapa)

1. Verificación de la empresa en Meta, con documentos de Kevin.
2. Token permanente de un usuario del sistema.
3. Plantillas aprobadas por Meta.
4. Registro del número real del local y método de pago. Hay que planificar el cambio sin cortar el bot actual.
5. Revisión legal de la política de privacidad.
6. Rotar la contraseña y la llave SSH que tiene el bot anterior en su carpeta (`legacy/capri-bot`), que no está en Git pero sí en disco.

## 6. Registro de avances

| Fecha | Avance |
|---|---|
| 25/10/2026 | Fase 1 del bot construida: capa de mensajería, webhook firmado, avisos automáticos, encuesta y quejas. Todos los avisos apagados por defecto. |
| 25/10/2026 | Conexión con Meta de pruebas completada y entrada de mensajes reales comprobada. |
| 25/10/2026 | Detectado que la consola de Mensajes aún usa la pasarela simulada y no envía por Meta. Se programa en la Ola 1. |
| 25/10/2026 | Detectado un remitente sin teléfono que dejó una conversación con teléfono vacío. Corrección en curso (Ola 0). |
| 25/10/2026 | Ola 1 Agente B completada: motor de conversación puro por máquina de estados en conversacion.flujo, saludo con botones, pedido informativo, horario y ubicación con LocalService, pase a persona con notificación por campana, repregunta/derivación ante no entendidos, método enviarLista, rate limit de 5 respuestas/min en Redis, e interruptor chatbot_activo en configuración y admin. |
| 25/10/2026 | Ola 1 Agente A completada: pasarela real WhatsAppMetaGateway en Mensajes conectada a WhatsAppMensajeriaPuerto (Cloud API de Meta o Simulado), control estricto de ventana de 24 horas con plantilla de utilidad caprichos_reabrir_conversacion, mapeo de errores comprensibles en español sin secretos, estados por mensaje enlazados a whatsapp_mensaje (Enviado, Entregado, Leido, Fallido con botón Reintentar), rate limit de 20 msgs/min por usuario en Redis y actualización en tiempo real por WebSocket. |
| 25/10/2026 | Soporte de respuestas a usuarios identificados por BSUID (sin teléfono) en Meta WhatsApp Cloud API mediante función construirDestinatario (campo recipient), habilitación en MensajesService y motor conversacional, enmascarado seguro y mapeo de rechazo de identificador. |
| 25/10/2026 | Menú y textos del bot alineados al mockup Chatbot.dc.html: menú principal interactivo de lista con botón 'Ver opciones' y las 6 filas del mockup (Hacer un pedido, Reservar mesa, Ver la carta, Mi pedido, Preguntar algo, Hablar con persona) respetando límites de Meta; navegación completa de la carta virtual en el chat con categorías, productos, precios, tamaños, opciones y disponibilidad consumiendo CatalogoService; promociones vigentes y 'Hoy no aplica' con OfertasService; seguimiento de 'Mi pedido' y '¿Cuánto falta?' con SeguimientoService validando número de teléfono del cliente y limitando a 5 consultas/minuto; preguntas frecuentes del mockup con datos reales del local y configuración; pase a persona y derivación ante errores de servicio/BD con aviso honesto y notificación a Caja por la campana. |
