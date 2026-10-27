---
id: ADR-017
tipo: adr
titulo: "Verificación de comprobantes de pago digital (Yape y Plin) con IA y supervisión humana"
estado: draft
producto: caprichos
version: "1.0"
owner: "Technical Lead"
aprobadores: []
fecha: 2026-10-27
relacionados: [ADR-005, ADR-008, ADR-009, ADR-012, ADR-014]
tags: [adr, vouchers, yape, plin, ia, vision, seguridad, pagos]
---

# ADR-017: Verificación de comprobantes de pago digital (Yape y Plin) con IA y supervisión humana

- **Estado:** borrador (draft — la IA propone; aprueba y firma el líder técnico)
- **Relacionado con:** **ADR-005** (Datos personales y Ley 29733), **ADR-009** (WhatsApp Cloud API e IA) y **ADR-014** (Auditoría de acciones).
- **Fecha:** 2026-10-27

---

## 1. Contexto

En Caprichos, una proporción significativa de las ventas en salón, pedidos por la carta web y compras vía WhatsApp se abonan mediante billeteras digitales peruanas (Yape y Plin). La validación manual tradicional presenta riesgos operacionales severos:
1. **Fraude por comprobantes adulterados o duplicados:** Clientes que reutilizan capturas de compras pasadas o imágenes generadas artificialmente.
2. **Lentitud y fricción en salón:** Los mozos pierden minutos confirmando transacciones en la caja o interrumpiendo al personal encargado de revisar el teléfono del negocio.
3. **Pérdida de pedidos en cocina:** Si un pedido se despacha a cocina antes de validar el pago digital y la transferencia resulta inexistente, se genera merma económica irrecuperable.
4. **Riesgo de alucinación y cobros indebidos:** Delegar la aprobación o rechazo financiero completamente en modelos de inteligencia artificial podría ocasionar aprobaciones de comprobantes fraudulentos o rechazos injustificados de clientes legítimos.

Se requería un sistema automatizado de extracción de datos y evaluación de consistencia mediante visión por computadora que agilice la revisión, manteniendo en todo momento la supervisión y decisión humana como regla innegociable.

---

## 2. Opciones evaluadas

| Opción | Por qué no | Qué la haría reconsiderar |
|---|---|---|
| **Elegida:** **Extracción visual con IA (OpenAI Vision) + semáforo determinista de riesgo + supervisión y decisión humana obligatoria** | — | Integración directa con API bancaria oficial sin intermediarios a costo cero. |
| **Aprobación financiera 100% autónoma por IA** | Riesgo inaceptable de alucinación, suplantación mediante capturas editadas y falta de responsabilidad jurídica. | Precisión garantizada del 100% con seguro ante fraudes provisto por el proveedor de IA. |
| **Integración directa vía API de Yape / Plin** | No disponible para cuentas de persona natural con negocio o microempresas sin pasarelas corporativas de alta comisión porcentual. | Apertura de APIs públicas directas y económicas para microcomercios por parte de los bancos. |
| **OCR local clásico (Tesseract / EasyOCR)** | Pésima tasa de precisión ante fotos de celulares inclinadas, reflejos de pantalla, compresiones de WhatsApp y fondos variables. | Si los modelos OCR locales alcanzaran la robustez de los modelos multimodales con bajo consumo de CPU. |
| **Validación puramente manual por WhatsApp y Caja** | Lenta, propensa a descuidos en horas punta y dependiente de que el dueño revise su cuenta bancaria personal en cada pedido. | Si el volumen de transacciones fuera inferior a 5 pedidos diarios. |

---

## 3. Decisión

1. **Principio Rector: La IA Asiste, el Humano Decide:**
   - La inteligencia artificial NUNCA aprueba ni rechaza pagos.
   - Su función es exclusivamente extraer datos legibles de la imagen (monto, fecha, hora, titular, número de destino, número de operación y medio) y compararlos de forma determinista con los datos del pedido y la configuración del negocio para clasificar el comprobante en un semáforo de riesgo.
   - La acción de aprobar o rechazar la transacción financiera reside exclusivamente en un usuario humano con rol autorizado (Cajero o Administrador).

2. **Semáforo Determinista de Consistencia (`apps/api/src/modulos/vouchers/semaforo.util.ts`):**
   - **`CONFIABLE`:** El comprobante es completamente legible, el medio (Yape/Plin) coincide, el monto coincide con el total del pedido, el titular y número de destino coinciden con los del negocio, y el número de operación y hash de imagen no están repetidos.
   - **`OBSERVADO`:** Advertencias no críticas que requieren confirmación visual rápida (ej. coincidencia parcial de titular, diferencia mínima de céntimos o número de teléfono destino no impreso en el voucher).
   - **`RARO`:** Incongruencias severas (ej. fecha de otro día, monto muy distante, titular destino totalmente diferente, o número de operación detectado en otro pedido).
   - **`ILEGIBLE`:** Captura borrosa, cortada, oscura o que no corresponde a un comprobante bancario.
   - **`SIN_LECTURA`:** Servicio de IA desactivado en configuración, falla de conexión o cuota de API no disponible. El archivo se conserva íntegro y el personal realiza la validación visual directa.

3. **Flujo de Mozo en Salón (`apps/web/src/admin/salon/`):**
   - Foto obligatoria del voucher tomada por el mozo desde la aplicación web móvil antes de solicitar la precuenta o cierre.
   - Para no sobrecargar al mozo ni exponer detalles de auditoría en sala, el mozo solo recibe una confirmación simple: comprobante legible o no legible.

