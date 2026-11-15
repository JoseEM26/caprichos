# Pago en línea con Culqi (tarjeta y Yape)

La carta web puede cobrar el pedido con **tarjeta** o **Yape** a través de Culqi. Viene **apagado** y en **modo simulado** (sin llamadas de red). El restaurante paga la comisión de Culqi: el cliente paga el total del pedido, sin recargo.

## Cómo funciona

1. La carta crea el pedido y pide `POST /carta/pagos/culqi/intento` (con `pedidoId` y el `seguimientoToken` que recibió al crear el pedido; con sesión de cliente basta la sesión). El servidor calcula el monto desde el pedido (total + propina); el cliente nunca lo envía.
2. Culqi Checkout entrega un token (`tkn_...` de tarjeta o de Yape). La carta lo manda a `POST /carta/pagos/culqi/cargo` con el `intentoId`.
3. Si Culqi aprueba, el pedido se cobra con el mismo flujo de Caja (cobro, comprobante, puntos) con medio TARJETA o YAPE y pasa a cocina sin voucher ni revisión. Si rechaza, no se toca el pedido y el cliente puede intentar con otro medio.
4. Culqi avisa a `POST /api/webhooks/culqi` (detrás del proxy; la API la recibe como /webhooks/culqi). **Culqi no firma sus avisos**, así que el cuerpo nunca aprueba ni cambia un pago: el servidor solo lo usa para ubicar el intento y consulta el cargo a la API (`GET /v2/charges/{id}` con la llave secreta); estado, monto y moneda salen de esa respuesta. Cada evento se guarda una sola vez (bandeja por id de evento). Si la respuesta del cargo se perdió, el webhook lo termina de aprobar.
5. **3DS**: el primer `POST /carta/pagos/culqi/cargo` puede devolver `estado: "REQUIERE_3DS"` (con `datos3ds: { montoCentimos, moneda, email, publicKey }`). No es un rechazo y el intento sigue disponible. La carta autentica con Culqi3DS (`Culqi3DS.generateDevice()` da el `deviceId`; `Culqi3DS.initAuthentication(token)` entrega `parameters3DS`) y manda un segundo `/cargo` con el mismo `intentoId` y `token`, más `deviceId` y `autenticacion3ds` (los `parameters3DS`). Nunca hay dos cargos aprobados por intento. Si el cargo es `RECHAZADO`, la respuesta trae `codigo` con el código de Culqi (p. ej. `insufficient_funds`) además del mensaje en español.

Requisito: la **caja de hoy debe estar abierta** (el cobro entra a ella). Sin caja abierta no se ofrece el cobro en línea ni se cobra al cliente.

## Medio «Tarjeta / Yape en línea» y espera de pago

- En la carta es un medio más: al crear el pedido se manda `pago.metodo = 'CULQI'` (solo carta web y con `pago_online_activo = si`). El pedido nace en estado `POR_PAGAR` con pago `PENDIENTE_ONLINE`: no llega a cocina ni aparece en Caja por cobrar. Pasa a `COLA` (cocina) cuando el cargo sale APROBADO.
- Si no paga, **se anula solo** a los `pago_online_espera_min` minutos (15 por defecto, Configuración › Parámetros). Una tarea cada minuto lo hace; no anula si hay un cargo en curso o aprobado.
- Si llega un pago aprobado de un pedido ya anulado, **no se revive**: queda marcado `requiereDevolucion` y se avisa al ADMIN (notificación «Pago en línea de un pedido anulado: devolver»).
- El cliente puede pagar desde «Mi pedido» cualquier pedido suyo en `POR_PAGAR` con `/carta/pagos/culqi/intento` (con su `seguimientoToken` o su sesión).

## Variables de entorno (en el `.env` del servidor / secretos de GitHub)

| Variable | Para qué |
|---|---|
| `CULQI_SECRET_KEY` | Llave secreta (`sk_test_...` / `sk_live_...`). Solo por entorno; nunca se registra ni se devuelve. |
| `CULQI_PUBLIC_KEY` | Llave pública (`pk_test_...` / `pk_live_...`); va a la carta para Culqi Checkout. |
| `CULQI_WEBHOOK_SECRET` | Clave de origen propia del webhook (cabecera `x-webhook-secret` o `?secreto=`). |
| `CULQI_WEBHOOK_USUARIO` / `CULQI_WEBHOOK_CLAVE` | Opcionales. Basic auth del webhook, si el panel de Culqi la ofrece. |
| `CULQI_API_URL` | Opcional. Por defecto `https://api.culqi.com/v2`. |
| `CULQI_EMAIL_RESPALDO` | Opcional. Correo que se envía a Culqi si el cliente no puso uno. |

