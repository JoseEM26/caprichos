---
id: HU-CAP-021
tipo: hu
titulo: "Recibir el aviso de un pedido nuevo en caja"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-002, FT-PED-03, RQ-PED-03-05, RQ-PED-03-06, RQ-PED-03-07, HU-CAP-019, HU-CAP-020, ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010, D-05, D-08, DEP-02, DEP-06, DEP-12, R-01, R-04]
tags: [hu, pedido, capa-a, ft-ped-03, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-021 | Título | Recibir el aviso de un pedido nuevo en caja |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-002 · FT-PED-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-002** Cajero/a | recibir el aviso de un pedido nuevo en caja | atender cada pedido de la carta apenas llega |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PED-03 «Envío del pedido a comandas y aviso al cliente» (Debe tener, épica EP-CAP-002). Cubre los requerimientos: **RQ-PED-03-05** El administrativo avisa con sonido y notificación al llegar un pedido de la carta. **RQ-PED-03-06** Al enviar, llega un mensaje automático al WhatsApp del cliente con el resumen y el método de pago elegido. **RQ-PED-03-07** Un pedido de la carta sin pago coordinado recibe un recordatorio a caja a los N minutos. | **Alcance.**<br>• El administrativo avisa con sonido y notificación al llegar un pedido de la carta.<br>• Al enviar, llega un mensaje automático al WhatsApp del cliente con el resumen y el método de pago elegido.<br>• Un pedido de la carta sin pago coordinado recibe un recordatorio a caja a los N minutos. |
| **Problema.** Ningún pedido de la carta se reescribe a mano y cocina empieza apenas el cliente envía, sin que el personal tenga que pasar cada pedido. Contribuye a NEC-CAP-001 y OBJ-CAP-001. | **Fuera de alcance.**<br>• HU-CAP-019: Enviar mi pedido y ver la confirmación.<br>• HU-CAP-020: Escribir al local por WhatsApp con mi pedido.<br>• Confirmar, ubicar y cobrar el pedido: FT-CAJ-01 y FT-CAJ-02.<br>• Conversación completa del bot para el pago: FT-BOT-02.<br>• Seguimiento del estado del pedido por el cliente en la carta (no pedido en el BRD). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un usuario de caja con la sesión abierta | entra un pedido de la carta | suena un aviso y la campanita suma una notificación que abre el pedido (RQ-PED-03-05) |
| CA-2 | el acceso a WhatsApp configurado | entra un pedido de la carta | el número del local envía al teléfono del cliente «Recibimos tu pedido» con el código, los productos, el total y el método de pago; el asesor sigue la conversación para pedir la captura (RQ-PED-03-06) |
| CA-3 | un plazo de 5 minutos | un pedido de la carta sigue con el pago por coordinar a los 5 minutos | caja recibe un recordatorio; a los 30 minutos sigue sin anularse (RQ-PED-03-07) |

Origen: criterios de verificación de FT-PED-03 (RQ-PED-03-05, RQ-PED-03-06, RQ-PED-03-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-57) El pedido de la carta pasa directo a las comandas; la captura la pide el asesor por WhatsApp; reemplaza RN-CAP-001 y RN-CAP-074 para la carta.<br>**RB-02** (RN-CAP-043) Al entrar un pedido por la web, el chatbot escribe al teléfono del cliente.<br>**RB-03** (RN-CAP-112) Pendiente de Kevin el plazo de espera de un pedido por confirmar.<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-010, RNF-CAP-003, RNF-CAP-015. | `Pedido` (código único, canal, modalidad, estado «por confirmar», total) · `LineaPedido` (producto, tamaño, opciones, nota, cantidad, precio) · `ClienteContacto` (nombre, teléfono, aceptación) · `Entrega` (latitud, longitud, enlace, dirección, referencia, zona, envío) · `PagoPreferido` (medio, monto con que paga).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-020** (Escribir al local por WhatsApp con mi pedido) va antes, dentro de la misma feature.<br>• FT-INF-03.<br>• FT-BOT-02 · DEP-12 (D-08).<br>• D-05.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01, R-04 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ pantalla «Pedido enviado»; administrativo ▸ Pedidos y caja, campanita de notificaciones (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-PED-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-005, ADR-009, ADR-010.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-05, D-08 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PED-03 (requerimientos RQ-PED-03-05, RQ-PED-03-06, RQ-PED-03-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