4. **Flujo de WhatsApp y Consola de Mensajes (`apps/web/src/admin/mensajes/`):**
   - Cuando un cliente envía una imagen por WhatsApp, el sistema la almacena como archivo privado en el servidor y crea automáticamente el registro de voucher.
   - La foto se visualiza directamente en el hilo de la conversación mediante descarga autenticada con token de sesión.
   - Al detectarse la llegada de un voucher, la conversación conmuta automáticamente a atención humana de Caja.
   - Se despliega la tarjeta de evaluación del voucher con los botones "Aprobar el pago" y "Rechazar". Los botones y la asociación con el pedido funcionan correctamente incluso cuando el teléfono del remitente incluye el prefijo nacional `51`.

5. **Protección de Cocina ante Pagos Pendientes:**
   - Un pedido registrado con método de pago digital pendiente NO se envía a la pantalla de Cocina ni se habilita para preparación hasta que el comprobante haya sido formalmente aprobado en Caja o Mensajes.

6. **Prevención Activa de Fraude:**
   - **Detección de imagen repetida:** Se almacena el hash SHA-256 del archivo de imagen (`hash_imagen`). Si un cliente intenta enviar una captura previamente utilizada, el sistema lo detecta de inmediato y marca el semáforo como `RARO`.
   - **Detección de operación duplicada:** Se indexa el campo `operacion`. Si el número de referencia ya fue registrado en una transacción anterior, se alerta la duplicidad.

7. **Configuración y Parámetros del Negocio (Tabla `parametro`):**
   - `voucher_ia_activo` (boolean, por defecto `false` en despliegues nuevos hasta configurar claves).
   - `voucher_titular_nombre` (texto configurado por el dueño: `"Maria Jose Morillo Ruiz"`).
   - `voucher_yape_numero` (texto configurado por el dueño: `"977503006"`).
   - `voucher_plin_numero` (texto configurado por el dueño: `"977503006"`).
   - `voucher_mozo_obligatorio` (boolean, `true`).

8. **Modelo de Lenguaje, Costos y Seguridad de API:**
   - Proveedor y modelo: OpenAI Vision (`OPENAI_VISION_MODEL`, por defecto `gpt-4o-mini`), reutilizando la variable central `OPENAI_API_KEY`.
   - Sin tope de gasto mensual forzado para evitar interrupciones en la recepción de pagos del negocio, pero con registro riguroso de cada llamada en la tabla `ia_consumo` con `origen: 'VOUCHER'`.
   - Límite técnico de seguridad en Redis: máximo 10 peticiones de lectura por minuto por identificador para mitigar abusos.
   - Solo se remite la imagen reducida (máximo 1600 px en formato JPEG con compresión 0.85) y el prompt de extracción estricto; no se transfieren datos personales adicionales a terceros.

9. **Modelo de Datos y Permisos Granulares:**
   - Tabla dedicada `voucher_pago` (migración `20261029000000_voucher_pago`) con llaves foráneas a `pedido`, `conversacion`, `mensaje` y `archivo`.
   - Permisos del sistema (migración `20261029000100_vouchers_permisos`):
     - `vouchers/subir`: Asignado a `ADMIN`, `CAJERO` y `MOZO`.
     - `vouchers/ver`: Asignado exclusivamente a `ADMIN` y `CAJERO`.

10. **Conciliación en Cierre de Caja (`apps/web/src/admin/vouchers/SeccionVouchersCierre.tsx`):**
    - Sección de auditoría en el cierre de turno que consolida todos los comprobantes aprobados, facilitando el cuadre frente al estado de cuenta bancario real.

---

## 4. Consecuencias

### Positivas
- **Eliminación de fraudes:** Detección instantánea de vouchers reciclados por hash o por código de operación.
- **Eficiencia operativa:** Reducción drástica del tiempo de espera de clientes en salón y delivery al automatizar la lectura visual.
- **Seguridad financiera:** La decisión de aprobar dinero continúa bajo control humano exclusivo; la IA no tiene privilegios de balance ni cobro.
- **Trazabilidad total:** Registro detallado en auditoría de quién subió el comprobante y quién aprobó o rechazó la transacción.

### Negativas / Mitigaciones
- **Dependencia de conectividad con OpenAI:** Si la API externa experimenta latencia o caída, la extracción automática no se ejecuta. *Mitigación:* Modo de degradación suave `SIN_LECTURA` que permite continuar operando manualmente sin bloquear la venta.
- **Costo por consumo de API:** Cada lectura multimodal genera consumo de tokens. *Mitigación:* Se optimizó el tamaño de imagen en cliente (máximo 1600 px) y se utiliza `gpt-4o-mini`, manteniendo el costo en fracciones de centavo de dólar por lectura.

---

## 5. Datos (Gobierno de Datos - Puerta F4)

- **Entidades afectadas:**
  - Tabla `voucher_pago` en esquema relacional.
  - Campos de configuración en tabla `parametro`.
  - Registros de facturación interna en `ia_consumo`.
- **Seguridad y privacidad (Ley 29733):**
  - Los comprobantes contienen nombres y números de teléfono; se guardan en la carpeta de almacenamiento privado del servidor (`esPrivado = true`), impidiendo el acceso público no autenticado.
  - La visualización en el cliente web requiere sesión válida con permisos `vouchers/ver`.
  - Prohibición estricta de registrar claves bancarias o tokens en logs de aplicación.
- **Retención y respaldos:**
  - Los comprobantes vinculados a pedidos pagados se conservan durante el periodo de auditoría fiscal y operativa (mínimo 2 años) conforme a la política general de archivos (ADR-012).

---

*Generado por IA: Borrador formal según especificación de docs-contrato.txt y directrices del proyecto Caprichos — Revisado por: (pendiente) — Aprueba: Technical Lead*
