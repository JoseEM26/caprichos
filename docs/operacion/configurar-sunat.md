# Configurar la facturación electrónica directa a SUNAT (SEE - Del Contribuyente)

Con esta opción, Caprichos envía boletas y facturas **directo a SUNAT**, sin proveedor intermedio. El XML se firma con el certificado digital del local y se envía por el servicio web de SUNAT (billService).

Los valores (usuario SOL, clave SOL y certificado) se guardan como secretos de GitHub y el servidor los pone en el `.env` del ambiente. Nunca van en el código, ni en el log, ni en la línea de comandos.

## Proveedor: cómo se elige

En **Comprobantes > Electrónicos SUNAT** (solo ADMIN) hay un selector de proveedor:

| Proveedor | Cuándo | Qué pasa |
|---|---|---|
| Simulado (sin SUNAT) | Por defecto | Nunca hay red. Los comprobantes quedan `EMITIDO` con `simulado = true`. |
| SUNAT directo | Con credenciales completas | Envío directo a SUNAT (esta guía). |

Si se elige **SUNAT directo** pero faltan credenciales en el servidor, los comprobantes nuevos se emiten en simulado y la pantalla lo avisa en rojo. La pantalla muestra solo «configuradas / falta configurar», nunca los valores.

## Qué pasa al cobrar

**Qué pasa al cobrar (boleta o factura electrónica)**

1. **Commit del cobro.** Cobro, pedido y número del comprobante quedan en la misma transacción.
2. **Firma local (sin red, unos milisegundos).** El XML se firma, se guardan XML y ZIP, y se calculan el hash y la cadena QR. Si la firma falla (por ejemplo, certificado inválido), el cobro **no se deshace**: el comprobante queda `PENDIENTE ENVÍO` sin hash, sale una alerta a ADMIN y el envío lo reintenta.
3. **Ticket.** Sale con la representación, el hash y el QR (o «en proceso» si aún no está firmado).
4. **Transmisión a SUNAT en segundo plano.** El cobro y el ticket **no esperan a SUNAT**. Si SUNAT no responde, queda `PENDIENTE ENVÍO` y el worker lo reintenta con el mismo ZIP, sin volver a firmar ni duplicar. Un cobro con SUNAT caído termina igual de rápido.

El mozo solo emite nota de venta (sin SUNAT), así que su flujo no tiene espera de red.

- **Factura**: se firma y luego se envía (`sendBill`) en segundo plano. SUNAT responde con su constancia (CDR). Si acepta, queda `EMITIDO SUNAT`.
- **Boleta**: se firma y queda `PENDIENTE RESUMEN` (sin red). Todos los días a las **22:30 (hora de Lima)** se arma el resumen diario (RC) con las boletas pendientes (máximo 500 líneas por resumen) y se envía. Un segundo proceso consulta el ticket cada 2 minutos (solo cuando hay tickets pendientes) hasta que SUNAT responde.
- **Sin respuesta** (red o tiempo agotado): queda `PENDIENTE ENVÍO` con el mismo número. Antes de reenviar, la API pregunta a SUNAT si ya tiene el comprobante, para no duplicarlo. El reenvío es automático cada 5 minutos.
- **Rechazo**: queda `RECHAZADO` con el código y la descripción de SUNAT. Se corrige y se usa **Reintentar** (mismo número).
- **Anulación**: nada se borra.
  - Factura: se envía una comunicación de baja (RA) con el motivo, dentro de **7 días** desde la emisión.
  - Boleta ya aceptada: se incluye como anulada en el resumen diario.
  - Boleta que aún no fue al resumen: se anula sin enviar nada, porque SUNAT nunca la recibió.
- **Guardado**: el XML firmado, el ZIP enviado y la constancia (CDR) de cada comprobante se guardan en la base de datos y se pueden descargar desde la pantalla. Se conservan años.

## Variables y secretos

| Secreto de GitHub | Qué es | Valor en beta (pruebas) |
|---|---|---|
| `SUNAT_AMBIENTE` | `beta` o `prod` | `beta` |
| `SUNAT_SOL_USUARIO` | RUC + usuario SOL secundario, pegados | `20000000001MODDATOS` |
| `SUNAT_SOL_CLAVE` | Clave SOL | `moddatos` |
| `SUNAT_CERT_P12_B64` | Certificado digital (.p12) en base64 | Certificado de prueba generado para la prueba |
| `SUNAT_CERT_CLAVE` | Clave del .p12 | — |