Modo **REAL** solo si están `CULQI_SECRET_KEY` y `CULQI_PUBLIC_KEY`; si falta una, queda en **SIMULADO**. Primero usa llaves de pruebas (`_test_`) en demo.

## Poner las llaves y activar

1. Guarda las tres variables como secretos del ambiente y reinicia la API (el servidor las lee al arrancar).
2. En el panel de Culqi, registra el webhook `https://<dominio>/api/webhooks/culqi?secreto=<CULQI_WEBHOOK_SECRET>` (eventos de cargos y devoluciones). Si el panel pide usuario y contraseña, define `CULQI_WEBHOOK_USUARIO` y `CULQI_WEBHOOK_CLAVE` (se acepta Basic auth). La firma HMAC en `x-culqi-signature` es opcional y **no oficial** (Culqi no firma). Sin secreto ni usuario/clave el webhook en modo real se rechaza. En modo simulado no se hacen llamadas de red.
3. En Configuración › Parámetros pon `pago_online_activo` en `si`. Con `no` (por defecto) la carta no ofrece el pago y el servidor rechaza intentos y cargos.
4. Verifica `GET /carta/pagos/culqi/config`: `activo: true`, `modo: "REAL"`, y la llave pública.

## Probar en modo simulado (sin llaves)

Con `pago_online_activo = si` y sin llaves, `modo` es `SIMULADO`:

| Token | Resultado |
|---|---|
| `tkn_simulado_ok` (tarjeta) o `ype_simulado_ok` (Yape) | Aprobado |
| `tkn_simulado_3ds` | Primer cargo: `REQUIERE_3DS`; con `autenticacion3ds` en el segundo cargo: aprobado |
| `tkn_simulado_rechazo` | Rechazado: «tarjeta rechazada» |
| cualquier otro | Rechazado |

El webhook acepta cualquier evento. Las devoluciones también se simulan. Nunca salen llamadas a internet.

## Ver pagos y devolver

- **Ver**: `GET /admin/pagos-online?desde=AAAA-MM-DD&hasta=AAAA-MM-DD&estado=&pagina=1` (ADMIN, SUPERVISOR y CAJERO). Un pago `APROBADO` con `cobroPendiente: true` es dinero cobrado por Culqi cuyo cobro no se registró en Caja: revísalo (también sale una notificación) y regístralo a mano o devuélvelo.
- **Devolver**: `POST /admin/pagos-online/:id/devolver` con `{ monto?, motivo, medio?, confirmar? }`. **Solo ADMIN**. `medio` es `CULQI` (por defecto: llama al reembolso de Culqi) o `EFECTIVO`, `YAPE`, `PLIN`, `TRANSFERENCIA` (devuelto por fuera: solo se registra, sin llamar a Culqi). En `EFECTIVO` se registra un egreso en la caja de hoy (debe estar abierta) para que el cierre cuadre. Sin `monto` devuelve todo lo que falta; el monto es en soles. Si el pedido no está anulado hay que mandar `confirmar: true`. Queda auditado (quién, cuánto, por qué).
- **Devolución total** (por Culqi o por otro medio): además anula el cobro en Caja con el flujo de «anular cobro» (sale de las ventas del cierre, devuelve puntos e insumos y da de baja la boleta o factura). **Parcial**: el cobro queda y solo se registra la devolución. Si la caja del cobro ya cerró, se usa la anulación de caja cerrada (solo ADMIN; exige la caja de hoy abierta). Si no se puede anular, la devolución igual queda hecha y la respuesta trae `avisoCobro`: anula el cobro a mano en Caja. El pedido, sin cobro, vuelve a pago pendiente.
- **Efectivo en el cierre**: el cobro en línea es TARJETA o YAPE, nunca efectivo. Devolver en efectivo registra un egreso de la caja de hoy (baja el efectivo esperado, correcto porque salió dinero del cajón); anular después el cobro digital no mueve el efectivo, así que no se resta dos veces. Lo que baja en el cierre por la anulación es la venta digital.
- **Cuenta «Pago en línea»**: la crea la migración con rol `ADMIN` (sin rol nuevo), inactiva y sin contraseña válida, así que nadie puede iniciar sesión. Se reconoce por su marca interna y no aparece en Usuarios ni en sus conteos. Figura como quien cobra los pagos en línea y como quien anula los pedidos sin pago a tiempo.
- La suma devuelta nunca supera lo cobrado. El listado trae `montoDevuelto` y `devoluciones:[{monto, medio, en}]`.
- La devolución **no anula el cobro en Caja** por sí sola cuando es parcial; la total sí (ver arriba).

