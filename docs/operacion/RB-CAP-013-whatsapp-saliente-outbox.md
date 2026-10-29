# RB-CAP-013: Mensajes salientes de WhatsApp (outbox)

## Qué es
Los mensajes automáticos que el negocio envía por WhatsApp (avisos de pedido al cliente, recordatorios de reserva y de pago, la encuesta de posventa, la alerta de espera, las alertas al equipo y el aviso de reprogramación) no se mandan directo a Meta. Se guardan en la tabla `saliente_whatsapp` (outbox) en la misma transacción que el cambio de estado que los origina, y el planificador los envía. Si Meta falla o la API se cae, el aviso no se pierde: queda pendiente y se reintenta.

## Cómo funciona
1. El emisor encola con `OutboxWhatsappService.encolar(datos, tx?)`. Con `tx`, el INSERT va en la transacción del cambio de estado. Sin `tx`, el emisor abre la suya.
2. Al confirmar la transacción, el emisor llama a `despertar()`: el lote sale en segundos, sin esperar al planificador.
3. El planificador (cada 30 s, bajo su candado de Redis) también procesa el lote, recupera huérfanos y limpia.
4. El envío decide texto libre o plantilla al momento de enviar, con la ventana de 24 h (`Ventana24hService`). Si el cliente está en BAJA, no sale.
5. Al cerrar el envío, el mensaje se copia en `mensaje_chat` y, si es un aviso de reparto, la etapa de `mensaje_reparto` pasa a ENVIADO o FALLIDO.

## Estados
| Estado | Significado |
| :--- | :--- |
| PENDIENTE | En cola. Si `proximo_intento_en` es futuro, espera el reintento. |
| ENVIANDO | Un lote lo está enviando. Si se queda así más de 5 min, se recupera (ver abajo). |
| ENVIADO | Meta lo aceptó (`wa_message_id`). Se borra a los `outbox_retencion_dias` días. |
| FALLIDO | Cola de mensajes muertos: error permanente o intentos agotados. Lo decide una persona. |
| DESCARTADO | Una persona lo dio por no enviable, con motivo y autor. Se conserva `outbox_retencion_fallidos_dias` días y luego se borra. |

## Reintentos y clasificación
- Errores permanentes (no se reintentan solos): NUMERO_INVALIDO, PLANTILLA_NO_APROBADA, PLANTILLA_NO_CONFIGURADA, CLIENTE_BAJA, DESTINATARIO_NO_VERIFICADO, FUERA_DE_VENTANA_24H, BSUID_NO_PERMITIDO, ERROR_META.
- Errores temporales: cualquier otro (límite de Meta, 5xx, red, timeout, token). Espera 30 s, 2 min, 10 min, 1 h. Al agotar `outbox_max_intentos` (5) pasa a FALLIDO con la leyenda Intentos agotados.
- Un FALLIDO no se reintenta solo. Se reenvía a mano desde Mensajes, pestaña Salientes (reinicia intentos y queda auditado).

## Orden
Los mensajes del mismo destino y pedido salen en secuencia (`secuencia`). Un mensaje no sale mientras haya uno anterior del mismo destino y pedido en PENDIENTE o ENVIANDO. Un FALLIDO o DESCARTADO no bloquea a los siguientes. Efecto: si LISTO falla temporalmente, SALIDA espera; no lo adelanta.

## Entrega: at-least-once
- La clave `clave_idempotencia` (determinista por evento, p. ej. `pedido-<id>-<ETAPA>`) evita que un mismo evento cree dos filas.
- El envío a Meta puede repetirse en un caso raro: si la API cae entre "Meta aceptó" y "marcar ENVIADO". Se acota con el token de intento (`intento_token`) y una sola actualización tras la respuesta. Al recuperar un ENVIANDO huérfano: si tiene `wa_message_id`, pasa a ENVIADO y no se reenvía; si no, vuelve a PENDIENTE contando un intento.
- WhatsApp no ofrece clave de idempotencia para mensajes salientes. Un duplicado raro es posible y se acepta: es preferible a perder el aviso.

## Parámetros (Configuración, Parámetros de operación)
| Clave | Por defecto | Uso |
| :--- | :--- | :--- |
| outbox_max_intentos | 5 | Intentos antes de FALLIDO por error temporal. |
| outbox_retencion_dias | 30 | Días que se conservan los ENVIADO. |
| outbox_retencion_fallidos_dias | 90 | Días que se conservan los DESCARTADO. |
| outbox_alerta_fallidos | si | Avisa a Caja y Admin cuando un mensaje queda FALLIDO. |
| outbox_lag_alerta_min | 5 | Minutos de retraso del PENDIENTE más viejo antes de la alerta de lag. |

Limpieza: cada corrida borra como máximo 500 filas por tipo (ENVIADO vencido y DESCARTADO vencido). Nunca borra FALLIDO ni PENDIENTE.

