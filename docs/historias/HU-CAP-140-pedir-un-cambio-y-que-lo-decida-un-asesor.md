---
id: HU-CAP-140
tipo: hu
titulo: "Pedir un cambio y que lo decida un asesor"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-015, FT-ATN-02, RQ-ATN-02-02, RQ-ATN-02-03, RQ-ATN-02-04, RQ-ATN-02-05, HU-CAP-139, HU-CAP-141, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009, DEP-02, DEP-06, R-01]
tags: [hu, atencion, capa-a, ft-atn-02, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-140 | Título | Pedir un cambio y que lo decida un asesor |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-015 · FT-ATN-02 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | pedir un cambio y que lo decida un asesor | corregir mi dirección o mi pedido después de enviarlo |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-ATN-02 «Cambios después del pedido y derivación» (Debería tener, épica EP-CAP-015). Cubre los requerimientos: **RQ-ATN-02-02** El cliente pide cambiar la dirección o el pedido y el bot registra la solicitud y avisa a un asesor. **RQ-ATN-02-03** El bot no cambia el pedido por sí solo. **RQ-ATN-02-04** Con el pedido en camino no se cambia la dirección y el aviso es urgente. **RQ-ATN-02-05** El asesor acepta o rechaza la solicitud y el bot avisa al cliente. | **Alcance.**<br>• El cliente pide cambiar la dirección o el pedido y el bot registra la solicitud y avisa a un asesor.<br>• El bot no cambia el pedido por sí solo.<br>• Con el pedido en camino no se cambia la dirección y el aviso es urgente.<br>• El asesor acepta o rechaza la solicitud y el bot avisa al cliente. |
| **Problema.** Que el cliente sepa cómo va su pedido sin llamar, y que los cambios no se pierdan. | **Fuera de alcance.**<br>• HU-CAP-139: Preguntar por el estado de mi pedido.<br>• HU-CAP-141: Derivar a una persona un mensaje no entendido.<br>• Cancelar un pedido desde el bot (propuesta: también como solicitud).<br>• Consola: FT-ATN-01. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido en cocina | el cliente pide cambiar la dirección | el bot dice que un asesor lo revisará y el pedido muestra «Solicitud de cambio» en caja (RQ-ATN-02-02) |
| CA-2 | una solicitud de cambio | el bot la recibe | el pedido no cambia hasta que un asesor lo edite (RQ-ATN-02-03) |
| CA-3 | un pedido en camino | el cliente pide otra dirección | el bot dice que un asesor lo contactará y el chat pasa a «Urgente» (RQ-ATN-02-04) |
| CA-4 | una solicitud | el asesor la acepta y edita el pedido | el bot avisa «Listo, cambiamos tu pedido»; si la rechaza, avisa el motivo (RQ-ATN-02-05) |

Origen: criterios de verificación de FT-ATN-02 (RQ-ATN-02-02, RQ-ATN-02-03, RQ-ATN-02-04, RQ-ATN-02-05); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-105) El chatbot no cambia pedidos: registra y avisa; en camino no se cambia la dirección y el aviso es urgente.<br>**RNF aplicables:** RNF-CAP-016, RNF-CAP-009. | `Conversacion` (dueño, tomado por, desde, urgente, atendido) · `RespuestaRapida` · `SolicitudCambio` (pedido, tipo, estado, decisión) · `Encuesta` (pedido, nota, comentario, derivada).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-139** (Preguntar por el estado de mi pedido) va antes, dentro de la misma feature.<br>• FT-CAJ-01.<br>• FT-DEL-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Chatbot ▸ simulador (estado, cambio, persona); administrativo ▸ Mensajes y Pedidos (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-ATN-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-ATN-02 (requerimientos RQ-ATN-02-02, RQ-ATN-02-03, RQ-ATN-02-04, RQ-ATN-02-05, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
