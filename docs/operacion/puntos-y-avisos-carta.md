# Puntos y avisos de la carta

Cómo se suman los puntos de la carta, cómo entra el cliente a «Ver mis puntos» y qué avisos de WhatsApp
se agregaron. Plantillas de Meta pendientes al final: **no activar en producción sin aprobarlas**.

## Flujo para el cliente

1. **Pedir sin cuenta.** Con el interruptor de invitado apagado, el checkout pide nombre y celular (obligatorios).
   No hay login ni contraseña. El celular suma puntos en su party (`PartyPuntosService`).
   Con el interruptor encendido, quien elige «Seguir como invitado» no suma puntos; si escribe su celular, sí.
2. **Ver mis puntos.** El botón del checkout (y el enlace del aviso) abre el acceso (`CuentaProvider`, `?puntos=1`).
   Es solo para consultar: nunca es requisito para pedir.
3. **Crear cuenta / ver puntos.** El acceso «Crear cuenta» tiene tres pasos:
   - Paso 1, celular: `POST /carta/cuenta/registro/codigo` envía un código de 6 dígitos por WhatsApp.
   - Paso 2, código: `POST /carta/cuenta/registro/verificar` lo valida y deja el celular verificado 10 min (Redis).
   - Paso 3, datos: `POST /carta/cuenta/registro` exige esa verificación, crea la contraseña y enlaza la cuenta
     al party del celular (con sus pedidos y puntos). Luego avisa por WhatsApp (ver abajo).
4. **Ingresar / recuperar contraseña.** Sin cambios: `ingresar`, `recuperar/solicitar`, `recuperar/confirmar`.

### Reglas del código (reutilizadas de recuperar contraseña)

- Vence a los 10 minutos (`REGISTRO_TTL_SEG`, `RECUPERAR_TTL_SEG`).
- Máximo 5 intentos por código (`REGISTRO_MAX_INTENTOS`, `RECUPERAR_MAX_INTENTOS`).
- Reenvíos: 3 por celular por hora y 20 por IP por hora.
- El código solo vive en Redis como HMAC; nunca en claro en base ni en auditoría.
- Respuestas que no revelan si el celular tiene cuenta: al pedir código para un celular con cuenta no se envía nada
  y se responde igual; la confirmación solo dice «código incorrecto» o «celular ya tiene cuenta» después de validar el código.

## Avisos de WhatsApp nuevos

Todos se encolan en el outbox (`OutboxWhatsappService`) y pasan por `Ventana24hService`: si la ventana de 24 h
está abierta sale texto libre; si no, la plantilla aprobada. Respetan la baja (BAJA) y el contador de costos existentes.
Un fallo de envío no rompe el pedido ni la cuenta (best effort).

| Aviso | Cuándo | Dónde se decide | Parámetro | Plantilla (si la ventana está cerrada) |
|---|---|---|---|---|
| Bienvenida a los puntos | Primer pedido de un celular de la carta con cliente | `AvisosPedidoService` (RECIBIDO) | `whatsapp_aviso_bienvenida_puntos_activo` | `CARTA_RECIBIDO_BIENVENIDA_PUNTOS` (efectivo). Digital: la línea solo viaja en texto libre |
| Puntos ganados | Entrega de un pedido que ya tiene `puntos_ganados > 0` | `AvisosPedidoService` (ENTREGADO) | `whatsapp_aviso_puntos_ganados_activo` | `DELIVERY_ENTREGADO_PUNTOS` |
| Seguridad de la cuenta | Se crea la cuenta o cambia la contraseña | `AvisoCuentaService` | `whatsapp_aviso_cuenta_activo` | `CUENTA_AVISO_SEGURIDAD` |

- La bienvenida va **dentro del aviso RECIBIDO** (un solo mensaje). Se marca una vez por celular en la tabla
  `aviso_cliente_unico` (migración `20261208100000_aviso_cliente_unico`), dentro de la misma transacción del pedido.
- El aviso de puntos va **dentro del aviso ENTREGADO** (un solo mensaje).
- El aviso de seguridad es un mensaje extra por evento (crear cuenta, cambiar contraseña). La creación se envía una vez
  por cuenta; cada cambio de contraseña envía otro.

