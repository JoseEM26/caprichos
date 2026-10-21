---
id: HU-CAP-019
tipo: hu
titulo: "Enviar mi pedido y ver la confirmación"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-002, FT-PED-03, RQ-PED-03-01, RQ-PED-03-02, RQ-PED-03-08, RQ-PED-03-09, HU-CAP-020, HU-CAP-021, ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, D-26, DEP-02, DEP-06, R-01]
tags: [hu, pedido, capa-a, ft-ped-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-019 | Título | Enviar mi pedido y ver la confirmación |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-002 · FT-PED-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | enviar mi pedido y ver la confirmación | tener la seguridad de que mi pedido llegó y saber qué sigue |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PED-03 «Envío del pedido a comandas y aviso al cliente» (Debe tener, épica EP-CAP-002). Cubre los requerimientos: **RQ-PED-03-01** Al enviar, el pedido pasa directo a las comandas con código, canal «Carta» y todos sus datos, sin esperar a caja. **RQ-PED-03-02** Caja ve los pedidos de la carta con el pago por coordinar y los cobra o anula; un pedido de la carta no se anula solo. **RQ-PED-03-08** El envío vuelve a comprobar horario, pausa y disponibilidad antes de registrar el pedido. **RQ-PED-03-09** Un pedido no se registra dos veces si el cliente toca enviar dos veces o se corta la conexión. | **Alcance.**<br>• Al enviar, el pedido pasa directo a las comandas con código, canal «Carta» y todos sus datos, sin esperar a caja.<br>• Caja ve los pedidos de la carta con el pago por coordinar y los cobra o anula; un pedido de la carta no se anula solo.<br>• El envío vuelve a comprobar horario, pausa y disponibilidad antes de registrar el pedido.<br>• Un pedido no se registra dos veces si el cliente toca enviar dos veces o se corta la conexión. |
| **Problema.** Ningún pedido de la carta se reescribe a mano y cocina empieza apenas el cliente envía, sin que el personal tenga que pasar cada pedido. Contribuye a NEC-CAP-001 y OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-020: Escribir al local por WhatsApp con mi pedido.<br>• HU-CAP-021: Recibir el aviso de un pedido nuevo en caja.<br>• Confirmar, ubicar y cobrar el pedido: FT-CAJ-01 y FT-CAJ-02.<br>• Conversación completa del bot para el pago: FT-BOT-02.<br>• Seguimiento del estado del pedido por el cliente en la carta (no pedido en el BRD). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un carrito válido | el cliente envía | cada parte aparece en la pantalla de su área y se imprime su comanda, y el pedido figura en Pedidos y caja como «en cocina, pago por coordinar» con código, productos, opciones, notas, modalidad, ubicación, método de pago y total (RQ-PED-03-01) |
| CA-2 | un pedido de la carta sin pagar | el asesor confirma el pago por WhatsApp | caja lo marca cobrado; si el cliente no paga, caja lo anula con motivo y PIN de la supervisora y cocina lo ve anulado (RQ-PED-03-02) |
| CA-3 | la pausa activada mientras el cliente confirmaba | envía | el pedido no se registra y el cliente ve el motivo (FT-CAR-02) (RQ-PED-03-08) |
| CA-4 | un doble toque en «Enviar» | llegan las dos solicitudes | queda un solo pedido con un solo código (RQ-PED-03-09) |

Origen: criterios de verificación de FT-PED-03 (RQ-PED-03-01, RQ-PED-03-02, RQ-PED-03-08, RQ-PED-03-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-57) El pedido de la carta pasa directo a las comandas; la captura la pide el asesor por WhatsApp; reemplaza RN-CAP-001 y RN-CAP-074 para la carta.<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-010, RNF-CAP-003, RNF-CAP-015. | `Pedido` (código único, canal, modalidad, estado «por confirmar», total) · `LineaPedido` (producto, tamaño, opciones, nota, cantidad, precio) · `ClienteContacto` (nombre, teléfono, aceptación) · `Entrega` (latitud, longitud, enlace, dirección, referencia, zona, envío) · `PagoPreferido` (medio, monto con que paga).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-COC-01 · FT-CAJ-01 · D-26.<br>• FT-CAJ-02 · D-26.<br>• FT-CAR-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ pantalla «Pedido enviado»; administrativo ▸ Pedidos y caja, campanita de notificaciones (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-PED-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-26 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PED-03 (requerimientos RQ-PED-03-01, RQ-PED-03-02, RQ-PED-03-08, RQ-PED-03-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