## Monitoreo
- `GET /admin/whatsapp/salientes/resumen` (permiso `whatsapp_salientes/ver`): pendientes, enviando, enviados, fallidos, descartados, `lagSegundos` (edad del PENDIENTE más viejo) y `lagAlerta`.
- Lag: si supera `outbox_lag_alerta_min`, se crea UNA notificación para CAJERO y una para ADMIN por episodio (Redis, con respaldo en memoria) y un aviso por WhatsApp a los administradores que pasa por el propio outbox. El episodio se reinicia cuando el lag vuelve a bajar. La pestaña Salientes muestra la franja de aviso.
- Logs estructurados (JSON en la línea del mensaje): `evento` = `outbox_whatsapp` (encolados, enviados, reintentos, fallidos y lagSegundos por corrida), `outbox_reintento`, `outbox_fallido` (con clasificación) y `outbox_lag_alerta`.

## Qué hacer con un FALLIDO
1. Abrir Mensajes, pestaña Salientes, filtro Fallidos. Leer el motivo y la clasificación.
2. Si el motivo es temporal y ya no se repite (por ejemplo, Meta volvió), pulsar Reenviar y confirmar.
3. Si el dato está mal (número o plantilla), corregir el origen del problema (el teléfono del pedido, la plantilla en Meta) y luego reenviar; o descartar con motivo.
4. Si el aviso ya no tiene sentido (el cliente recibió el mismo aviso por llamada), descartar con motivo. Nada se borra desde la UI.

## Emisores
Todo aviso que cambia el estado de un pedido, una reserva o una alerta se encola en el outbox **dentro de la misma transacción** del cambio. Si la transacción hace rollback, no queda fila. Si commitea, queda exactamente una fila. El envío a Meta nunca ocurre dentro de la transacción: solo lo hace el lote del outbox.

Migrados con transacción compartida (encolado dentro del cambio de estado):
- **Repartos**: salir (SALIDA), llegar (LLEGADA), entregar (ENTREGADO), reenviar tras reprogramar (REENVIADO, junto con `resolverFalla`) e iniciar ruta (SALIDA de cada pedido tomado, dentro de la transacción de la ruta).
- **Cocina** (comandas): pedido pasa a LISTO (LISTO).
- **Pedidos y caja** (pedidos-estado): cambio de estado (LISTO, SALIDA o ENTREGADO según el paso).
- **Pedidos** (creación desde la carta): aviso RECIBIDO al cliente, y el aviso de nuevo pedido al equipo, ambos dentro de la transacción de creación.
- **Reservas**: aprobar y rechazar solicitud (mensaje al cliente y cambio de la solicitud en la misma transacción).
- **Stock y almacén**: insumo agotado y bajo stock, dentro de la transacción de descuento cuando se pasa una (`txExterno`).
- **Reprogramación**: SI del cliente, cancelación y sin respuesta (REPROG_RECIBIDA, REPROG_CANCELADA, REPROG_SIN_RESPUESTA).
- **Encuesta posventa**: agradecimiento al cliente por su calificación (origen ENCUESTA, clave `encuesta-<id>-GRACIAS`), en la misma transacción que la calificación, la queja y el paso del chat a persona en calificación baja. El aviso de calificación baja a los administradores va por `enviarAvisoAdmin` con clave `calificacion-baja-<id>`: un mensaje por administrador con alertas activas, nunca a un grupo (la API oficial no envía a grupos).

Migrados sin transacción propia (justificado): el resto de emisores que no tienen un cambio de estado de pedido en transacción. Son recordatorios de reserva y de pago, recojo, encuesta (en su propia transacción con la encuesta), alerta de espera al cliente, alertas al equipo (`enviarAvisoAdmin`), y el aviso de agotado de un producto de carta (`agotar`, que hoy no usa transacción; el encolado va solo, en su propia escritura). En ese último caso el riesgo es que el cambio de disponibilidad se guarde y el aviso no; se acepta por ser un aviso interno y se corrige cuando el producto se vuelva a agotar.

No migrados (a propósito): las respuestas del bot dentro de una conversación en curso (responden en el momento), las confirmaciones BAJA y ALTA del webhook, y las pruebas de alertas que el equipo pide desde el panel (respuesta inmediata).

Pendiente (conocido): la creación de la reserva (`reserva.create`) ocurre antes de la transacción de aprobación; si la aprobación falla después, la reserva ya existe sin aviso. Hace falta moverla a la misma transacción.

## Diagnóstico (solo lectura)
```sql
SELECT estado, count(*) FROM saliente_whatsapp GROUP BY estado;
SELECT id, origen, estado, intentos, ultimo_error, actualizado_en
FROM saliente_whatsapp WHERE estado IN ('FALLIDO','ENVIANDO') ORDER BY id DESC LIMIT 50;
```
No modificar estas filas a mano: usar Reenviar o Descartar desde el panel.