En beta el XML sale con el RUC de pruebas `20000000001`, no con el RUC del local. En producción sale con el RUC del local (`local_datos.ruc`).

Los datos del emisor (razón social, nombre comercial, domicilio fiscal y ubigeo) salen de **Configuración > Empresa** (`local_datos`). Nada está fijo en el código. El ubigeo del local es **150132** y debe quedar cargado antes de emitir: si falta, la emisión se rechaza con el motivo «Falta el ubigeo del local».

## Pasos del dueño (en este orden)

1. **Usuario SOL secundario.** En SUNAT Operaciones en Línea (SOL), crear un usuario secundario con su clave. Ese usuario y su clave son los valores de `SUNAT_SOL_USUARIO` (RUC + usuario, pegados) y `SUNAT_SOL_CLAVE`.
2. **Correo del emisor en SOL.** Registrar el correo del local en SOL. SUNAT lo usa para avisos del servicio de comprobantes electrónicos.
3. **Certificado digital.** Obtener el certificado de firma digital (.p12) de una entidad certificadora y guardar la clave que le puso. **Vence el 07/10/2027: renovarlo antes de esa fecha**, o las facturas y boletas dejarán de firmarse.
4. **Ubigeo y datos fiscales.** En Configuración > Empresa: RUC, razón social, dirección fiscal y ubigeo **150132**.
5. **Guardar los secretos en GitHub.** `gh` los pide sin mostrarlos: pegue el valor y pulse Enter.

   ```bash
   gh secret set SUNAT_AMBIENTE --repo JoseEM26/caprichos
   gh secret set SUNAT_SOL_USUARIO --repo JoseEM26/caprichos
   gh secret set SUNAT_SOL_CLAVE --repo JoseEM26/caprichos
   gh secret set SUNAT_CERT_CLAVE --repo JoseEM26/caprichos
   base64 -w0 /ruta/al/certificado.p12 | gh secret set SUNAT_CERT_P12_B64 --repo JoseEM26/caprichos
   ```

   El certificado se pasa en base64 de una sola línea. No deje copias del .p12 en el escritorio ni en carpetas compartidas: bórrelas después.

6. **Probar en la demo con beta.** En la demo, `SUNAT_AMBIENTE` vale `beta`. Con el usuario y clave de prueba, la factura, la boleta y la baja se envían a SUNAT de pruebas: no tienen validez tributaria.

   ```bash
   gh workflow run deploy.yml --repo JoseEM26/caprichos --ref preprod \
     -f ambiente=demo -f accion=configurar-sunat
   ```

   El resumen del job debe decir `SUNAT_AMBIENTE: beta`, las cuatro variables configuradas y `OK`.

7. **Producción.** Solo cuando la demo esté probada, con el tag integrado en `main`. Antes, cambie `SUNAT_AMBIENTE` a `prod` y guarde las credenciales de producción (usuario SOL y certificado reales). El job pide escribir `PRODUCCION`.

   ```bash
   gh workflow run deploy.yml --repo JoseEM26/caprichos --ref main \
     -f ambiente=prod -f tag=vX.Y.Z -f accion=configurar-sunat -f confirmacion=PRODUCCION
   ```

8. **Elegir el proveedor.** En Comprobantes > Electrónicos SUNAT, elegir **SUNAT directo** y confirmar con Sí. Si la pantalla dice «faltan credenciales», revisar el paso 6 o 7.

## Qué muestra el log (nunca valores)

```
== Facturación electrónica SUNAT directo (demo) ==
SUNAT_AMBIENTE: beta
SUNAT_SOL_USUARIO: configurado (N caracteres)
SUNAT_SOL_CLAVE: configurada (N caracteres)
SUNAT_CERT_P12_B64: configurado (N caracteres)
SUNAT_CERT_CLAVE: configurada (N caracteres)
TAG=vX.Y.Z (no cambia)
...
OK: SUNAT directo configurado en demo (TAG vX.Y.Z, ambiente beta). ...
```

