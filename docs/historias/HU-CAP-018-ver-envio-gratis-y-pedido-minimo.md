---
id: HU-CAP-018
tipo: hu
titulo: "Ver envío gratis y pedido mínimo"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-002, FT-PED-02, RQ-PED-02-10, RQ-PED-02-11, HU-CAP-016, HU-CAP-017, ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, D-02, D-03, DEP-02, DEP-06, R-01]
tags: [hu, pedido, capa-a, ft-ped-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-018 | Título | Ver envío gratis y pedido mínimo |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-002 · FT-PED-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | ver envío gratis y pedido mínimo | saber cuánto me falta para el envío gratis o para el pedido mínimo |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PED-02 «Ubicación y costo de envío en la carta» (Debe tener, épica EP-CAP-002). Cubre los requerimientos: **RQ-PED-02-10** El envío es gratis cuando los productos pasan del monto de envío gratis. **RQ-PED-02-11** No se puede enviar un delivery por debajo del pedido mínimo. | **Alcance.**<br>• El envío es gratis cuando los productos pasan del monto de envío gratis.<br>• No se puede enviar un delivery por debajo del pedido mínimo. |
| **Problema.** Pedidos de delivery con un punto exacto que el repartidor abre en su app de mapas, y un costo de envío correcto sin preguntar zonas al cliente. Contribuye a OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-016: Compartir mi ubicación o escribir mi dirección.<br>• HU-CAP-017: Ver el costo de envío o el aviso de fuera de cobertura.<br>• Cómo se editan zonas y tarifas: FT-DEL-01.<br>• Cómo el asesor ubica un pedido sin punto: FT-CAJ-01.<br>• Seguimiento del repartidor en un mapa en tiempo real (fuera de alcance, BRD §4). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | envío gratis con «más de S/ 70» | los productos suman S/ 70,00 | se cobra envío; con S/ 70,10, el envío es S/ 0 (RQ-PED-02-10) |
| CA-2 | un pedido mínimo de S/ 14,50 | los productos suman S/ 12 | se ve cuánto falta y no se puede enviar como delivery (RQ-PED-02-11) |
| CA-3 | un celular de 360 px de ancho | el cliente abre la pantalla de esta historia | todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) |

Origen: criterios de verificación de FT-PED-02 (RQ-PED-02-10, RQ-PED-02-11); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-008) Delivery: pedido mínimo de S/ 14,50 (por confirmar).<br>**RB-02** (RN-CAP-095) Envío gratis «más de 70» por defecto, configurable a «desde 70».<br>**RNF aplicables:** RNF-CAP-008, RNF-CAP-004, RNF-CAP-011. | `Pedido` (código único, canal, modalidad, estado «por confirmar», total) · `LineaPedido` (producto, tamaño, opciones, nota, cantidad, precio) · `ClienteContacto` (nombre, teléfono, aceptación) · `Entrega` (latitud, longitud, enlace, dirección, referencia, zona, envío) · `PagoPreferido` (medio, monto con que paga).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-017** (Ver el costo de envío o el aviso de fuera de cobertura) va antes, dentro de la misma feature.<br>• D-02.<br>• D-03.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ paso de entrega con «Usar mi ubicación actual», mapa, dirección, referencia y costo de envío (`Main.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-PED-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-02, D-03 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PED-02 (requerimientos RQ-PED-02-10, RQ-PED-02-11, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
