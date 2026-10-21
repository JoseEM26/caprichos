---
id: HU-CAP-077
tipo: hu
titulo: "Registrar la merma de lo no entregado y configurar entregas fallidas"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-008, FT-DEL-03, RQ-DEL-03-08, RQ-DEL-03-09, HU-CAP-074, HU-CAP-075, HU-CAP-076, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010, DEP-02, DEP-06, R-01]
tags: [hu, delivery, capa-a, ft-del-03, media, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-077 | Título | Registrar la merma de lo no entregado y configurar entregas fallidas |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-008 · FT-DEL-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Media | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-001** Kevin Rosales, dueño y administrador | registrar la merma de lo no entregado y configurar entregas fallidas | registrar lo que se perdió y ajustar cómo se manejan las entregas fallidas |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-DEL-03 «Entregas fallidas» (Debe tener, épica EP-CAP-008). Cubre los requerimientos: **RQ-DEL-03-08** Lo preparado y no entregado se registra como merma informativa de origen Reparto, sin descontar stock otra vez. **RQ-DEL-03-09** Tiempos, intentos, recargo y recomendación se configuran. | **Alcance.**<br>• Lo preparado y no entregado se registra como merma informativa de origen Reparto, sin descontar stock otra vez.<br>• Tiempos, intentos, recargo y recomendación se configuran. |
| **Problema.** Que una entrega fallida no se quede en el aire: alguien la atiende, se decide qué hacer y queda registrada. | **Fuera de alcance.**<br>• HU-CAP-074: Reportar que el cliente no contesta o no encuentro la dirección.<br>• HU-CAP-075: Corregir la dirección y seguir los intentos.<br>• HU-CAP-076: Cerrar la coordinación de un pedido devuelto.<br>• Avisos automáticos al salir y al llegar: FT-DEL-02 (DT-60). La coordinación después de una entrega fallida se hace a mano por WhatsApp en la primera versión.<br>• Merma de reparto en el stock: FT-ALM-03. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido devuelto con un frappé | caja registra su destino «desecho» | queda una merma informativa sin movimiento de stock (RQ-DEL-03-08) |
| CA-2 | la configuración | el administrador cambia los intentos de 2 a 3 con Sí/No | la recomendación de volver sale al tercer intento (RQ-DEL-03-09) |
| CA-3 | la confirmación Sí/No de la acción | quien la hace responde «No» | no cambia nada y la pantalla queda como estaba (RN-CAP-015, RNF-CAP-012) |

Origen: criterios de verificación de FT-DEL-03 (RQ-DEL-03-08, RQ-DEL-03-09); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-126) Lo preparado y no entregado es merma informativa sin descontar stock otra vez.<br>**RNF aplicables:** RNF-CAP-002, RNF-CAP-009, RNF-CAP-010. | `ZonaReparto` (código, polígono de puntos, tarifa, activa) · `TarifaEspecialCliente` (fijo o porcentaje) · `AsignacionReparto` (pedido, repartidor, hora de toma, salida, entrega) · `IncidenteEntrega` (motivo, intento, hora) · `Coordinacion` (estado, cierre, recargo).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha; bloqueo en el servidor ante dos acciones simultáneas sobre el mismo registro. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-076** (Cerrar la coordinación de un pedido devuelto) va antes, dentro de la misma feature.<br>• FT-ALM-03.<br>• FT-CFG-02.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Administrativo ▸ Repartos (reportar), Pedidos y caja ▸ «En coordinación», Configuración ▸ Entregas fallidas (`Admin.dc.html`); `analisis/flujo-entregas-fallidas.md`.<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-DEL-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-010.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-DEL-03 (requerimientos RQ-DEL-03-08, RQ-DEL-03-09, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