## Si falla

- `Faltan los secretos: ...`: guardarlos con `gh secret set` y volver a correr.
- `SUNAT_SOL_USUARIO debe ser el RUC (11 dígitos) seguido del usuario SOL`: revisar que se pegó completo y sin espacios.
- `SUNAT_CERT_P12_B64 no es un base64 válido`: volver a generar el base64 con `base64 -w0`.
- `Se restauró ...`: el `.env` volvió a su estado anterior y la API se redespliega con la configuración previa. Revisar el log del job.
- En la pantalla, aviso «Credenciales SUNAT inválidas» (HTTP 401 de SUNAT, o los códigos 0102 y 0109 que aún no se han visto en beta): el usuario o la clave SOL no son correctos, o el usuario no tiene permiso de facturación. Los envíos quedan en pausa (los comprobantes siguen pendientes, no se pierden) hasta corregir las credenciales.
- Un comprobante que SUNAT rechazó con un código 2xxx o 3xxx (por ejemplo, `3279`: el total no cuadra con el detalle) va a REVISION_MANUAL. Nunca se reenvía igual.
- La consulta de si SUNAT ya tiene el comprobante (`getStatusCdr`) responde «Internal Error» en beta incluso para facturas aceptadas. Por eso un fault de esa consulta **no** se toma como «no existe»: el envío se queda pendiente y no se reenvía (así no se duplica).
- Un resumen que no avanza: revisar que el ticket aparezca como `ENVIADO`; la tarea lo consulta cada 2 minutos.

## Que no se pierda nada

Ningún comprobante se pierde, se duplica ni deja un hueco de numeración, aunque se caiga la API, SUNAT o la red. Así funciona:

```
cobro (transacción)                       ── si falla, se deshace TODO (cobro, pedido, número)
 ├─ pedido PAGADO                         ┐
 └─ comprobante PENDIENTE_ENVIO + número  ┘ mismo commit = el outbox
          │
          ▼  (commit)
envío inmediato ──┐                       ── lease en la fila: solo uno envía a la vez
worker (cada 5 min)┘
          │
          ├─ XML y ZIP firmados se guardan ANTES de enviar
          ├─ factura: primero getStatusCdr; si SUNAT ya la tiene, se guarda su CDR y no se reenvía
          ├─ mismo ZIP en cada reintento
          ▼
        SUNAT ── acepta ──► EMITIDO_SUNAT (CDR guardado)
          ├─ sin respuesta (red, timeout, 5xx) ──► PENDIENTE_ENVIO, próximo intento con espera:
          │                                         1, 2, 5, 10, 30, 60 min y luego cada 2 h (±10 %)
          ├─ rechazo 2xxx/3xxx (datos o XML) ──► REVISION_MANUAL (cola de fallos)
          ├─ rechazo de datos locales ──────────► RECHAZADO (corregir y reintentar)
          └─ credenciales rechazadas (HTTP 401; 0102/0109) ─► pausa de envíos y aviso a ADMIN
```

**Qué pasa en cada fallo**

- **La API se cae antes del commit del cobro:** no queda nada (ni comprobante ni número). El cajero cobra de nuevo.
- **La API se cae después del commit:** la fila `PENDIENTE_ENVIO` ya existe. El worker la envía en la siguiente pasada.
- **Se cae la red o SUNAT no responde:** queda `PENDIENTE_ENVIO` con el mismo número. Después de 5 fallos seguidos de SUNAT, el circuito pausa los envíos 5 minutos y avisa una sola vez. Al pasar la pausa, un solo intento de prueba decide.
- **Dos procesos a la vez:** el candado Redis del worker y el lease de cada fila evitan el doble envío.
- **Un rechazo de datos:** queda `RECHAZADO`. Se corrige el documento o la razón social y se reintenta con el mismo número.

**Qué significa REVISION_MANUAL y qué hacer**

Es la cola de fallos (dead letter). Llega un comprobante ahí cuando:

- SUNAT lo rechaza con un código de validación 2xxx o 3xxx (el reintento no lo arregla), o
- no hay respuesta después de 12 intentos (`facturacion_max_intentos`).

