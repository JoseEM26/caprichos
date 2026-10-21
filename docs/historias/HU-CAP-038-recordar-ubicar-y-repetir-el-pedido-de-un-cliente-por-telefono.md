---
id: HU-CAP-038
tipo: hu
titulo: "Recordar, ubicar y repetir el pedido de un cliente por teléfono"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-CAJ-03, RQ-CAJ-03-03, RQ-CAJ-03-04, RQ-CAJ-03-05, RQ-CAJ-03-06, RQ-CAJ-03-12, HU-CAP-037, HU-CAP-039, HU-CAP-040, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, caja, capa-a, ft-caj-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-038 | Título | Recordar, ubicar y repetir el pedido de un cliente por teléfono |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-004 · FT-CAJ-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Call center (aún sin código ACT en el BRD)** | recordar, ubicar y repetir el pedido de un cliente por teléfono | tomar el pedido de un cliente frecuente en menos de un minuto |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAJ-03 «Nuevo pedido desde caja y call center» (Debe tener, épica EP-CAP-004). Cubre los requerimientos: **RQ-CAJ-03-03** El cliente se busca por teléfono o DNI y su dirección se recuerda. **RQ-CAJ-03-04** Se puede repetir un pedido anterior del cliente. **RQ-CAJ-03-05** Para delivery se marca el lugar en el mapa buscando la dirección o tocando el punto. **RQ-CAJ-03-06** Se aplica la tarifa especial de envío del cliente si la tiene. **RQ-CAJ-03-12** Se registra con cuánto paga el cliente en efectivo para que el repartidor lleve el vuelto. | **Alcance.**<br>• El cliente se busca por teléfono o DNI y su dirección se recuerda.<br>• Se puede repetir un pedido anterior del cliente.<br>• Para delivery se marca el lugar en el mapa buscando la dirección o tocando el punto.<br>• Se aplica la tarifa especial de envío del cliente si la tiene.<br>• Se registra con cuánto paga el cliente en efectivo para que el repartidor lleve el vuelto. |
| **Problema.** Que los pedidos por teléfono y WhatsApp se registren rápido y con los mismos datos que los de la carta. | **Fuera de alcance.**<br>• HU-CAP-037: Armar un pedido para un cliente en Nuevo pedido.<br>• HU-CAP-039: Aplicar promociones, descuentos y cupón en Nuevo pedido.<br>• HU-CAP-040: Registrar el pedido del personal.<br>• El pedido del mozo en mesa: FT-SAL-02.<br>• Confirmar y cobrar: FT-CAJ-01 y FT-CAJ-02.<br>• Creación de ofertas y cupones: FT-OFE-01 a FT-OFE-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un cliente que pidió antes | el call center escribe su teléfono | aparecen su nombre y su última dirección con el punto en el mapa, editables (RQ-CAJ-03-03) |
| CA-2 | un cliente con pedidos anteriores | el call center toca «Repetir» en uno | el carrito se llena con esos productos y opciones a los precios de hoy (RQ-CAJ-03-04) |
| CA-3 | un pedido por teléfono | el call center busca la dirección que dictó el cliente y ajusta el pin | el pedido guarda el punto, el enlace, la zona y su envío (RQ-CAJ-03-05) |
| CA-4 | un cliente con envío fijo de S/ 2 | se toma su delivery a la zona de S/ 5 | el envío es S/ 2 (RQ-CAJ-03-06) |
| CA-5 | un delivery en efectivo de S/ 37 | el call center anota «paga con S/ 50» | el pedido muestra vuelto S/ 13 para el repartidor (RQ-CAJ-03-12) |
| CA-6 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-CAJ-03 (RQ-CAJ-03-03, RQ-CAJ-03-04, RQ-CAJ-03-05, RQ-CAJ-03-06, RQ-CAJ-03-12); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-109) Tarifa especial por cliente: el monto fijo prevalece sobre el porcentaje y el envío gratis sobre ambos.<br>**RNF aplicables:** RNF-CAP-004, RNF-CAP-008, RNF-CAP-011, RNF-CAP-006. | `Pedido` (estado: por confirmar, confirmado, en cocina, listo, entregado, cobrado, rechazado, anulado) · `Confirmacion` (autor, hora, medio, comprobante de pago, código de operación) · `Cobro` y `PagoCobro` (medio, monto, recibido, vuelto) · `Anulacion` (motivo, autor, PIN validado).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-037** (Armar un pedido para un cliente en Nuevo pedido) va antes, dentro de la misma feature.<br>• FT-DEL-01.<br>• FT-DEL-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Nuevo pedido: cliente, catálogo con o sin imágenes, mapa, ofertas, cupón, pedido del personal (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAJ-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAJ-03 (requerimientos RQ-CAJ-03-03, RQ-CAJ-03-04, RQ-CAJ-03-05, RQ-CAJ-03-06, RQ-CAJ-03-12, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
