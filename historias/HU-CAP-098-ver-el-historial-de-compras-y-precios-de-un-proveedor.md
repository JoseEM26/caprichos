---
id: HU-CAP-098
tipo: hu
titulo: "Ver el historial de compras y precios de un proveedor"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-011, FT-COM-01, RQ-COM-01-03, RQ-COM-01-04, HU-CAP-097, ADR-001, ADR-011, ADR-014, ADR-003, ADR-004, DEP-02, DEP-06, R-01]
tags: [hu, compras, capa-a, ft-com-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-098 | Título | Ver el historial de compras y precios de un proveedor |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-011 · FT-COM-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-005** Almacén | ver el historial de compras y precios de un proveedor | comparar precios y saber cuánto le compramos a cada proveedor |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-COM-01 «Directorio de proveedores» (Debería tener, épica EP-CAP-011). Cubre los requerimientos: **RQ-COM-01-03** Cada proveedor muestra su historial de compras y de precios por insumo. **RQ-COM-01-04** Un proveedor se desactiva, conserva su historial y no se elige en compras nuevas. | **Alcance.**<br>• Cada proveedor muestra su historial de compras y de precios por insumo.<br>• Un proveedor se desactiva, conserva su historial y no se elige en compras nuevas. |
| **Problema.** Comprar mejor: saber a quién se le compra cada insumo, a qué precio y con qué condiciones. | **Fuera de alcance.**<br>• HU-CAP-097: Registrar y editar un proveedor.<br>• Pedir a proveedores: FT-COM-02.<br>• Registrar compras: FT-COM-03.<br>• Pagos a proveedores y cuentas por pagar (no pedido). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un proveedor con 3 compras de leche | se abre su ficha | se ven las compras y la evolución del precio de la leche (RQ-COM-01-03) |
| CA-2 | un proveedor desactivado | se registra una compra | no aparece; su ficha sigue mostrando su historial (RQ-COM-01-04) |

Origen: criterios de verificación de FT-COM-01 (RQ-COM-01-03, RQ-COM-01-04); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-082 (2.ª)) Un proveedor desactivado conserva su historial y no se elige; A, B y C no se repiten (id repetido, O1).<br>**RB-02** (RN-CAP-014) Los registros no se eliminan: se desactivan.<br>**RNF aplicables:** RNF-CAP-014, RNF-CAP-009. | `Proveedor` (RUC único, WhatsApp, crédito, cuenta, activo) · `PedidoProveedor` (estado por recibir, parcial, recibido, anulado) · `Compra` (comprobante, condición, pagada, anulada) · `LineaCompra` (insumo, cantidad, costo, lote, vencimiento).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-097** (Registrar y editar un proveedor) va antes, dentro de la misma feature.<br>• FT-COM-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Compras ▸ Proveedores (`Admin.dc.html`); `analisis/compras-y-proveedores.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-COM-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-004.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-COM-01 (requerimientos RQ-COM-01-03, RQ-COM-01-04, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