Nada se borra: el motivo queda en `revision_motivo`, con el XML, el ZIP y la respuesta de SUNAT. En **Comprobantes › Electrónicos SUNAT**, el panel «Con problemas» lo muestra. Hay que leer el motivo:

- Si es un dato (RUC, dirección, razón social): **Corregir y reintentar**, con el mismo número.
- Si es una caída de SUNAT que ya pasó: **Reintentar** (una sola vez; si vuelve a fallar, sigue en revisión).
- Nunca se emite a mano en el facturador externo un comprobante en revisión: podría duplicarse.

**Alertas a ADMIN** (una por problema, sin repetir): comprobante pendiente más de 15 minutos, rechazo o revisión manual, circuito en pausa, credenciales inválidas, boleta sin reportar más de 3 días, resumen o baja sin respuesta más de 1 día, certificado que vence en 60, 30 o 7 días, y hueco de numeración en B002 o F002.

**Representación impresa (PDF)**

`GET /admin/comprobantes/:id/pdf` (permiso comprobantes/ver) genera el PDF al vuelo desde lo guardado; no se guarda en base. Se audita cada lectura (`VER_PDF_ELECTRONICO`). Está en Electrónicos SUNAT y en la nota del pedido («Ver PDF»).

- Formato: A4 para factura y boleta (decisión: más simple que el ticket de 80 mm; el ticket térmico lleva la misma información resumida).
- Contenido: razón social, nombre comercial y RUC del local; dirección fiscal; tipo y número; fecha y hora; cliente; detalle; op. gravada, IGV con su porcentaje real, descuento, total y total en letras; hash; cadena QR; leyenda de la representación impresa.
- Situación: con el XML firmado (PENDIENTE ENVÍO, PENDIENTE RESUMEN, ENVIADA RESUMEN o EMITIDO SUNAT) lleva hash y QR. Sin firmar: «en proceso». RECHAZADO o REVISION_MANUAL: aviso **PENDIENTE DE REGULARIZAR** y sin hash válido.
- Marca **DOCUMENTO DE PRUEBA — SIN VALOR TRIBUTARIO** (franja y marca de agua) cuando el comprobante es simulado o el ambiente es beta. En producción con comprobante real no aparece.
- DNI o RUC completos solo para ADMIN; para los demás roles, enmascarados (`20****03`).

**Ticket y QR**

- El ticket de la ticketera ya lleva hash, situación y la cadena QR (en el trabajo de impresión, campo `comprobante.cadenaQr`).
- **El QR no se imprime todavía.** El agente de impresión (`agente-impresion-*.exe`) lleva el maquetado dentro del ejecutable: hoy solo imprime texto. Para imprimir el QR sin cambiar nada del API: en `apps/agente-local/src/escpos/generadorTicket.ts` agregar el comando nativo ESC/POS `GS ( k` (modelo 2, tamaño, corrección M, almacenar y imprimir) cuando el trabajo traiga `comprobante.cadenaQr`, y en `packages/compartido/src/etiquetas/ticketPago.ts` reservar la línea del QR. Requiere reconstruir y **redistribuir el .exe** (workflow `agente-windows.yml`); hasta entonces el ticket sale con texto (representación, hash o aviso).
- La reimpresión del ticket es «Imprimir en ticketera (80 mm)» en la nota del pedido.

**Monitoreo:** `GET /admin/comprobantes/salud` (solo ADMIN) devuelve solo conteos: pendientes, con problemas, edad del pendiente más viejo, boletas por reportar, días para el vencimiento del certificado, circuito abierto y credenciales inválidas.

**Regla de la fecha de corte (no se emiten pedidos viejos).** Al pasar el selector a SUNAT por primera vez, se fija el parámetro `facturacion_desde` con la fecha y hora de ese momento (con Sí/No y auditoría). Desde ese momento:

- El barrido de recuperación (pedidos cobrados como boleta o factura que no tienen comprobante) solo considera cobros posteriores a `facturacion_desde` y de las últimas 48 horas.
- Sin `facturacion_desde`, el barrido no hace nada. Los cientos de pedidos históricos nunca salen a SUNAT de golpe.
- En modo SIMULADO, el barrido solo registra lo que encontraría y nunca crea filas.
- Cada comprobante que el barrido crea queda en auditoría (`BARRIDO_CREAR_COMPROBANTE`).