### Valor por defecto de los parámetros

- Si el parámetro no existe, vale **«si» solo con envío simulado** (sin `WHATSAPP_TOKEN` y `WHATSAPP_PHONE_ID`).
- Con Meta conectado, sin parámetro = **apagado**. Activar en «Sí» en Configuración > Avisos cuando la plantilla esté aprobada.

## Plantillas de Meta que hay que registrar y aprobar

Todas en categoría **UTILITY** (la de autenticación no aplica: el aviso de seguridad no lleva código), idioma `es`.

1. **caprichos_pedido_recibido_bienvenida_puntos** (variables: `{{1}}` nombre, `{{2}}` código de pedido, `{{3}}` enlace de puntos)
   Texto: `¡Hola {{1}}! 😊 Recibimos tu pedido {{2}}, ¡gracias por tu compra! Ya está en proceso. 🙏 Ya sumas puntos con este número: ve tus puntos aquí {{3}}`
   Reemplaza a `caprichos_pedido_recibido_efectivo` solo en el primer pedido de cada celular.
   Aprobar antes de activar `whatsapp_aviso_bienvenida_puntos_activo`.
2. **caprichos_delivery_entregado_puntos** (variables: `{{1}}` nombre, `{{2}}` código, `{{3}}` puntos ganados, `{{4}}` puntos total)
   Texto: `¡Hola {{1}}! 🎉 Tu pedido {{2}} fue entregado. Ganaste {{3}} puntos. Total: {{4}} puntos. ¡Gracias por preferir Caprichos! 💛`
   Aprobar antes de activar `whatsapp_aviso_puntos_ganados_activo`.
3. **caprichos_cuenta_aviso_seguridad** (variable: `{{1}}`, con «fue creada» o «cambió tu contraseña»)
   Texto: `Hola. Tu cuenta de Caprichos {{1}}. Si no fuiste tú, escríbenos por WhatsApp de inmediato.`
   Aprobar antes de activar `whatsapp_aviso_cuenta_activo`.

Las tres están en `apps/api/src/modulos/chatbot/catalogo/plantillas.catalogo.ts` (claves `CARTA_RECIBIDO_BIENVENIDA_PUNTOS`,
`DELIVERY_ENTREGADO_PUNTOS`, `CUENTA_AVISO_SEGURIDAD`). El nombre de la plantilla en el catálogo debe coincidir con el de Meta.

El código de verificación usa la plantilla ya existente `caprichos_codigo_cuenta` (AUTHENTICATION), que debe estar aprobada.

## Riesgos y límites conocidos

- **Puntos después de la entrega.** Los puntos se suman al cobrar (`acumularPorPedido`). Si el cobro se registra después de
  «entregado», ese aviso sale sin la línea de puntos.
- **Pedido digital fuera de la ventana de 24 h.** La plantilla de Yape/Plin/transferencia no tiene la variable del enlace:
  la línea de bienvenida no sale en ese caso, y la marca ya queda puesta. Hace falta una plantilla digital con enlace si se quiere cubrir.
- **Carrera en el primer pedido.** Dos pedidos simultáneos del mismo celular marcan la bienvenida una sola vez
  (inserción con `skipDuplicates` dentro de la transacción).
- **Enlace de la carta.** Sale de `CARTA_URL_PUBLICA` (o `https://DOMINIO_BASE`). Sin origen configurado no hay bienvenida.

## Dónde mirar

- API: `apps/api/src/modulos/clientes/` (`codigo-registro.service.ts`, `recuperar-clave.service.ts`,
  `aviso-cuenta.service.ts`, `clientes.service.ts` > `registro`), `apps/api/src/modulos/chatbot/servicios/avisos-pedido.service.ts`.
- Web: `apps/web/src/carta/cuenta/FormularioAcceso.tsx`, `CuentaContext.tsx`, `apps/web/src/carta/FormularioCheckout.tsx`.
- Pruebas: `codigo-registro.service.spec.ts`, `aviso-cuenta.service.spec.ts`, `avisos-pedido.service.spec.ts`,
  `PanelCuenta.spec.tsx`, `checkout-invitado.spec.tsx`.
