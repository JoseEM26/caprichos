---
id: RB-CAP-009
tipo: runbook
titulo: "Runbook: activación y operación de la lectura de vouchers Yape y Plin con IA"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-27
relacionados: [RB-CAP-007, COS-CAP-001, SEC-CAP-001, PCN-CAP-001]
tags: [runbook, vouchers, yape, plin, ia, openai, caja, mensajes, salon]
---

# RB-CAP-009 — Activación y operación de la lectura de vouchers Yape y Plin con IA

| Campo | Valor |
|---|---|
| Cuándo usarlo | Para habilitar la lectura automática de comprobantes de pago digital en la VPS, configurar los datos oficiales del negocio, resolver comprobantes observados en Mensajes y verificar el cierre de caja |
| Tiempo esperado | Configuración inicial en VPS: menos de 5 minutos · Verificación en Mensajes o Caja: 10 a 30 segundos por comprobante |
| Quién lo ejecuta | Rol `ADMIN` (administrador) y personal de `CAJERO` y `MOZO` |
| Riesgo | Bajo: la IA no realiza cobros ni aprueba transacciones; toda decisión es estrictamente humana |
| Módulos afectados | `apps/api/src/modulos/vouchers/`, `apps/web/src/admin/vouchers/`, `apps/web/src/admin/mensajes/`, `apps/web/src/admin/caja/`, `apps/web/src/admin/salon/` |

---

## 1. Regla de oro y principios del sistema

> [!IMPORTANT]
> **LA IA NUNCA APRUEBA NI RECHAZA UN PAGO.**
> El modelo de visión artificial únicamente lee la imagen enviada, extrae los datos visibles (monto, fecha, hora, titular, número de destino y código de operación) y calcula un semáforo de confianza. La decisión de aprobar el pago, liberar la comanda a cocina o rechazar el comprobante es **exclusivamente humana**, realizada por personal de Caja o Administración.

### Principios de seguridad y privacidad:
1. **Sin datos personales a la IA:** A OpenAI solo se envía la imagen en base64. Nunca se envía el nombre del cliente, número de teléfono del cliente ni detalles del pedido.
2. **Modelo de visión:** Utiliza la variable de entorno `OPENAI_VISION_MODEL` (por defecto `gpt-4o-mini`). Comparte la misma `OPENAI_API_KEY` general del sistema.
3. **Sin tope de presupuesto:** A diferencia del chatbot de atención, la lectura de vouchers **no tiene tope mensual de gasto en dólares** para evitar que una cafetería llena se quede sin lectura en un día de alta venta. Cada consulta se audita en la tabla `ia_consumo` con `origen: 'VOUCHER'`.
4. **Detección de fraude y duplicados:**
   - Calcula el hash SHA-256 de la imagen para detectar capturas recicladas.
   - Indexa el número de operación para detectar comprobantes ya utilizados en pedidos anteriores.
5. **Aislamiento por rol:**
   - **Mozo (`vouchers/subir`):** Solo sube la fotografía en mesa. La interfaz solo le informa si la foto es `legible` o `ilegible` para que pida otra captura al cliente si salió borrosa. El mozo **nunca ve** el semáforo de confianza, los montos extraídos ni las notas internas.
   - **Cajero y Administrador (`vouchers/ver`):** Acceso completo a la tarjeta de lectura, semáforo, motivos de observación y botones de aprobación/rechazo.

---

## 2. Inyección segura de credenciales en el VPS

La clave `OPENAI_API_KEY` debe configurarse en el servidor sin registrarse en el historial de comandos de Bash ni versionarse en Git.

### Procedimiento seguro por SSH:
1. Conectar al VPS:
   ```bash
   ssh -i ~/.ssh/id_ed25519_caprichos_vps deploy@207.244.232.127
   ```
2. Modificar el archivo `.env` del ambiente correspondiente (`demo`, `staging` o `prod`) de forma interactiva con `nano`:
   ```bash
   cd /opt/caprichos/<ambiente>
   nano .env
   ```
3. Añadir o actualizar las siguientes variables:
   ```env
   # Clave de OpenAI para visión y asistentes (sin comillas)
   OPENAI_API_KEY=sk-proj-tu-clave-real-aqui
   OPENAI_VISION_MODEL=gpt-4o-mini
   ```
4. Guardar (`Ctrl+O`, `Enter`) y salir (`Ctrl+X`).
5. Asegurar permisos estrictos del archivo para que nadie más pueda leerlo:
   ```bash
   chmod 600 .env
   ```
6. Reiniciar el contenedor de la API con despliegue sin corte para cargar la nueva variable:
   ```bash
   cd /opt/caprichos/scripts
   ./desplegar.sh <ambiente> $(grep -E "^TAG=" /opt/caprichos/<ambiente>/.env | cut -d= -f2)
   ```

---

## 3. Configuración de parámetros oficiales del negocio

Los parámetros oficiales del local se administran desde el panel web en:
**Panel Administrativo → Configuración del local → Parámetros del sistema** (`/admin/mirest?tab=parametros`).