## Verificado y pendiente

**Verificado contra el servicio BETA de SUNAT** (script `apps/api/scripts/sunat-beta-prueba.ts`, con el RUC 20000000001):

- Factura firmada (RSA-SHA256) y enviada por `sendBill`: respuesta `0`, «La Factura numero F002-…, ha sido aceptada».
- Comunicación de baja (RA) de esa factura: `getStatus` 0, «…ha sido aceptada».
- Resumen diario (RC) con una boleta: `getStatus` 0, «…ha sido aceptado», sin observaciones.
- La firma se verifica con el mismo certificado (SHA-256 aceptado por beta, no hizo falta SHA-1).

**Códigos observados en beta** (script `apps/api/scripts/sunat-codigos-beta.ts`, 2026-11-02, certificado de prueba autofirmado):

| Caso | Servicio | Lo que respondió SUNAT beta | Cómo lo trata el código |
|---|---|---|---|
| (a) Clave SOL incorrecta (`MODDATOS` con otra clave) | billService | **Aceptó** la factura (CDR `0`). No devuelve 0102 ni 0109 | Sin código que clasificar. No se confirmó la clave en beta |
| (b) Usuario inexistente (`20000000001NOEXISTE`) | billService | **Aceptó** la factura (CDR `0`) con documento nuevo | Sin código que clasificar |
| (c) Reenviar la misma factura (mismo ZIP) | billService | Vuelve a responder **aceptada** (CDR `0`, mismo número) | Sin 1033 en beta: no se implementó «ya registrada» |
| (c) Mismo número con otro contenido | billService | **Aceptada** (CDR `0`) | Sin 1033 en beta |
| (d) `getStatusCdr` de factura aceptada | billConsultService | «Internal Error» (fault Client, sin código) | No se toma como «no existe»: queda pendiente, no se reenvía |
| (d) `getStatusCdr` de factura inexistente | billConsultService | «Internal Error» (fault Client) | Igual que arriba |
| (d) `getStatusCdr` con clave incorrecta | billConsultService | «Internal Error» (fault Client) | Igual que arriba |
| (e) Total que no cuadra (TaxInclusiveAmount y PayableAmount +100) | billService | **`3279`**: «La sumatoria del Total… no concuerda con la base imponible» | Rechazo permanente: REVISION_MANUAL |
| Credenciales de pruebas (`MODDATOS`) contra **producción** (`getStatusCdr`) | consulta producción | HTTP **401** «Authentication Failed» (texto, no SOAP) | Credenciales: pausa de envíos |
| Consulta beta en `ol-it-wsconscpegem-beta/billConsultService` | — | **404** | Se cambió a `ol-ti-itcpfegem-beta/billConsultService` (responde SOAP) |

**Conclusiones:** en beta, las credenciales no son una prueba fiable (la clave incorrecta se acepta) y el 1033 no aparece. Por eso 0102, 0109 y 1033 quedan **sin confirmar**: no se marcan como reales en el código. La única fuente firme de rechazo de datos es el 3279. Antes de producción hay que confirmar credenciales y duplicados con el certificado y el RUC reales, y la consulta `getStatusCdr` no es utilizable en beta hoy.

**Pendiente de confirmar:**

- Consulta de CDR por `getStatusCdr`: en beta responde «Internal Error» a todo (ver tabla). Hasta que funcione, la consulta previa al reenvío no puede confirmar que SUNAT ya tiene una factura.
- Cadena QR de las boletas sin documento: se usa `0|-`. Confirmar el código de tipo de documento con SUNAT.
- Rango 4000–4999 (aceptada con observaciones): se trata como aceptada; confirmarlo con el contador y con un caso real.
- Rechazos en producción con el certificado real y el RUC del local: no se probaron.
- Notas de crédito y débito: fuera de alcance (no implementadas).
- Impuesto al consumo (IPM): hoy se usa una sola categoría IGV con el porcentaje del local. Confirmar con el contador si el IPM va separado.
