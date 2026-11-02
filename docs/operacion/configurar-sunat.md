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

- **Factura**: se firma y se envía al momento (`sendBill`). SUNAT responde con su constancia (CDR). Si acepta, queda `EMITIDO SUNAT`.
- **Boleta**: se firma y queda `PENDIENTE RESUMEN`. Todos los días a las **22:30 (hora de Lima)** se arma el resumen diario (RC) con las boletas pendientes (máximo 500 líneas por resumen) y se envía. Un segundo proceso consulta el ticket cada 10 minutos hasta que SUNAT responde.
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
- En la pantalla, un comprobante `RECHAZADO` con código `0109` (o similar): el usuario o la clave SOL no son correctos, o el usuario no tiene permiso de facturación.
- Un resumen que no avanza: revisar que el ticket aparezca como `ENVIADO`; la tarea lo consulta cada 10 minutos.

## Verificado y pendiente

**Verificado contra el servicio BETA de SUNAT** (script `apps/api/scripts/sunat-beta-prueba.ts`, con el RUC 20000000001):

- Factura firmada (RSA-SHA256) y enviada por `sendBill`: respuesta `0`, «La Factura numero F002-…, ha sido aceptada».
- Comunicación de baja (RA) de esa factura: `getStatus` 0, «…ha sido aceptada».
- Resumen diario (RC) con una boleta: `getStatus` 0, «…ha sido aceptado», sin observaciones.
- La firma se verifica con el mismo certificado (SHA-256 aceptado por beta, no hizo falta SHA-1).

**Pendiente de confirmar:**

- Consulta de CDR por `getStatusCdr` en beta: la URL de beta es la de producción con sufijo `-beta` y no se probó todavía.
- Cadena QR de las boletas sin documento: se usa `0|-`. Confirmar el código de tipo de documento con SUNAT.
- Rango 4000–4999 (aceptada con observaciones): se trata como aceptada; confirmarlo con el contador y con un caso real.
- Rechazos en producción con el certificado real y el RUC del local: no se probaron.
- Notas de crédito y débito: fuera de alcance (no implementadas).
- Impuesto al consumo (IPM): hoy se usa una sola categoría IGV con el porcentaje del local. Confirmar con el contador si el IPM va separado.
