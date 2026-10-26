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
| 2 | C. Pedido por botones | Categoría, producto y opciones, carrito, entrega y confirmación, con las mismas reglas de la carta (ofertas, agotados, local abierto, tarifas); usa los textos y botones exactos del mockup. FT-BOT-01. | Completado |
| 2 | D. Pago por WhatsApp | Datos de pago, voucher, aprobación por Caja y seguimiento del pedido; usa los textos y botones exactos del mockup. FT-BOT-02. Depende de C. | Completado |
| 2 | E. Cambios y derivación | Cambios después del pedido y pase a una persona si el bot no entiende (una repregunta y luego deriva); usa los textos y botones exactos del mockup. FT-ATN-02. | Pendiente |
| 3 | F. Reservas | Pedir una reserva por WhatsApp con las reglas existentes; usa los textos y botones exactos del mockup. | Completado |
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
| 25/10/2026 | Ola 2 Agente C completada: Flujo conversacional interactivo completo para Hacer un pedido dentro del chat de WhatsApp (FT-BOT-01, HU-CAP-126, 127, 128, 130) idéntico al prototipo Chatbot.dc.html. Modularizado en flujos/pedido/ con registro desacoplado RegistroSubFlujos para futuras olas; modalidad Delivery / Recojo; navegación por categorías y productos reales con validación de disponibilidad y stock; selección de tamaños, grupos obligatorios y opcionales paso a paso, notas y cantidades con límites de seguridad (máx 20 unidades/línea, máx 30 líneas); evaluación de promociones y aviso «te falta poco» con OfertasService; cupón de descuento opcional; resolución de entrega por ubicación GPS compartida (mensaje location de WhatsApp con latitud, longitud, nombre y dirección en webhook) o dirección escrita con cálculo de tarifa/zonas con ZonasService; captura y validación estricta de teléfono (9 dígitos) para remitentes BSUID; medios de pago activos del local con cálculo de vuelto para efectivo y pago pendiente con instrucciones para transferencias/Yape/Plin (la IA nunca aprueba pagos); resumen final completo con botones de confirmación y cambio; creación transaccional mediante PedidosService con canal WHATSAPP (migración aditiva 20261025220000_pedido_canal_whatsapp), clave de idempotencia estable por paso de conversación, notificación por socket y campana a Caja y Cocina; comandos globales de Volver al menú, Cancelar pedido con confirmación Sí/No, Hablar con persona y expiración por inactividad de 30 minutos; verificación exhaustiva de límites de WhatsApp en textos y botones (<=20 chars botón/lista, <=24 chars fila, <=72 chars desc, máx 3 botones, máx 10 filas, <=1024 cuerpo) y 100% de suites en verde. |
| 25/10/2026 | Ola 2 Agente D completada: Flujo de Pago por WhatsApp con aprobación humana y seguimiento (FT-BOT-02, HU-CAP-130, 131, 132, 139, 030 y mockup Chatbot.dc.html). Resumen de datos de pago con monto exacto y datos activos del local (Yape, Plin, Transferencia BCP con titular, cuenta, CCI y QR vía nuevo método enviarImagen en WhatsAppMensajeriaPuerto); recepción de captura privada enlazada al pedido y conversación con estado VALIDAR_PAGO, recordatorio cordial si escribe texto, y protección de máx 5 capturas por pedido antes de pasar a persona; aprobación por Caja en MensajesService (exige permiso mensajes/enviar, audita quién y cuándo, pasa pedido a cocina con pasa_cocina_en y evento cocina:comanda-actualizada, envía mensaje de preparación al cliente y cierra VALIDAR_PAGO); rechazo con motivo y botones para reenviar captura o cambiar medio, con escalado urgente a persona tras 3 intentos (la IA NUNCA marca pagado por su cuenta); confirmaciones para efectivo y tarjeta POS sin captura; tarea desacoplada TareaRecordatorioPagoService con recordatorio único idempotente en Redis tras N min (chatbot_pago_recordatorio_min = 10) y alerta a Caja sin anulación tras M min (chatbot_pago_expira_min = 30); seguimiento detallado por estado en 'Mi pedido' y '¿Cuánto falta?'; migración aditiva 20261026110000_chatbot_pago_whatsapp; verificación de límites de WhatsApp (37 tests) y suite completa de pago en verde (15 tests). |
| 26/10/2026 | Ola 3 Agente F completada: Flujo conversacional interactivo completo para Reservar mesa por WhatsApp (HU-CAP-134, FT-SAL-03, HU-CAP-065..067) modularizado en flujos/reserva/ y registrado en RegistroSubFlujos. Selección interactiva de personas (1-2, 3-4, 5-6, numérico libre hasta capacidad máxima, con derivación a persona para grupos >10), fecha (Hoy, Mañana, otra fecha escrita con validación contra días cerrados, feriados de LocalService y límite de anticipación de 30 días, sin permitir fechas pasadas), hora (lista interactiva de franjas de 30 min según horario de atención y mesas reales disponibles reutilizando ReservasService), nombre de contacto y validación estricta de teléfono celular de 9 dígitos para remitentes BSUID, nota opcional y resumen con botones interactivos Confirmar solicitud / Cambiar algo. Regla estricta de negocio: la IA nunca confirma reservas; el bot genera una SolicitudReserva PENDIENTE con notificación inmediata por socket y campana a Caja/Salón. Panel administrativo en ReservasView y MensajesView con acciones Aceptar solicitud (asignando mesa/s sugeridas o seleccionadas en plano) y Rechazar con motivo obligatorio (mínimo 5 caracteres) y alternativas horarias, ambas con confirmación obligatoria Sí/No y auditoría. Notificación automática por WhatsApp al cliente tanto de confirmación como de rechazo con plantilla aprobada. Tarea programada en segundo plano RecordatorioReservasTarea (cada 30s) para recordatorio opcional 2h antes (parámetro chatbot_reserva_recordatorio) y aviso de tolerancia vencida (NO_ASISTIO). Subflujo completo de cancelación y cambio de reservas activas («cancelar reserva», «cambiar reserva»). Migración Prisma aditiva 20261026100000_solicitud_reserva_detalles. Verificación estricta de límites de WhatsApp (botón lista <=20, título fila <=24, desc fila <=72, botón respuesta rápida <=20, máx 3 botones, máx 10 filas, cuerpo <=1024) y 100% de suites en verde (92/92 suites, 1183 tests en Jest y Vitest). |
