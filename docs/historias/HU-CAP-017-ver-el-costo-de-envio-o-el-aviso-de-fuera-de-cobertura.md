---
id: HU-CAP-017
tipo: hu
titulo: "Ver el costo de envío o el aviso de fuera de cobertura"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-002, FT-PED-02, RQ-PED-02-07, RQ-PED-02-08, RQ-PED-02-09, HU-CAP-016, HU-CAP-018, ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, D-03, DEP-02, DEP-06, DEP-07, R-01, R-03]
tags: [hu, pedido, capa-a, ft-ped-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-017 | Título | Ver el costo de envío o el aviso de fuera de cobertura |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-002 · FT-PED-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | ver el costo de envío o el aviso de fuera de cobertura | saber cuánto cuesta el envío o si llegan a mi zona |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PED-02 «Ubicación y costo de envío en la carta» (Debe tener, épica EP-CAP-002). Cubre los requerimientos: **RQ-PED-02-07** La zona y el costo de envío salen solos del punto; el cliente solo ve el costo y el mapa no dibuja los límites de las zonas. **RQ-PED-02-08** Un punto fuera de cobertura avisa y ofrece cambiar a recoger; no se guarda como delivery. **RQ-PED-02-09** Sin punto, el envío queda «por calcular» y lo fija el asesor al ubicar el pedido. | **Alcance.**<br>• La zona y el costo de envío salen solos del punto; el cliente solo ve el costo y el mapa no dibuja los límites de las zonas.<br>• Un punto fuera de cobertura avisa y ofrece cambiar a recoger; no se guarda como delivery.<br>• Sin punto, el envío queda «por calcular» y lo fija el asesor al ubicar el pedido. |
| **Problema.** Pedidos de delivery con un punto exacto que el repartidor abre en su app de mapas, y un costo de envío correcto sin preguntar zonas al cliente. Contribuye a OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-016: Compartir mi ubicación o escribir mi dirección.<br>• HU-CAP-018: Ver envío gratis y pedido mínimo.<br>• Cómo se editan zonas y tarifas: FT-DEL-01.<br>• Cómo el asesor ubica un pedido sin punto: FT-CAJ-01.<br>• Seguimiento del repartidor en un mapa en tiempo real (fuera de alcance, BRD §4). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un punto dentro de la zona Z3 con tarifa S/ 4 | el cliente confirma la ubicación | ve «Envío S/ 4,00», sin el nombre de la zona y sin líneas de zonas en el mapa (RQ-PED-02-07) |
| CA-2 | un punto fuera de todas las zonas activas | el cliente lo confirma | ve «Aún no llegamos a esa dirección» con el botón «Recoger en tienda», y no puede enviar como delivery (RQ-PED-02-08) |
| CA-3 | un pedido enviado solo con dirección escrita | llega a caja | el envío figura «por calcular» y el pedido no se puede confirmar hasta ubicarlo (FT-CAJ-01) (RQ-PED-02-09) |
| CA-4 | un celular de 360 px de ancho | el cliente abre la pantalla de esta historia | todo se lee y se toca sin desplazamiento horizontal (RNF-CAP-004) |

Origen: criterios de verificación de FT-PED-02 (RQ-PED-02-07, RQ-PED-02-08, RQ-PED-02-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-087) La zona la decide el pin; fuera de cobertura no se registra delivery.<br>**RB-02** (RN-CAP-103) La zona y su costo salen solos del punto; el cliente nunca ve la zona.<br>**RB-03** (RN-CAP-104) Un delivery sin ubicación ni zona no se confirma.<br>**RB-04** (DT-57) La ubicación se confirma bajo el mapa, no es obligatoria y los límites de las zonas no se muestran al cliente.<br>**RNF aplicables:** RNF-CAP-008, RNF-CAP-004, RNF-CAP-011. | `Pedido` (código único, canal, modalidad, estado «por confirmar», total) · `LineaPedido` (producto, tamaño, opciones, nota, cantidad, precio) · `ClienteContacto` (nombre, teléfono, aceptación) · `Entrega` (latitud, longitud, enlace, dirección, referencia, zona, envío) · `PagoPreferido` (medio, monto con que paga).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** montos en soles con dos decimales; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-016** (Compartir mi ubicación o escribir mi dirección) va antes, dentro de la misma feature.<br>• FT-DEL-01 · DEP-07 (D-03).<br>• FT-DEL-01.<br>• FT-CAJ-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-03, R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ paso de entrega con «Usar mi ubicación actual», mapa, dirección, referencia y costo de envío (`Main.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-PED-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-03 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PED-02 (requerimientos RQ-PED-02-07, RQ-PED-02-08, RQ-PED-02-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
