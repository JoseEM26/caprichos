---
id: HU-CAP-103
tipo: hu
titulo: "Recibir un pedido por recibir, completo o parcial"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-011, FT-COM-03, RQ-COM-03-05, HU-CAP-102, HU-CAP-104, ADR-001, ADR-011, ADR-014, ADR-003, ADR-004, DEP-02, DEP-06, R-01]
tags: [hu, compras, capa-a, ft-com-03, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-103 | Título | Recibir un pedido por recibir, completo o parcial |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-011 · FT-COM-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-005** Almacén | recibir un pedido por recibir, completo o parcial | recibir lo que llegó aunque falte parte del pedido |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-COM-03 «Registro y recepción de compras» (Debería tener, épica EP-CAP-011). Cubre el requerimiento: **RQ-COM-03-05** Un pedido «Por recibir» se recibe con costos, vencimientos y comprobante, y recién ahí sube el stock. | **Alcance.**<br>• Un pedido «Por recibir» se recibe con costos, vencimientos y comprobante, y recién ahí sube el stock. |
| **Problema.** Stock y costos actualizados con cada compra; base del margen por plato (OBJ-CAP-003). | **Fuera de alcance.**<br>• HU-CAP-102: Registrar una compra con su comprobante.<br>• HU-CAP-104: Anular una compra o marcarla pagada.<br>• Cuentas por pagar y pagos a proveedores desde el sistema (solo se marca pagada).<br>• Facturación electrónica del proveedor (DT-11). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido por recibir de 3 cajas | llegan 2 | almacén recibe 2 con su costo y el pedido queda parcial con 1 pendiente (RQ-COM-03-05) |

Origen: criterios de verificación de FT-COM-03 (RQ-COM-03-05); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-136) Al llegar se recibe y se registran costos, vencimientos y comprobante; recién ahí sube el stock.<br>**RNF aplicables:** RNF-CAP-020, RNF-CAP-011, RNF-CAP-014, RNF-CAP-009. | `Proveedor` (RUC único, WhatsApp, crédito, cuenta, activo) · `PedidoProveedor` (estado por recibir, parcial, recibido, anulado) · `Compra` (comprobante, condición, pagada, anulada) · `LineaCompra` (insumo, cantidad, costo, lote, vencimiento).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; montos en soles con dos decimales. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-102** (Registrar una compra con su comprobante) va antes, dentro de la misma feature.<br>• FT-COM-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Compras ▸ Registrar compra, Por recibir, historial (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-COM-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-004.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-COM-03 (requerimientos RQ-COM-03-05, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