## Anular un pedido pagado con Culqi: un solo camino para devolver
Anular y `/devolver` usan el mismo código (`DevolucionCulqiService`: reserva el monto, pide el reembolso, lo anota en el JSON del intento con una clave `ref`; repetir la misma `ref` nunca vuelve a llamar a Culqi). Todo queda en una sola tabla, `devolucion_pedido`, que es lo que ven «Cancelados por no recibir» y el cierre.
- **Diálogo de anular** (pedido con intento APROBADO con algo por devolver; el detalle trae `pagoCulqi.restante`): entre los medios aparece primero «Devolver por Culqi (a la tarjeta/Yape del cliente) — recomendado», ya elegido. El cajero puede elegir otro medio (efectivo, Yape, Plin, Transferencia, Tarjeta). Con otro medio **no se llama a Culqi**: se registra la devolución con ese medio y se anota en el intento como «devuelto por fuera»; en efectivo sale un egreso de la caja de hoy (abierta), una sola vez.
- **Devolver por Culqi**: se anula el pedido con el flujo normal (cobro anulado, comprobante de baja) y, ya anulado, se pide el reembolso (total, o el monto elegido si es parcial). La fila de `devolucion_pedido` lleva `medio = CULQI`, `estado` y `culqi_devolucion_id` (la pantalla muestra solo los últimos caracteres).
- **Estados**: `HECHA`; `PENDIENTE_APROBACION` (anuló alguien que no es ADMIN: el reembolso real exige ADMIN; sale aviso en la campanita al admin); `PENDIENTE` (Culqi falló la primera vez) y `FALLIDA` (falló el reintento), con aviso al admin. En los tres el pedido queda anulado igual.
- **Ejecutar o reintentar**: `POST /admin/pedidos/:id/devolucion/culqi` (solo ADMIN), botón «Aprobar y devolver por Culqi» / «Reintentar devolución por Culqi» en «Cancelados por no recibir». En un reintento tras un fallo sin respuesta se consulta primero a Culqi si ya devolvió ese monto, para no devolver dos veces. Auditado: `DEVOLUCION_AL_ANULAR`, `DEVOLUCION_CULQI_EJECUTADA`, `DEVOLUCION_CULQI_FALLIDA`.
- **`/devolver` también escribe en `devolucion_pedido`** (una fila por pedido; si ya existe no se duplica; si era una Culqi pendiente, la marca HECHA).
- **Cierre**: el efectivo no cambia con una devolución por Culqi (el dinero sale por la pasarela, no del cajón) y no se resta de los medios digitales (el cobro ya se anuló).
- **Revertir la anulación** de un pedido con devolución Culqi se bloquea (`DEVOLUCION_CULQI_REGISTRADA`): el dinero salió o está por salir. «No corresponde devolver» sigue igual para los pedidos sin devolución registrada.
- Modo simulado (sin llaves): el reembolso se simula igual.

## Seguridad

- No se guardan datos de tarjeta: solo el id del cargo, la marca y los últimos 4.
- Un intento por pedido; reintentar el cargo con el mismo `intentoId` nunca cobra dos veces.
- El webhook nunca aprueba un monto distinto al calculado por el servidor.


## Errores al cliente

Los códigos de Culqi (`insufficient_funds`, `incorrect_cvv`, `stolen_card`, `lost_card`, `fraudulent`, `issuer_decline_operation`, `issuer_not_available`, `processing_error`, `invalid_card`, `contact_issuer`, y los `CULQxxxx`, `PREVxxxx`, `DNGxxxx`) se traducen a mensajes simples en `culqi.errores.ts`, p. ej. «Tu banco no autorizó el pago, prueba con otra tarjeta», «Fondos insuficientes», «Revisa el código de seguridad». Nunca se menciona fraude ni sospecha. Culqi exige correo en el cargo: si el cliente no da uno se usa `CULQI_EMAIL_RESPALDO`.

