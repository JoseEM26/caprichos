---
id: HU-CAP-101
tipo: hu
titulo: "Enviar el pedido por WhatsApp y seguirlo como «Por recibir»"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-011, FT-COM-02, RQ-COM-02-05, RQ-COM-02-06, HU-CAP-099, HU-CAP-100, ADR-001, ADR-011, ADR-014, ADR-003, ADR-004, DEP-02, DEP-06, R-01]
tags: [hu, compras, capa-a, ft-com-02, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-101 | Título | Enviar el pedido por WhatsApp y seguirlo como «Por recibir» |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-011 · FT-COM-02 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-005** Almacén | enviar el pedido por WhatsApp y seguirlo como «Por recibir» | enviar el pedido en un mensaje y saber qué falta por llegar |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-COM-02 «Pedir a proveedores por WhatsApp» (Debería tener, épica EP-CAP-011). Cubre los requerimientos: **RQ-COM-02-05** Se genera un mensaje de WhatsApp por proveedor con los insumos y cantidades. **RQ-COM-02-06** Enviar crea un pedido «Por recibir», que se puede anular sin tocar el stock. | **Alcance.**<br>• Se genera un mensaje de WhatsApp por proveedor con los insumos y cantidades.<br>• Enviar crea un pedido «Por recibir», que se puede anular sin tocar el stock. |
| **Problema.** Armar el pedido a proveedores en minutos y sin olvidar insumos. | **Fuera de alcance.**<br>• HU-CAP-099: Armar la lista de insumos a pedir.<br>• HU-CAP-100: Elegir el proveedor de cada insumo.<br>• Recibir el pedido y registrar costos: FT-COM-03.<br>• Órdenes de compra por correo (descartadas, DT-13). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un grupo de 3 insumos para un proveedor | almacén toca «Enviar por WhatsApp» | se abre WhatsApp con el número del proveedor y el mensaje armado (RQ-COM-02-05) |
| CA-2 | el mensaje enviado | almacén confirma | queda un pedido «Por recibir»; al anularlo con motivo, el stock no cambia (RQ-COM-02-06) |

Origen: criterios de verificación de FT-COM-02 (RQ-COM-02-05, RQ-COM-02-06); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-083 (2.ª)) La orden por WhatsApp se arma desde el insumo, con su proveedor A (id repetido, O1).<br>**RB-02** (RN-CAP-136) La lista trae lo bajo el mínimo en unidades enteras, agrupa por proveedor y crea un pedido «Por recibir».<br>**RNF aplicables:** RNF-CAP-009, RNF-CAP-014. | `Proveedor` (RUC único, WhatsApp, crédito, cuenta, activo) · `PedidoProveedor` (estado por recibir, parcial, recibido, anulado) · `Compra` (comprobante, condición, pagada, anulada) · `LineaCompra` (insumo, cantidad, costo, lote, vencimiento).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-100** (Elegir el proveedor de cada insumo) va antes, dentro de la misma feature.<br>• FT-COM-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Compras ▸ Pedir a proveedores (`Admin.dc.html`); `analisis/compras-y-proveedores.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-COM-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-004.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-COM-02 (requerimientos RQ-COM-02-05, RQ-COM-02-06, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
