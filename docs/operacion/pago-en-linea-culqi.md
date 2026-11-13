# Pago en línea con Culqi (tarjeta y Yape)

La carta web puede cobrar el pedido con **tarjeta** o **Yape** a través de Culqi. Viene **apagado** y en **modo simulado** (sin llamadas de red). El restaurante paga la comisión de Culqi: el cliente paga el total del pedido, sin recargo.

## Cómo funciona

1. La carta crea el pedido y pide `POST /carta/pagos/culqi/intento` (con `pedidoId` y el `seguimientoToken` que recibió al crear el pedido; con sesión de cliente basta la sesión). El servidor calcula el monto desde el pedido (total + propina); el cliente nunca lo envía.
2. Culqi Checkout entrega un token (`tkn_...` de tarjeta o de Yape). La carta lo manda a `POST /carta/pagos/culqi/cargo` con el `intentoId`.
3. Si Culqi aprueba, el pedido se cobra con el mismo flujo de Caja (cobro, comprobante, puntos) con medio TARJETA o YAPE y pasa a cocina sin voucher ni revisión. Si rechaza, no se toca el pedido y el cliente puede intentar con otro medio.
4. Culqi avisa a `POST /webhooks/culqi`. Cada evento se guarda una sola vez (bandeja por id de evento) y concilia el estado. Si la respuesta del cargo se perdió, el webhook lo termina de aprobar.

Requisito: la **caja de hoy debe estar abierta** (el cobro entra a ella). Sin caja abierta no se ofrece el cobro en línea ni se cobra al cliente.

## Variables de entorno (en el `.env` del servidor / secretos de GitHub)

| Variable | Para qué |
|---|---|
| `CULQI_SECRET_KEY` | Llave secreta (`sk_test_...` / `sk_live_...`). Solo por entorno; nunca se registra ni se devuelve. |
| `CULQI_PUBLIC_KEY` | Llave pública (`pk_test_...` / `pk_live_...`); va a la carta para Culqi Checkout. |
| `CULQI_WEBHOOK_SECRET` | Secreto con que se valida el webhook. |
| `CULQI_API_URL` | Opcional. Por defecto `https://api.culqi.com/v2`. |
| `CULQI_EMAIL_RESPALDO` | Opcional. Correo que se envía a Culqi si el cliente no puso uno. |

Modo **REAL** solo si están `CULQI_SECRET_KEY` y `CULQI_PUBLIC_KEY`; si falta una, queda en **SIMULADO**. Primero usa llaves de pruebas (`_test_`) en demo.

## Poner las llaves y activar

1. Guarda las tres variables como secretos del ambiente y reinicia la API (el servidor las lee al arrancar).
2. En el panel de Culqi, registra el webhook `https://<dominio>/webhooks/culqi` (eventos de cargos y devoluciones) y envía el secreto. El servidor acepta la firma HMAC-SHA256 del cuerpo en la cabecera `x-culqi-signature`, o el secreto compartido en la cabecera `x-webhook-secret` o en `?secreto=`. Sin `CULQI_WEBHOOK_SECRET` el webhook en modo real se rechaza.
3. En Configuración › Parámetros pon `pago_online_activo` en `si`. Con `no` (por defecto) la carta no ofrece el pago y el servidor rechaza intentos y cargos.
4. Verifica `GET /carta/pagos/culqi/config`: `activo: true`, `modo: "REAL"`, y la llave pública.

## Probar en modo simulado (sin llaves)

Con `pago_online_activo = si` y sin llaves, `modo` es `SIMULADO`:

| Token | Resultado |
|---|---|
| `tkn_simulado_ok` (tarjeta) o `ype_simulado_ok` (Yape) | Aprobado |
| `tkn_simulado_rechazo` | Rechazado: «tarjeta rechazada» |
| cualquier otro | Rechazado |

El webhook acepta cualquier evento. Las devoluciones también se simulan. Nunca salen llamadas a internet.

## Ver pagos y devolver

- **Ver**: `GET /admin/pagos-online?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&estado=&pagina=1` (ADMIN, SUPERVISOR y CAJERO). Un pago `APROBADO` con `cobroPendiente: true` es dinero cobrado por Culqi cuyo cobro no se registró en Caja: revísalo (también sale una notificación) y regístralo a mano o devuélvelo.
- **Devolver**: `POST /admin/pagos-online/:id/devolver` con `{ monto?, motivo, confirmar? }`. **Solo ADMIN**. Sin `monto` devuelve todo lo que falta; el monto es en soles. Si el pedido no está anulado hay que mandar `confirmar: true`. Queda auditado (quién, cuánto, por qué).
- La devolución en Culqi **no anula el cobro en Caja** ni el comprobante: eso sigue siendo un paso aparte de Caja.

## Seguridad

- No se guardan datos de tarjeta: solo el id del cargo, la marca y los últimos 4.
- Un intento por pedido; reintentar el cargo con el mismo `intentoId` nunca cobra dos veces.
- El webhook nunca aprueba un monto distinto al calculado por el servidor.