| Parámetro | Tipo | Valor Oficial | Descripción operativa |
|---|:---:|:---:|---|
| `voucher_ia_activo` | Sí/No | `true` | Habilita el análisis por visión artificial. Si está en `false`, los vouchers se guardan y quedan en estado `SIN_LECTURA` para revisión manual. |
| `voucher_titular_nombre` | Texto | `Maria Jose Morillo Ruiz` | Nombre del titular de las cuentas Yape y Plin registrado por el dueño. |
| `voucher_yape_numero` | Texto | `977503006` | Número telefónico oficial de la billetera Yape. |
| `voucher_plin_numero` | Texto | `977503006` | Número telefónico oficial de la billetera Plin. |
| `voucher_mozo_obligatorio` | Sí/No | `true` | Exige obligatoriamente que el mozo adjunte foto legible del voucher antes de cerrar una mesa con pago digital. |

---

## 4. Clasificación del semáforo de confianza

La función analítica (`semaforo.util.ts`) clasifica cada comprobante en una de cinco categorías:

| Estado Semáforo | Color | Criterio técnico | Acción operativa de Caja |
|---|:---:|---|---|
| **CONFIABLE** | Verde | Coincidencia exacta de titular, número destino (últimos 9 dígitos), monto igual o superior al pedido, fecha de hoy y confianza >= 0.8. | Revisar visualmente y presionar **Aprobar el pago**. |
| **OBSERVADO** | Amarillo | Discrepancia en monto, fecha distinta al día en curso, número de destino discordante o confianza entre 0.5 y 0.8. | Comparar el monto y fecha del voucher contra el pedido antes de decidir. |
| **RARO** | Rojo | Comprobante de otra entidad, imagen repetida (mismo SHA-256 en otro pedido) o código de operación ya usado previamente. | **Alerta de posible fraude.** No aprobar sin verificar directamente en la app bancaria. |
| **ILEGIBLE** | Gris oscuro | Foto cortada, desenfocada, captura en baja resolución o sin monto legible. | Solicitar al cliente o mozo un nuevo envío del comprobante. |
| **SIN_LECTURA** | Gris | IA apagada (`voucher_ia_activo: false`), error de red con OpenAI o sin API key. | Requiere lectura visual directa por el cajero humano. |

---

## 5. Operación en los flujos del sistema

### A. Canal WhatsApp (Pedidos de Delivery y Recojo)
1. **Recepción automática:** Cuando el cliente envía una imagen durante el estado de pago, el webhook la descarga como archivo privado y la encola para análisis en segundo plano.
2. **Pase a persona automático:** Al llegar un voucher por WhatsApp, la conversación se retira del flujo automático del bot y **pasa inmediatamente a estado de atención por persona** para alertar a Caja.
3. **Visor en el chat de Mensajes (`/admin/mensajes`):**
   - La foto se visualiza como archivo privado mediante la sesión autenticada del panel.
   - Se muestra la tarjeta de lectura del voucher con su semáforo y detalles extraídos.
   - Los botones **Aprobar el pago** y **Rechazar** aparecen de forma robusta incluso si el número del cliente incluye el prefijo nacional `51`.
4. **Retención en cocina:** Un pedido con pago digital no validado **NO aparece en la pantalla de Cocina** hasta que Caja presiona *Aprobar el pago*. Una vez aprobado, se genera la comanda y el bot avisa al cliente que su orden entró a preparación.

### B. Canal Salón (Cobro en Mesa por Mozo)
1. Al momento de la precuenta y cobro con Yape o Plin en `/admin/salon`, el mozo presiona el botón para adjuntar voucher.
2. En el dispositivo del mozo, la imagen se comprime y reduce en el cliente a un máximo de 1600 px (calidad JPEG 0.85) para no consumir ancho de banda de la cafetería.
3. El sistema valida si es legible. Si es ilegible, la interfaz le solicita tomar la fotografía nuevamente. Una vez conforme, se registra el cobro.

### C. Cierre de Turno y Caja (`/admin/caja`)
1. Antes de realizar el arqueo y cierre del turno, el módulo de Caja consulta la lista de vouchers del turno.
2. Si existen comprobantes marcados como `RARO`, `OBSERVADO` o pendientes de confirmación, la pantalla muestra una advertencia informativa con la lista de pedidos afectados.
3. El cajero confirma la revisión marcando los comprobantes como revisados con un clic (`POST /admin/vouchers/:id/revisado`), quedando registrado el usuario y la hora del arqueo.

---

## 6. Monitoreo de consumo y resolución de incidentes

### Consulta de consumo en panel:
El volumen de lecturas y costo acumulado en dólares se consulta en:
**Panel Administrativo → Configuración → Tarjeta de Consumo de IA (Vouchers)**.

### Incidencias frecuentes:

| Síntoma | Causa | Solución |
|---|---|---|
| Todos los vouchers salen `SIN_LECTURA` | `voucher_ia_activo` está en `false` o falta `OPENAI_API_KEY` en el `.env` | Revisar parámetros en `/admin/mirest?tab=parametros` y validar la clave en el servidor según la Sección 2. |
| Comprobante legítimo sale `OBSERVADO` por titular | El cliente usó una versión abreviada de Yape (ej. "Maria Morillo") | El algoritmo tolera nombres parciales, pero si hay duda el cajero contrasta los últimos 4 dígitos y aprueba manualmente. |
| Notificación de campana `VOUCHER_ILEGIBLE` constante | Cámara del celular sucia o cliente envía captura en miniatura | Instruir al mozo o pedir al cliente por chat que reenvíe captura de pantalla completa. |
| Error `429 Too Many Requests` en logs de vouchers | Se superó el límite de seguridad de 10 consultas por minuto por cliente | Redis protege el servicio contra ataques; el cliente puede esperar 60 segundos o Caja realiza la verificación visual manual. |
