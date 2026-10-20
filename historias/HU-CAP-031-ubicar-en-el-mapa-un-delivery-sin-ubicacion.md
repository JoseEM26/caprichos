---
id: HU-CAP-031
tipo: hu
titulo: "Ubicar en el mapa un delivery sin ubicación"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-004, FT-CAJ-01, RQ-CAJ-01-06, RQ-CAJ-01-07, RQ-CAJ-01-08, HU-CAP-029, HU-CAP-030, HU-CAP-032, ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012, DEP-02, DEP-06, R-01, R-03]
tags: [hu, caja, capa-a, ft-caj-01, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-031 | Título | Ubicar en el mapa un delivery sin ubicación |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-004 · FT-CAJ-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | ubicar en el mapa un delivery sin ubicación | que todo delivery tenga su punto y su envío correcto antes de cocinar |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-CAJ-01 «Cola de pedidos por confirmar» (Debe tener, épica EP-CAP-004). Cubre los requerimientos: **RQ-CAJ-01-06** Un delivery sin ubicación no se puede confirmar hasta ubicarlo en el mapa. **RQ-CAJ-01-07** Quien atiende ubica el pedido buscando la dirección o tocando el mapa, y se recalculan zona, envío y total. **RQ-CAJ-01-08** La zona solo se cambia a mano si el cliente la confirma; fuera de cobertura no se guarda como delivery. | **Alcance.**<br>• Un delivery sin ubicación no se puede confirmar hasta ubicarlo en el mapa.<br>• Quien atiende ubica el pedido buscando la dirección o tocando el mapa, y se recalculan zona, envío y total.<br>• La zona solo se cambia a mano si el cliente la confirma; fuera de cobertura no se guarda como delivery. |
| **Problema.** Que ningún pedido de fuera se cocine sin pago verificado y que ninguno se pierda entre canales. Contribuye a OBJ-CAP-001 y NEC-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-029: Ver y abrir la cola de pedidos por confirmar.<br>• HU-CAP-030: Confirmar el pago de un pedido y enviarlo a cocina.<br>• HU-CAP-032: Rechazar un pedido con motivo.<br>• El cobro con medios de pago y el pago mixto: FT-CAJ-02.<br>• La aprobación del comprobante desde la consola de WhatsApp: FT-BOT-02 y FT-ATN-01.<br>• Pedidos que toma caja o el call center: FT-CAJ-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un delivery solo con dirección escrita | el cajero intenta confirmar | ve «Ubica el pedido antes de confirmarlo» y el botón queda desactivado (RQ-CAJ-01-06) |
| CA-2 | un pedido sin punto | el cajero busca «Av. Brasil 1234» y fija el pin | el pedido guarda el punto y el enlace, el envío pasa de «por calcular» al de su zona y el total se actualiza (RQ-CAJ-01-07) |
| CA-3 | un punto fuera de cobertura | el cajero lo fija | se avisa y se ofrece pasar el pedido a «para recoger» (RQ-CAJ-01-08) |
| CA-4 | un usuario con un rol sin permiso para esta acción (ACT-CAP-009 repartidor) | intenta hacerla desde el menú o escribiendo la dirección de la pantalla | se rechaza en el servidor, no se guarda nada y no se entregan datos (RN-CAP-013, RNF-CAP-006) |

Origen: criterios de verificación de FT-CAJ-01 (RQ-CAJ-01-06, RQ-CAJ-01-07, RQ-CAJ-01-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-101) El bot no verifica comprobantes ni manda a cocina; un delivery sin ubicación no se aprueba.<br>**RB-02** (RN-CAP-104) Un delivery sin ubicación ni zona no se confirma; al ubicar se recalculan zona, envío y total.<br>**RB-03** (RN-CAP-087) La zona se cambia a mano solo si el cliente la confirma.<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-006, RNF-CAP-009, RNF-CAP-010, RNF-CAP-012. | `Pedido` (estado: por confirmar, confirmado, en cocina, listo, entregado, cobrado, rechazado, anulado) · `Confirmacion` (autor, hora, medio, comprobante de pago, código de operación) · `Cobro` y `PagoCobro` (medio, monto, recibido, vuelto) · `Anulacion` (motivo, autor, PIN validado).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-030** (Confirmar el pago de un pedido y enviarlo a cocina) va antes, dentro de la misma feature.<br>• FT-DEL-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01, R-03 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Pedidos y caja ▸ «Por confirmar», detalle del pedido, ubicar en el mapa, subir comprobante (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-CAJ-01 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-006, ADR-007, ADR-008, ADR-010, ADR-012.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-CAJ-01 (requerimientos RQ-CAJ-01-06, RQ-CAJ-01-07, RQ-CAJ-01-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