## Probar en el ambiente de integración (llaves `_test_`)

Solo con llaves de integración; son transacciones de mentira y datos públicos de prueba de Culqi.

**Yape:** celular `900 000 001` y cualquier código de verificación de 6 dígitos.

**3DS:** usa el correo `review@culqi.com` (así Culqi revisa el flujo 3DS).

| Marca | Número | Vence | CVV | Resultado |
|---|---|---|---|---|
| Visa | 4456 5300 0000 1096 | 07/30 | 111 | Autenticación exitosa con challenge |
| Visa | 4456 5300 0000 1005 | 07/30 | 111 | Autenticación exitosa sin challenge |
| Visa | 4456 5300 0000 1070 | 07/30 | 111 | Falla por time-out |
| Visa | 4456 5300 0000 1013 | 07/30 | 111 | Falla por error de autenticación |
| Mastercard | 5200 0000 0000 1096 | 12/30 | 111 | Exitosa con challenge |
| Mastercard | 5200 0000 0000 1005 | 12/30 | 111 | Exitosa sin challenge |
| Mastercard | 5200 0000 0000 1070 | 12/30 | 111 | Falla por time-out |
| Mastercard | 5200 0000 0000 1013 | 12/30 | 111 | Falla por error de autenticación |

**Compras exitosas:**

| Marca | Número | Vence | CVV | Tipo |
|---|---|---|---|---|
| Visa | 4111 1111 1111 1111 | 09/30 | 123 | Débito |
| Visa | 4111 1111 1010 1113 | 09/30 | 123 | Crédito |
| Mastercard | 5111 1111 1111 1118 | 12/30 | 039 | Crédito |
| Amex | 3712 1212 1212 122 | 12/30 | 2841 | Crédito |
| Diners | 360012 1212 1210 | 12/30 | 964 | Crédito |

**Errores** (para probar los mensajes al cliente):

| Marca | Número | Vence | CVV | Código |
|---|---|---|---|---|
| Visa | 4111 1100 0000 0013 | 12/30 | 123 | DNGE0087 |
| Visa | 4111 1100 0000 0021 | 09/30 | 123 | CULQ0001 |
| Visa | 4111 1100 0000 0039 | 09/30 | 123 | CULQ0003 |
| Visa | 4111 1100 0000 0047 | 09/30 | 123 | PREV0009 |
| Visa | 4111 1100 0000 0054 | 09/30 | 123 | PREV0091 |
| Visa | 4111 1100 0000 0062 | 09/30 | 123 | PREV0001 |
| Visa | 4111 1100 0000 0070 | 09/30 | 123 | DNGA0323 |
| Visa | 4000 0200 0000 0000 | 10/30 | 354 | stolen_card |
| Visa | 4000 0300 0000 0009 | 08/30 | 360 | lost_card |
| Visa | 4000 0400 0000 0008 | 03/30 | 295 | insufficient_funds |
| Mastercard | 5400 0000 0000 0005 | 01/30 | 492 | contact_issuer |
| Mastercard | 5400 0200 0000 0003 | 07/30 | 203 | incorrect_cvv |
| Amex | 3700 010000 00000 | 04/30 | 2511 | issuer_not_available |
| Amex | 3700 020000 00008 | 05/30 | 1810 | issuer_decline_operation |
| Diners | 3600 000000 0008 | 09/30 | 683 | invalid_card |
| Diners | 3600 010000 0007 | 12/30 | 820 | processing_error |
| Diners | 3600 020000 0006 | 01/30 | 230 | fraudulent |

Dudas abiertas: los nombres del flujo 3DS (`action_code: REVIEW` en HTTP 200 y los campos de `authentication_3DS`) vienen de los demos oficiales de Python y Java; confírmalos con la primera prueba en integración.

## Pre-producción (demo)
- Acción `configurar-culqi` del workflow: guarda `CULQI_PUBLIC_KEY`, `CULQI_SECRET_KEY` y `CULQI_WEBHOOK_SECRET` (secretos del entorno) y redespliega. En la demo rechaza llaves `live`; además la API (`AMBIENTE_DESPLIEGUE=demo`) se niega a cobrar con `sk_live`.
- Tarjetas de prueba de Culqi (integración) y webhook: ver las secciones anteriores. Sin llaves el pago corre simulado.
