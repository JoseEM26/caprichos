---
id: HU-CAP-179
tipo: hu
titulo: "Validar cada pull request en el CI"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-01, RQ-PLA-01-04, RQ-PLA-01-09, RQ-PLA-01-10, HU-CAP-178, HU-CAP-180, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, R-01]
tags: [hu, plataforma, capa-a, ft-pla-01, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-179 | Título | Validar cada pull request en el CI |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-021 · FT-PLA-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD)** | que cada pull request pase lint, pruebas, la regla de dependencias, el build y Trivy | que ningún cambio roto llegue a main |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PLA-01 «Monorepo y publicación automática» (Debe tener, épica EP-CAP-021). Cubre los requerimientos: **RQ-PLA-01-04** Cada pull request corre lint, pruebas, la regla de dependencias entre módulos, el build y Trivy, y no se puede unir si algo falla. **RQ-PLA-01-09** El CI termina en menos de 10 minutos y el PR muestra qué paso falló. **RQ-PLA-01-10** Ningún PR se une a `main` sin una revisión registrada distinta del autor. | **Alcance.**<br>• Cada pull request corre lint, pruebas, la regla de dependencias entre módulos, el build y Trivy, y no se puede unir si algo falla.<br>• El CI termina en menos de 10 minutos y el PR muestra qué paso falló.<br>• Ningún PR se une a `main` sin una revisión registrada distinta del autor. |
| **Problema.** Publicar sin pasos manuales ni miedo: cada cambio llega probado y se puede deshacer. | **Fuera de alcance.**<br>• HU-CAP-178: Crear el monorepo y la base de la API.<br>• HU-CAP-180: Publicar en pruebas y en producción y volver atrás.<br>• Servidor y ambientes: FT-PLA-02.<br>• Revisión de dependencias e imágenes en el tiempo: FT-PLA-05. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un PR que importa una tabla de otro módulo | corre el CI | la regla de dependencias falla y GitHub no permite unirlo a `main` (RQ-PLA-01-04) |
| CA-2 | un PR con una prueba rota | termina el CI | el PR muestra en rojo el paso «pruebas» con el nombre de la prueba, y el CI completo tardó menos de 10 minutos (RQ-PLA-01-09) |
| CA-3 | un PR del autor | intenta unirlo sin revisión | la protección de la rama `main` lo impide hasta que quede una revisión aprobada (RQ-PLA-01-10) |

Origen: criterios de verificación de FT-PLA-01 (RQ-PLA-01-04, RQ-PLA-01-09, RQ-PLA-01-10); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-41) CI/CD con GitHub Actions, GHCR y Dokploy; producción con tag.<br>**RNF aplicables:** RNF-CAP-003, RNF-CAP-009, RNF-CAP-006. | Sin tablas de negocio. Archivos de infraestructura: `infra/ansible` (inventario y roles), `infra/docker` (compose de referencia), `.github/workflows` (ci, deploy-staging, deploy-prod), servicios de Dokploy por ambiente, repositorio de copias de restic, monitores de Uptime Kuma y proyectos de GlitchTip (ver `operacion/INV-CAP-001`).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • **HU-CAP-178** (Crear el monorepo y la base de la API) va antes, dentro de la misma feature.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PLA-01 (requerimientos RQ-PLA-01-04, RQ-PLA-01-09, RQ-PLA-01-10, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
