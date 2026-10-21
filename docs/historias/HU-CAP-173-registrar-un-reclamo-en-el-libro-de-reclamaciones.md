---
id: HU-CAP-173
tipo: hu
titulo: "Registrar un reclamo en el Libro de Reclamaciones"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-020, FT-LEG-02, RQ-LEG-02-01, RQ-LEG-02-02, HU-CAP-174, HU-CAP-175, ADR-001, ADR-011, ADR-014, ADR-004, ADR-005, D-06, DEP-02, DEP-06, DEP-09, R-01]
tags: [hu, legal, capa-a, ft-leg-02, alta, ui]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-173 | Título | Registrar un reclamo en el Libro de Reclamaciones |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-020 · FT-LEG-02 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **ACT-CAP-006** Clientes | registrar un reclamo en el Libro de Reclamaciones | dejar constancia de un reclamo como manda la ley |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-LEG-02 «Libro de Reclamaciones, términos y privacidad» (Debe tener, épica EP-CAP-020). Cubre los requerimientos: **RQ-LEG-02-01** El cliente registra un reclamo o queja con sus datos, el detalle y su pedido. **RQ-LEG-02-02** El cliente recibe una constancia con número y fecha. | **Alcance.**<br>• El cliente registra un reclamo o queja con sus datos, el detalle y su pedido.<br>• El cliente recibe una constancia con número y fecha. |
| **Problema.** Cumplir obligaciones legales del consumidor y de datos personales antes de abrir la carta al público. | **Fuera de alcance.**<br>• HU-CAP-174: Responder reclamos en el administrativo.<br>• HU-CAP-175: Aceptar el aviso de privacidad.<br>• Atención de derechos ARCO desde el sistema (se define en ADR-005).<br>• Registro del banco de datos ante la autoridad (trámite fuera del sistema). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el formulario | el cliente completa nombre, DNI, domicilio, contacto y detalle | se guarda y recibe la constancia con número (RQ-LEG-02-01) |
| CA-2 | un reclamo guardado | termina | ve y puede descargar su constancia (RQ-LEG-02-02) |

Origen: criterios de verificación de FT-LEG-02 (RQ-LEG-02-01, RQ-LEG-02-02); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (D-06) Texto y plazo del Libro de Reclamaciones.<br>**RNF aplicables:** RNF-CAP-008, RNF-CAP-014, RNF-CAP-009. | `Comprobante` (tipo nota, boleta o factura, número, DNI o RUC, razón social, por emitir) · `Reclamo` (datos del consumidor, detalle, pedido, número, plazo, respuesta) · `Aceptacion` (titular, texto aceptado, versión, fecha).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); cada cambio guarda autor y fecha; datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • DEP-09 (D-06).<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• **DEP-06** mockup en Figma o aceptación del mockup navegable como diseño (G2).<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup en Figma: (pendiente UX — G2, DEP-06).<br>• Referencia mientras tanto: mockup navegable (DT-04), Carta ▸ Libro de Reclamaciones, términos, privacidad; administrativo ▸ Reclamos (`Main.dc.html`, `Admin.dc.html`).<br>• Contrato de API: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md`, módulo de FT-LEG-02 (borrador, se aprueba en G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-004, ADR-005.<br>• Modelo de datos: `datos/DAT-CAP-001-modelo-de-datos.md`. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; dependen de decisiones abiertas D-06 | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta el mockup (DEP-06, G2) y aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-LEG-02 (requerimientos RQ-LEG-02-01, RQ-LEG-02-02, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
