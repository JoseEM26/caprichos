# Cuenta de cliente por celular (sin DNI)

Contrato para los agentes de la web (carta, admin, mozo) y del bot. Migración: `20261114100000_cuenta_cliente_telefono`.

## Reglas

- La cuenta del cliente es **celular + contraseña**. Celular peruano de 9 dígitos que empieza con 9; el servidor acepta `+51`, espacios y guiones y lo guarda como 9 dígitos (`normalizarCelularPeru`).
- Los clientes **no tienen DNI** guardado: no se crea `party_identifier` DNI, ni en la cuenta ni en el pedido. El DNI/RUC solo se pide para un comprobante con documento (boleta si el cliente lo pide, factura con RUC) o para el libro de reclamaciones, y queda **solo ahí** (`pedido.comprobante_doc`, `comprobante.documento`, `reclamo.documento`). Una empresa creada en mostrador sí guarda su RUC.
- El **personal** (`user_account`) sigue entrando con DNI en `/auth/*`; no cambió.
- Datos: `customer_account.telefono` (varchar 9) con índice único parcial `uq_customer_account_telefono_activo` (`WHERE activo AND telefono IS NOT NULL`); `customer_account.clave_cambiada_en` invalida sesiones anteriores. Contraseña: argon2id en `customer_account.hash`.
- Una cuenta creada en mostrador (`hash = null`) o un party con ese celular y sin cuenta **se vincula** al registrarse (no se duplica). Una cuenta desactivada con ese celular bloquea el registro (`TELEFONO_NO_DISPONIBLE`).
- La sesión es el JWT `cp_cliente` (cookie httpOnly, 30 días) como antes, sin el campo `dni`. Deja de valer si la cuenta se desactiva o si se cambió la contraseña después de emitirla.

Errores: `{ "codigo": "...", "mensaje": "..." }` (HTTP 400 salvo que se indique).

## Endpoints de la carta (`/carta/cuenta`)

### POST `/registro`
Cuerpo: `{ nombre, telefono, contrasena, cumpleanos?, correo?, aceptaDatos: true }`.
- `nombre` mínimo 3 caracteres; `contrasena` de 8 a 128; `cumpleanos` opcional (`YYYY-MM-DD` o `DD/MM`); `aceptaDatos` debe ser exactamente `true`.
- 200: `{ cliente }` y cookie `cp_cliente`.
- Errores: `TELEFONO_INVALIDO`, `NOMBRE_REQUERIDO`, `CONTRASENA_CORTA`, `CONTRASENA_LARGA`, `CONSENTIMIENTO_REQUERIDO`, `FECHA_INVALIDA`, `CORREO_INVALIDO`, `TELEFONO_NO_DISPONIBLE`, y **409** `TELEFONO_REGISTRADO` (ya tiene cuenta con contraseña: ingresar o recuperar).
- Guarda el consentimiento (`consent`, canal CARTA) con `version_texto = "celular-v1|T:<versión términos>|P:<versión privacidad>"`.

### POST `/ingresar`
Cuerpo: `{ telefono, contrasena }`. 200: `{ cliente }` + cookie.
- Cualquier fallo (celular inexistente, mal formado, sin contraseña, clave errónea, cuenta desactivada) responde lo mismo: `CREDENCIALES_INVALIDAS` «Celular o contraseña incorrectos.»
- Bloqueo: 5 fallos en 5 minutos por celular (Redis) → `CREDENCIALES_INVALIDAS` «Has superado el límite de intentos permitidos. Intenta más tarde.» El quinto fallo se audita (`CLIENTE_INGRESO_BLOQUEADO`).
- Ya no existe «crear la contraseña al ingresar» para cuentas de mostrador: esas personas usan `/registro` (se vincula) o recuperar.

