---
id: HU-CAP-097
tipo: hu
titulo: "Registrar y editar un proveedor"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-011, FT-COM-01, RQ-COM-01-01, RQ-COM-01-02, RQ-COM-01-05, HU-CAP-098, ADR-001, ADR-011, ADR-014, ADR-003, ADR-004, D-15, DEP-02, DEP-06, DEP-11, R-01]
tags: [hu, compras, capa-a, ft-com-01, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-097 | Título | Registrar y editar un proveedor |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-011 · FT-COM-01 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-005** Almacén | registrar y editar un proveedor | tener los datos de cada proveedor a la mano |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-COM-01 «Directorio de proveedores» (Debería tener, épica EP-CAP-011). Cubre los requerimientos: **RQ-COM-01-01** Se registra un proveedor con razón social, RUC, contacto, WhatsApp, días de crédito y cuenta de pago. **RQ-COM-01-02** Un RUC no se repite entre proveedores. **RQ-COM-01-05** El directorio se busca por nombre, RUC o insumo que provee. | **Alcance.**<br>• Se registra un proveedor con razón social, RUC, contacto, WhatsApp, días de crédito y cuenta de pago.<br>• Un RUC no se repite entre proveedores.<br>• El directorio se busca por nombre, RUC o insumo que provee. |
| **Problema.** Comprar mejor: saber a quién se le compra cada insumo, a qué precio y con qué condiciones. | **Fuera de alcance.**<br>• HU-CAP-098: Ver el historial de compras y precios de un proveedor.<br>• Pedir a proveedores: FT-COM-02.<br>• Registrar compras: FT-COM-03.<br>• Pagos a proveedores y cuentas por pagar (no pedido). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el formulario | almacén registra un proveedor con RUC de 11 dígitos | queda guardado; un RUC con otro largo no se acepta (RQ-COM-01-01) |
| CA-2 | un RUC ya registrado | se intenta registrar otro proveedor con él | se rechaza (RQ-COM-01-02) |
| CA-3 | 15 proveedores | almacén busca «leche» | ve los que son A, B o C de la leche (RQ-COM-01-05) |

Origen: criterios de verificación de FT-COM-01 (RQ-COM-01-01, RQ-COM-01-02, RQ-COM-01-05); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-082 (2.ª)) Un proveedor desactivado conserva su historial y no se elige; A, B y C no se repiten (id repetido, O1).<br>**RB-02** (RN-CAP-014) Los registros no se eliminan: se desactivan.<br>**RNF aplicables:** RNF-CAP-014, RNF-CAP-009. | `Proveedor` (RUC único, WhatsApp, crédito, cuenta, activo) · `PedidoProveedor` (estado por recibir, parcial, recibido, anulado) · `Compra` (comprobante, condición, pagada, anulada) · `LineaCompra` (insumo, cantidad, costo, lote, vencimiento).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • DEP-11 (D-15).<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Compras ▸ Proveedores (`Admin.dc.html`); `analisis/compras-y-proveedores.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-COM-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-004.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-15 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-COM-01 (requerimientos RQ-COM-01-01, RQ-COM-01-02, RQ-COM-01-05, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
