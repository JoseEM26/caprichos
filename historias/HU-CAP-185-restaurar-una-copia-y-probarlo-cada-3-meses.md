---
id: HU-CAP-185
tipo: hu
titulo: "Restaurar una copia y probarlo cada 3 meses"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-03, RQ-PLA-03-05, RQ-PLA-03-06, RQ-PLA-03-07, HU-CAP-184, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, R-01]
tags: [hu, plataforma, capa-a, ft-pla-03, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-185 | Título | Restaurar una copia y probarlo cada 3 meses |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-021 · FT-PLA-03 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD)** | restaurar una copia siguiendo el runbook y probarlo cada 3 meses | recuperar el sistema en menos de una hora cuando haga falta |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PLA-03 «Copias y recuperación» (Debe tener, épica EP-CAP-021). Cubre los requerimientos: **RQ-PLA-03-05** Restaurar la base y las carpetas está escrito paso a paso en RB-CAP-002. **RQ-PLA-03-06** Cada 3 meses se prueba restaurar la copia del día en pruebas y se anota el tiempo. **RQ-PLA-03-07** Se puede recuperar un solo dato borrado por error sin restaurar todo el sistema. | **Alcance.**<br>• Restaurar la base y las carpetas está escrito paso a paso en RB-CAP-002.<br>• Cada 3 meses se prueba restaurar la copia del día en pruebas y se anota el tiempo.<br>• Se puede recuperar un solo dato borrado por error sin restaurar todo el sistema. |
| **Problema.** No perder pedidos, cobros ni fotos aunque falle el proveedor o se borre algo por error. | **Fuera de alcance.**<br>• HU-CAP-184: Hacer la copia diaria cifrada fuera del VPS.<br>• Snapshot y Auto Backup del proveedor (se suman, no reemplazan).<br>• Copia de los registros de vigilancia. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | RB-CAP-002 | lo sigue alguien distinto de quien lo escribió | logra restaurar en pruebas sin pedir ayuda (RQ-PLA-03-05) |
| CA-2 | el primer lunes del trimestre | se restaura la copia del día en pruebas | los pedidos y cobros del día anterior aparecen completos y el tiempo total queda anotado (meta: menos de 1 hora) (RQ-PLA-03-06) |
| CA-3 | un producto borrado por error ayer | se restaura la copia en una base aparte | se copia solo ese registro a producción y el resto no cambia (RQ-PLA-03-07) |

Origen: criterios de verificación de FT-PLA-03 (RQ-PLA-03-05, RQ-PLA-03-06, RQ-PLA-03-07); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-47) Prueba de restauración cada 3 meses.<br>**RNF aplicables:** RNF-CAP-003, RNF-CAP-008, RNF-CAP-014. | Sin tablas de negocio. Archivos de infraestructura: `infra/ansible` (inventario y roles), `infra/docker` (compose de referencia), `.github/workflows` (ci, deploy-staging, deploy-prod), servicios de Dokploy por ambiente, repositorio de copias de restic, monitores de Uptime Kuma y proyectos de GlitchTip (ver `operacion/INV-CAP-001`).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** sin borrado físico: se desactiva o anula (RN-CAP-014); datos personales solo con aceptación registrada. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-184** (Hacer la copia diaria cifrada fuera del VPS) va antes, dentro de la misma feature.<br>• operacion/RB-CAP-002.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PLA-03 (requerimientos RQ-PLA-03-05, RQ-PLA-03-06, RQ-PLA-03-07, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