### POST `/recuperar/solicitar`
Cuerpo: `{ telefono }`. 200 **siempre** `{ "ok": true, "mensaje": "Si ese celular tiene cuenta, te enviamos un código por WhatsApp. Vence en 10 minutos." }`, tenga cuenta o no, y también si se excedió el límite.
- Celular mal formado: 400 `TELEFONO_INVALIDO`.
- Con cuenta: código de 6 dígitos guardado como HMAC en Redis (TTL 10 min), enviado por el outbox (origen `CODIGO_CUENTA`, plantilla `CODIGO_CUENTA` para fuera de la ventana de 24 h) con el texto «Tu código de Caprichos es 123456. Vence en 10 minutos. Si no lo pediste, ignora este mensaje.»
- Máximo 3 solicitudes por hora por celular (la 4.ª responde igual y no envía). Pedir un código nuevo reinicia los intentos.

### POST `/recuperar/confirmar`
Cuerpo: `{ telefono, codigo, contrasenaNueva }`. 200 `{ "ok": true }` (no inicia sesión: la web manda a ingresar).
- Máximo 5 intentos por código; al sexto el código se invalida. Código malo, vencido, usado o inexistente: siempre `CODIGO_INVALIDO` «El código no es correcto o ya venció. Pide uno nuevo.» También `CONTRASENA_CORTA` / `CONTRASENA_LARGA`.
- Cambia la contraseña, fija `clave_cambiada_en` (las sesiones anteriores dejan de valer), borra el código y levanta el bloqueo de ingreso.

### GET `/yo`, POST `/salir`
Igual que antes. `cliente` ya **no trae `dniMascara`**: `{ partyId, nombre, correo, telefono, fotoUrl, cumpleanos, puntos }`.

### PUT `/perfil`
Cuerpo: `{ nombre?, correo?, cumpleanos? }`. El celular es la identidad: si llega `telefono` distinto del de la cuenta → `TELEFONO_NO_EDITABLE`; el mismo se ignora. **Cambiar el celular queda fuera de alcance** (necesitaría verificar el celular nuevo por WhatsApp). Nunca acepta DNI ni contraseña.

### GET `/carta/legal` (público, ya existía)
```json
{ "terminos": "...", "terminosVersion": "2026-10-29",
  "privacidad": "...", "privacidadVersion": "2026-10-29",
  "textoConsentimiento": "Acepto que Caprichos guarde mi celular y mis datos para ...",
  "reclamoPlazoDiasHabiles": 15 }
```
La web debe pintar `textoConsentimiento` junto a la casilla (ya no menciona DNI) y enlazar los textos.

## Endpoints de administración

- `GET /admin/clientes/por-telefono/:telefono` (permiso `pedidos/crear` o `clientes/ver`): solo coincidencia exacta de 9 dígitos (`400 TELEFONO_INVALIDO` si no), 20 por minuto y usuario (`429 DEMASIADAS_BUSQUEDAS`). Respuesta: `{ encontrado: false }` o `{ encontrado: true, party, nombre, telefono, puntos, direcciones[] }` (sin DNI ni correo).
- `GET /admin/clientes/por-dni/:dni` → **410** `BUSQUEDA_DNI_RETIRADA`.
- `GET /admin/clientes` (`q` busca por nombre y celular; ya no por DNI ni correo): los ítems ya no traen `dni`. `GET /admin/clientes/:id`: sin `dni`/`dniMascara` (ni auditoría `CLIENTE_VER_COMPLETO`); trae `ruc` solo si es empresa (enmascarado salvo ADMIN).
- `POST /admin/clientes` (mostrador): `{ nombre, telefono, cumpleanos, correo?, aceptaDatos }` para una persona (celular obligatorio, sin DNI) o `{ nombre, ruc, ... }` para una empresa. Crea la cuenta sin contraseña con ese celular; luego la persona se registra en la carta con el mismo celular y se vincula.
- `PATCH /admin/clientes/:id` con `telefono`: cambia también el usuario de la cuenta (400 `TELEFONO_REGISTRADO` si es de otra cuenta activa).
- Pedidos: `CrearPedidoDto` (`POST /admin/pedidos`) y `AbrirPedidoMesaDto` cambian `clienteDni` por `clienteTelefono` (`^9\d{8}$`); se mantiene `clientePartyId` (gana el celular). Sin cuenta: `404 CLIENTE_NO_ENCONTRADO`. Nombre, celular y direcciones salen de la cuenta; los puntos se suman al cobrar como siempre.
- `GET /admin/configuracion/textos-legales` (permiso `configuracion/ver`): `{ terminos, privacidad: { texto, version, faltantes[] }, marcadores[] }` con lo que falta visible como «[Falta: RUC]» y la nota para el administrador.

