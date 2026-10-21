---
id: HU-CAP-189
tipo: hu
titulo: "Revisar la seguridad antes de salir y responder a una filtración"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-05, RQ-PLA-05-04, RQ-PLA-05-05, RQ-PLA-05-06, HU-CAP-188, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, R-01, R-11]
tags: [hu, plataforma, capa-a, ft-pla-05, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-189 | Título | Revisar la seguridad antes de salir y responder a una filtración |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-021 · FT-PLA-05 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD)** | revisar la seguridad antes de cada salida y responder a una filtración rotando claves | salir a producción sin huecos conocidos y saber qué hacer si se filtra una clave |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PLA-05 «Seguridad y mantenimiento» (Debe tener, épica EP-CAP-021). Cubre los requerimientos: **RQ-PLA-05-04** Antes de cada salida a producción se completa la revisión de seguridad SEC-CAP-001. **RQ-PLA-05-05** Rotar cualquier clave está escrito en RB-CAP-005 y no interrumpe la atención. **RQ-PLA-05-06** Ante una filtración se sigue el procedimiento de RB-CAP-005: contener, rotar, revisar el historial de acciones y avisar. | **Alcance.**<br>• Antes de cada salida a producción se completa la revisión de seguridad SEC-CAP-001.<br>• Rotar cualquier clave está escrito en RB-CAP-005 y no interrumpe la atención.<br>• Ante una filtración se sigue el procedimiento de RB-CAP-005: contener, rotar, revisar el historial de acciones y avisar. |
| **Problema.** Que una librería vieja o una clave filtrada no se convierta en un incidente con datos de clientes. | **Fuera de alcance.**<br>• HU-CAP-188: Mantener el sistema parchado y las dependencias al día.<br>• Pruebas de penetración contratadas a terceros (no previstas en el piloto). |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | el piloto H1 | se prepara la salida | SEC-CAP-001 tiene cada punto revisado con evidencia o con su pendiente aceptado (RQ-PLA-05-04) |
| CA-2 | la clave de OpenAI expuesta | se sigue RB-CAP-005 | se genera una nueva, se cambia en Dokploy, se reinicia el servicio y la vieja se revoca en menos de 30 minutos (RQ-PLA-05-05) |
| CA-3 | una sospecha de acceso indebido | se sigue el procedimiento | se revocan sesiones y claves, se revisa el Historial de acciones y se evalúa si hay que avisar a los afectados (Ley 29733) (RQ-PLA-05-06) |

Origen: criterios de verificación de FT-PLA-05 (RQ-PLA-05-04, RQ-PLA-05-05, RQ-PLA-05-06); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-43) Secretos fuera del repositorio.<br>**RB-02** (ADR-005) Datos personales (Ley 29733).<br>**RNF aplicables:** RNF-CAP-006, RNF-CAP-007, RNF-CAP-008. | Sin tablas de negocio. Archivos de infraestructura: `infra/ansible` (inventario y roles), `infra/docker` (compose de referencia), `.github/workflows` (ci, deploy-staging, deploy-prod), servicios de Dokploy por ambiente, repositorio de copias de restic, monitores de Uptime Kuma y proyectos de GlitchTip (ver `operacion/INV-CAP-001`).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-188** (Mantener el sistema parchado y las dependencias al día) va antes, dentro de la misma feature.<br>• operacion/SEC-CAP-001.<br>• operacion/RB-CAP-005.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01, R-11 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PLA-05 (requerimientos RQ-PLA-05-04, RQ-PLA-05-05, RQ-PLA-05-06, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
