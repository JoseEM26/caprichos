---
id: HU-CAP-020
tipo: hu
titulo: "Escribir al local por WhatsApp con mi pedido"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-002, FT-PED-03, RQ-PED-03-03, RQ-PED-03-04, HU-CAP-019, HU-CAP-021, ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, DEP-02, DEP-06, R-01]
tags: [hu, pedido, capa-a, ft-ped-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-020 | Título | Escribir al local por WhatsApp con mi pedido |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-002 · FT-PED-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | escribir al local por WhatsApp con mi pedido | adelantar la conversación con el local sin escribir mi pedido otra vez |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PED-03 «Envío del pedido a comandas y aviso al cliente» (Debe tener, épica EP-CAP-002). Cubre los requerimientos: **RQ-PED-03-03** El cliente ve la confirmación con su código, el resumen y que un asesor le escribirá. **RQ-PED-03-04** El cliente puede abrir WhatsApp del local con el resumen del pedido ya escrito. | **Alcance.**<br>• El cliente ve la confirmación con su código, el resumen y que un asesor le escribirá.<br>• El cliente puede abrir WhatsApp del local con el resumen del pedido ya escrito. |
| **Problema.** Ningún pedido de la carta se reescribe a mano y cocina empieza apenas el cliente envía, sin que el personal tenga que pasar cada pedido. Contribuye a NEC-CAP-001 y OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-019: Enviar mi pedido y ver la confirmación.<br>• HU-CAP-021: Recibir el aviso de un pedido nuevo en caja.<br>• Confirmar, ubicar y cobrar el pedido: FT-CAJ-01 y FT-CAJ-02.<br>• Conversación completa del bot para el pago: FT-BOT-02.<br>• Seguimiento del estado del pedido por el cliente en la carta (no pedido en el BRD). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el pedido enviado | termina el envío | el cliente ve «Pedido N.º ABC123 recibido», el resumen y el mensaje del asesor por WhatsApp (RQ-PED-03-03) |
| CA-2 | la confirmación | el cliente toca «Escribir por WhatsApp» | se abre un chat con el número del local y un mensaje con código, productos, opciones, nota, entrega, total y pago preferido (RQ-PED-03-04) |

Origen: criterios de verificación de FT-PED-03 (RQ-PED-03-03, RQ-PED-03-04); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-081 (1.ª)) El mensaje al cliente incluye el resumen completo, no solo código y total (id repetido, O1).<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-010, RNF-CAP-003, RNF-CAP-015. | `Pedido` (código único, canal, modalidad, estado «por confirmar», total) · `LineaPedido` (producto, tamaño, opciones, nota, cantidad, precio) · `ClienteContacto` (nombre, teléfono, aceptación) · `Entrega` (latitud, longitud, enlace, dirección, referencia, zona, envío) · `PagoPreferido` (medio, monto con que paga).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-019** (Enviar mi pedido y ver la confirmación) va antes, dentro de la misma feature.<br>• FT-CFG-01 (número de WhatsApp).<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ pantalla «Pedido enviado»; administrativo ▸ Pedidos y caja, campanita de notificaciones (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-PED-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PED-03 (requerimientos RQ-PED-03-03, RQ-PED-03-04, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
