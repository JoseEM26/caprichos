---
id: HU-CAP-142
tipo: hu
titulo: "Responder la encuesta posventa"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-015, FT-ATN-03, RQ-ATN-03-01, RQ-ATN-03-02, RQ-ATN-03-05, HU-CAP-143, ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009, DEP-02, DEP-06, DEP-12, R-01, R-04]
tags: [hu, atencion, capa-a, ft-atn-03, baja, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-142 | Título | Responder la encuesta posventa |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-015 · FT-ATN-03 | **Sprint / Release** | H2 · 01/03/2027 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Baja | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | responder la encuesta posventa | contar cómo me fue con mi pedido |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-ATN-03 «Encuesta posventa y quejas» (Podría tener, épica EP-CAP-015). Cubre los requerimientos: **RQ-ATN-03-01** A las 2 horas de entregado, el bot envía la encuesta. **RQ-ATN-03-02** Una respuesta positiva invita a opinar en Google Maps. **RQ-ATN-03-05** Un cliente recibe como máximo una encuesta por día. | **Alcance.**<br>• A las 2 horas de entregado, el bot envía la encuesta.<br>• Una respuesta positiva invita a opinar en Google Maps.<br>• Un cliente recibe como máximo una encuesta por día. |
| **Problema.** Más opiniones positivas públicas y quejas atendidas antes de que escalen. | **Fuera de alcance.**<br>• HU-CAP-143: Atender una opinión negativa.<br>• Formulario «¿Cómo te fue?» de la carta: FT-CAR-03.<br>• Reseñas públicas en la carta (descartadas, DT-13). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un pedido entregado a las 15:00 | son las 17:00 | el cliente recibe la encuesta con botones de 1 a 5 (RQ-ATN-03-01) |
| CA-2 | un 5 | el cliente responde | recibe el agradecimiento y el enlace de Google Maps del local (RQ-ATN-03-02) |
| CA-3 | un cliente con dos pedidos el mismo día | se entregan | recibe una sola encuesta (RQ-ATN-03-05) |

Origen: criterios de verificación de FT-ATN-03 (RQ-ATN-03-01, RQ-ATN-03-02, RQ-ATN-03-05); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (RN-CAP-042) Positiva a Google Maps; negativa a una persona con aviso a gerencia.<br>**RNF aplicables:** RNF-CAP-015, RNF-CAP-008. | `Conversacion` (dueño, tomado por, desde, urgente, atendido) · `RespuestaRapida` · `SolicitudCambio` (pedido, tipo, estado, decisión) · `Encuesta` (pedido, nota, comentario, derivada).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • DEP-12.<br>• FT-CFG-01.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-04, R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Chatbot ▸ encuesta; Configuración del local ▸ Encuesta posventa (`Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-ATN-03 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-006, ADR-007, ADR-009.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-ATN-03 (requerimientos RQ-ATN-03-01, RQ-ATN-03-02, RQ-ATN-03-05, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
