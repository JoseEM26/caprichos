---
id: HU-CAP-178
tipo: hu
titulo: "Crear el monorepo y la base de la API"
estado: draft
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: []
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-01, RQ-PLA-01-01, RQ-PLA-01-02, RQ-PLA-01-03, HU-CAP-179, HU-CAP-180, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DEP-02, R-01]
tags: [hu, plataforma, capa-a, ft-pla-01, alta]
---

# FORMATO DE HISTORIA DE USUARIO

| ID / Código | HU-CAP-178 | Título | Crear el monorepo y la base de la API |
|---|---|---|---|
| **Épica / Módulo** | EP-CAP-021 · FT-PLA-01 | **Sprint / Release** | H1 · piloto en el local · 28/12/2026 (supuesto, D-19) |

| Prioridad | Estado | Responsable | Estimación |
|---|---|---|---|
| Alta | Draft | José Ángel Espinoza (asignación propuesta, DT-07) | por estimar (Bloque 5) |

## 01 | NECESIDAD DEL USUARIO

| COMO | QUIERO | PARA |
|---|---|---|
| **Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD)** | tener el monorepo y la base de la API listos, con salud y versión | que cualquier persona levante el proyecto en local y que todas las épicas tengan dónde construirse |

## 02 | CONTEXTO Y ALCANCE

| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |
|---|---|
| **Contexto.** Historia de FT-PLA-01 «Monorepo y publicación automática» (Debe tener, épica EP-CAP-021). Cubre los requerimientos: **RQ-PLA-01-01** El repositorio es un monorepo pnpm con las carpetas de ADR-001 y `infra/`, y un README que explica cómo levantarlo en local. **RQ-PLA-01-02** La API arranca con su configuración por ambiente, Prisma, Redis, Socket.IO, registros JSON y GlitchTip. **RQ-PLA-01-03** La API expone `/salud` (base y Redis) y `/version` (versión y commit). | **Alcance.**<br>• El repositorio es un monorepo pnpm con las carpetas de ADR-001 y `infra/`, y un README que explica cómo levantarlo en local.<br>• La API arranca con su configuración por ambiente, Prisma, Redis, Socket.IO, registros JSON y GlitchTip.<br>• La API expone `/salud` (base y Redis) y `/version` (versión y commit). |
| **Problema.** Publicar sin pasos manuales ni miedo: cada cambio llega probado y se puede deshacer. | **Fuera de alcance.**<br>• HU-CAP-179: Validar cada pull request en el CI.<br>• HU-CAP-180: Publicar en pruebas y en producción y volver atrás.<br>• Servidor y ambientes: FT-PLA-02.<br>• Revisión de dependencias e imágenes en el tiempo: FT-PLA-05. |

## 03 | CRITERIOS DE ACEPTACIÓN

| N.° | DADO | CUANDO | ENTONCES |
|---|---|---|---|
| CA-1 | un equipo nuevo con Node y Docker | se clona el repositorio y se corre `pnpm install` y `docker compose up` | la API, la web, PostgreSQL y Redis quedan corriendo en local siguiendo solo el README (RQ-PLA-01-01) |
| CA-2 | la API en local | arranca | escribe un registro JSON de inicio con la versión y el ambiente, se conecta a la base y a Redis, y un error de prueba aparece en GlitchTip sin DNI ni teléfonos (RQ-PLA-01-02) |
| CA-3 | la API en pruebas | se apaga Redis | `/salud` responde 503 indicando qué falló; `/version` devuelve la versión y el commit desplegados (RQ-PLA-01-03) |

Origen: criterios de verificación de FT-PLA-01 (RQ-PLA-01-01, RQ-PLA-01-02, RQ-PLA-01-03); los criterios sin RQ salen de los RNF y reglas generales de la feature. Datos sintéticos.

## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS

| REGLAS DE NEGOCIO | DATOS Y VALIDACIONES |
|---|---|
| **RB-01** (DT-36) Monorepo con pnpm workspaces y `packages/compartido`.<br>**RB-02** (DT-37) Hexagonal ligero; reglas de dominio probadas sin base de datos.<br>**RNF aplicables:** RNF-CAP-003, RNF-CAP-009, RNF-CAP-006. | Sin tablas de negocio. Archivos de infraestructura: `infra/ansible` (inventario y roles), `infra/docker` (compose de referencia), `.github/workflows` (ci, deploy-staging, deploy-prod), servicios de Dokploy por ambiente, repositorio de copias de restic, monitores de Uptime Kuma y proyectos de GlitchTip (ver `operacion/INV-CAP-001`).<br>*(Entidades propuestas; detalle y tablas en `datos/DAT-CAP-001-modelo-de-datos.md`, se aprueba en G3.)*<br>**Validaciones:** cada cambio guarda autor y fecha. |
| **DEPENDENCIAS / RIESGOS** | **DISEÑO / ADJUNTOS** |
| • FT-PLA-04.<br>• **DEP-02** plataforma y hosting: propuestos en ADR-001 y ADR-011, pendientes de aprobación en G3.<br>• Riesgos: R-01 (roadmap PLT-01). | • Mockup: no aplica (proceso del sistema, sin pantalla propia).<br>• Contrato: `arquitectura/ARQ-CAP-002-catalogo-de-api-y-eventos.md` (borrador, G3).<br>• ADR (propuestos): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012. |

## 05 | CHECKLIST DE CALIDAD

| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |
|---|---|
| ☑ Valor y usuario claros | ☐ Código revisado y pruebas aprobadas — no hay código: no se construye antes de G3 y G4 |
| ☐ Criterios verificables — redactados en Dado/Cuando/Entonces; códigos de error por fijar con el contrato (G3) | ☐ Sin defectos críticos — nada construido que evaluar |
| ☐ Diseño/reglas disponibles — las reglas sí; falta aprobar ADR y contrato (G3) | ☐ Criterios cumplidos — sin ejecución |
| ☑ Dependencias identificadas | ☐ Evidencia y documentación actualizadas — sin evidencia de pruebas ni enlaces de G2/G3 |

**DoR: NO READY** hasta cerrar G2 y G3 (y con G0 y G1 aún sin aprobar).

Generado por IA: historia derivada de FT-PLA-01 (requerimientos RQ-PLA-01-01, RQ-PLA-01-02, RQ-PLA-01-03, reglas y RNF de la feature) y del mockup navegable — Revisado por: (pendiente)
