---
id: HU-CAP-180
tipo: hu
titulo: "Publicar en pruebas y en producción y volver atrás"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-01, RQ-PLA-01-05, RQ-PLA-01-06, RQ-PLA-01-07, RQ-PLA-01-08, HU-CAP-178, HU-CAP-179, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, R-01]
tags: [hu, plataforma, capa-a, ft-pla-01, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-180 | Título | Publicar en pruebas y en producción y volver atrás |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-021 · FT-PLA-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD)** | publicar en pruebas al unir a main, en producción con un tag, y volver atrás con el runbook | publicar sin pasos manuales y deshacer una versión mala en minutos |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PLA-01 «Monorepo y publicación automática» (Debe tener, épica EP-CAP-021). Cubre los requerimientos: **RQ-PLA-01-05** Al unir a `main` se construyen las imágenes, se suben a GHCR, corren las migraciones y se publica en pruebas. **RQ-PLA-01-06** Producción se publica solo con un tag `vX.Y.Z` y deja registro de quién y qué se publicó. **RQ-PLA-01-07** Una publicación se puede volver atrás a la versión anterior siguiendo el runbook RB-CAP-001. **RQ-PLA-01-08** Las migraciones de base de datos son compatibles hacia atrás: primero se agrega, después se quita. | **Alcance.**<br>• Al unir a `main` se construyen las imágenes, se suben a GHCR, corren las migraciones y se publica en pruebas.<br>• Producción se publica solo con un tag `vX.Y.Z` y deja registro de quién y qué se publicó.<br>• Una publicación se puede volver atrás a la versión anterior siguiendo el runbook RB-CAP-001.<br>• Las migraciones de base de datos son compatibles hacia atrás: primero se agrega, después se quita. |
| **Problema.** Publicar sin pasos manuales ni miedo: cada cambio llega probado y se puede deshacer. | **Fuera de alcance.**<br>• HU-CAP-178: Crear el monorepo y la base de la API.<br>• HU-CAP-179: Validar cada pull request en el CI.<br>• Servidor y ambientes: FT-PLA-02.<br>• Revisión de dependencias e imágenes en el tiempo: FT-PLA-05. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un PR aprobado y unido a `main` | termina el flujo | `staging.caprichos.pe/version` muestra el commit nuevo sin pasos manuales (RQ-PLA-01-05) |
| CA-2 | un tag `v0.3.0` | se publica | producción muestra `v0.3.0` en `/version` y el historial de Dokploy registra la publicación; un push a `main` sin tag no toca producción (RQ-PLA-01-06) |
| CA-3 | `v0.3.0` con un error grave | se sigue RB-CAP-001 | producción vuelve a `v0.2.x` en menos de 10 minutos y las migraciones aplicadas siguen siendo compatibles (expandir antes de contraer) (RQ-PLA-01-07) |
| CA-4 | una columna que se renombra | se publica | primero se agrega la nueva y se copian los datos, y la vieja se quita en una versión posterior (RQ-PLA-01-08) |

Origen: criterios de verificación de FT-PLA-01 (RQ-PLA-01-05, RQ-PLA-01-06, RQ-PLA-01-07, RQ-PLA-01-08); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-41) CI/CD con GitHub Actions, GHCR y Dokploy; producción con tag.<br>**RB-02** (ADR-003) Migraciones revisadas: expandir antes de contraer.<br>**RNF aplicables:** RNF-CAP-003, RNF-CAP-009, RNF-CAP-006. | Sin tablas de negocio. Archivos de infraestructura: `infra/ansible` (inventario y roles), `infra/docker` (compose de referencia), `.github/workflows` (ci, deploy-staging, deploy-prod), servicios de Dokploy por ambiente, repositorio de copias de restic, monitores de Uptime Kuma y proyectos de GlitchTip (ver `operacion/INV-CAP-001`).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-179** (Validar cada pull request en el CI) va antes, dentro de la misma feature.<br>• FT-PLA-02.<br>• operacion/RB-CAP-001.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PLA-01 (requerimientos RQ-PLA-01-05, RQ-PLA-01-06, RQ-PLA-01-07, RQ-PLA-01-08, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
