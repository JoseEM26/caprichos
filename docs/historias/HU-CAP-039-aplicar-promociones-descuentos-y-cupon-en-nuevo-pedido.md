---
id: HU-CAP-039
tipo: hu
titulo: "Aplicar promociones, descuentos y cupón en Nuevo pedido"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-CAJ-03, RQ-CAJ-03-07, RQ-CAJ-03-08, HU-CAP-037, HU-CAP-038, HU-CAP-040, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, DEP-02, DEP-06, R-01]
tags: [hu, caja, capa-a, ft-caj-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-039 | Título | Aplicar promociones, descuentos y cupón en Nuevo pedido |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-004 · FT-CAJ-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | aplicar promociones, descuentos y cupón en Nuevo pedido | dar al cliente las mismas ofertas que tendría en la carta |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAJ-03 «Nuevo pedido desde caja y call center» (Debe tener, épica EP-CAP-004). Cubre los requerimientos: **RQ-CAJ-03-07** Se pueden elegir promociones vigentes y aplicar un cupón; los descuentos automáticos se aplican solos. **RQ-CAJ-03-08** El sistema sugiere la promoción para la que califica el pedido y quien atiende la aplica si el cliente acepta. | **Alcance.**<br>• Se pueden elegir promociones vigentes y aplicar un cupón; los descuentos automáticos se aplican solos.<br>• El sistema sugiere la promoción para la que califica el pedido y quien atiende la aplica si el cliente acepta. |
| **Problema.** Que los pedidos por teléfono y WhatsApp se registren rápido y con los mismos datos que los de la carta. | **Fuera de alcance.**<br>• HU-CAP-037: Armar un pedido para un cliente en Nuevo pedido.<br>• HU-CAP-038: Recordar, ubicar y repetir el pedido de un cliente por teléfono.<br>• HU-CAP-040: Registrar el pedido del personal.<br>• El pedido del mozo en mesa: FT-SAL-02.<br>• Confirmar y cobrar: FT-CAJ-01 y FT-CAJ-02.<br>• Creación de ofertas y cupones: FT-OFE-01 a FT-OFE-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un descuento automático vigente para la categoría Frappés | el cajero agrega un frappé | el descuento aparece solo; al escribir un cupón, se aplica según la regla de acumulación (RQ-CAJ-03-07) |
| CA-2 | un pedido con dos Ice Coffee de S/ 9 | el cajero los agrega | ve «El pedido califica para 2×1 Ice Coffee · ahorra S/ 9 · Aplicar»; si el cliente no la quiere, el aviso se cierra y no vuelve a salir en ese pedido (RQ-CAJ-03-08) |
| CA-3 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-CAJ-03 (RQ-CAJ-03-07, RQ-CAJ-03-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-070) Promociones y descuentos valen en sus días, horas y canales; por defecto un cupón no se junta con un descuento automático.<br>**RB-02** (DT-62) Opciones por unidad al pedir varias, con un mismo tamaño; sugerencia de la promoción aplicable.<br>**RNF aplicables:** RNF-CAP-004, RNF-CAP-008, RNF-CAP-011, RNF-CAP-006. | `Pedido` (estado: por confirmar, confirmado, en cocina, listo, entregado, cobrado, rechazado, anulado) · `Confirmacion` (autor, hora, medio, comprobante de pago, código de operación) · `Cobro` y `PagoCobro` (medio, monto, recibido, vuelto) · `Anulacion` (motivo, autor, PIN validado).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-038** (Recordar, ubicar y repetir el pedido de un cliente por teléfono) va antes, dentro de la misma feature.<br>• FT-OFE-01 · FT-OFE-02 · FT-OFE-03.<br>• FT-OFE-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Nuevo pedido: cliente, catálogo con o sin imágenes, mapa, ofertas, cupón, pedido del personal (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAJ-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAJ-03 (requerimientos RQ-CAJ-03-07, RQ-CAJ-03-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