## Términos y Política de Privacidad configurables

- Parámetros `terminos_texto`, `privacidad_texto` (editables en Configuración, `PUT /admin/configuracion/:clave`) y `terminos_version`, `privacidad_version` (fecha `YYYY-MM-DD`, Lima).
- `TextosLegalesService` los **siembra al arrancar** solo si el parámetro no existe o está vacío; nunca pisa lo del dueño. Si hay texto pero no versión, asigna la de hoy.
- Cuando el dueño cambia el texto (valor distinto), `ConfiguracionService.actualizar` sube la versión y audita `VERSION_TEXTO_LEGAL`.
- Marcadores: `{{razon_social}} {{ruc}} {{direccion_fiscal}} {{correo_contacto}} {{telefono_contacto}} {{whatsapp}} {{nombre_comercial}} {{fecha_vigencia}}`, tomados de `local_datos` (`razon_social`, `ruc`, `direccion_fiscal` o `direccion`, `correo`, `telefono`, `whatsapp`, `nombre`) y de la versión. `correo` es un campo nuevo opcional de `PUT /admin/local/datos` (el DTO lo valida).
- Faltante: en el admin queda «[Falta: RUC]» y se lista en `faltantes`; en la carta se reemplaza por un texto neutro («el que figura en nuestros comprobantes», «nuestro WhatsApp», …).
- La línea `[[ADMIN]] Texto base sugerido: revísalo con tu asesor legal antes de publicarlo.` solo se ve en el admin; la carta la quita. Al revisar el texto el dueño puede borrar esa línea.

## Dónde más se quitó «DNI» de clientes

Textos del bot sin cuenta (`textos-bot.ts`: «crea tu cuenta con tu celular»), `explicar-puntos-pedido.ts` («ingresa con tu celular»), mensaje de `GET /carta/cuenta/puntos/movimientos`, manual `ayuda-admin/manuales/clientes.md`, seed `prisma/seed-atencion-mensajes.ts` (clientes demo por celular, sin DNI), `DIRECCIONES.md`, consentimiento. **Se conservan** (legal o personal): comprobantes (`comprobantes.*`, `comprobante_doc`), reclamos, login y usuarios del personal, `mi-perfil`, y el paso del bot que pregunta el DNI para una boleta (`PEDIDO_COMPROBANTE_DNI`, opcional).

## Pruebas

`clientes.service.spec.ts`, `recuperar-clave.service.spec.ts`, `cuenta-cliente.controller.spec.ts`, `clientes-admin.controller.spec.ts`, `direcciones-cliente.service.spec.ts`, `reclamos/textos-legales.spec.ts`, más los specs de `pedidos` y `salon` ajustados a `clienteTelefono`.

## Límites y riesgos conocidos

- Registro sin verificar el celular: quien registre primero un celular que ya está en mostrador (o sin cuenta) se queda con sus puntos y direcciones; el dueño real lo recupera con el código por WhatsApp. Una verificación por código al registrar sería el cierre natural.
- El código de recuperación viaja en el texto del outbox: queda en `saliente_whatsapp.carga` y en `mensaje_chat` (el outbox registra los mensajes enviados) hasta que la limpieza del outbox lo borre. Fuera de la ventana de 24 h WhatsApp exige la plantilla `caprichos_codigo_cuenta` aprobada en Meta (categoría real AUTHENTICATION; el catálogo solo tiene UTILITY/MARKETING).
- La versión de un texto legal es la fecha: dos cambios el mismo día comparten versión.
- No se implementó (no existía) la regla «boleta obligatoria con documento sobre S/ 700»; el pedido guarda `comprobante_doc` solo si el cliente lo envía para su boleta o es RUC de factura.
