---
id: FT-PLA-01
tipo: spec
titulo: "Monorepo y publicación automática"
estado: approved
producto: caprichos
version: "1.0"
owner: "José Ángel Espinoza"
aprobadores: ["José Ángel Espinoza (Product Owner)", "Kevin Rosales (Stakeholder)", "José Ángel Espinoza (Technical Lead)"]
fecha: 2026-10-20
relacionados: [EP-CAP-021, FT-PLA-02, FT-PLA-05, ADR-001, ADR-011, ADR-014, ADR-003, ADR-012, DT-36, DT-37, DT-41, RNF-CAP-003]
tags: [plataforma, plt-03, ep-cap-021, ft-pla-01, debe-tener]
---

# FT-PLA-01 — Monorepo y publicación automática

**PLT-03 · Feature · Catálogo de requerimientos** · Frente PLATAFORMA · Caprichos · ticket *(pendiente — R13, D-14)*

| ID FEATURE | NOMBRE | ÉPICA PADRE |
|---|---|---|
| FT-PLA-01 | Monorepo y publicación automática | EP-CAP-021 Plataforma, despliegue y operación |
| **PRODUCT OWNER** | **PRIORIDAD** | **ESTADO** |
| José Ángel Espinoza (DT-48) | **Debe tener** (DT-36 · DT-41 · ADR-001) | Refinamiento |
| **RELEASE OBJETIVO** | **ESTIMACIÓN (T-SHIRT)** | **FECHA / VERSIÓN** |
| H1 · piloto en el local · 28/12/2026 (supuesto, D-19) | (por estimar: desarrollo) | 2026-10-20 · v1.0 |

## 1. Descripción y valor

**Descripción.** El código vive en un **monorepo con pnpm** (`apps/api`, `apps/web`, `apps/agente-local`, `packages/compartido`, `infra/`) y la API nace con su base: configuración por ambiente, Prisma, Redis, Socket.IO, registros JSON con pino, GlitchTip, y los endpoints `/salud` y `/version` (DT-36, DT-37). Cada **pull request** pasa lint, pruebas, la regla de dependencias entre módulos, el build y la revisión de imágenes con Trivy. Al unir a `main`, GitHub Actions construye las imágenes, las sube a **GHCR**, corre las migraciones de Prisma y **publica en pruebas**. **Producción** se publica con un tag `vX.Y.Z` (Conventional Commits) y se puede **volver a la versión anterior** con un paso, siguiendo `operacion/RB-CAP-001` (DT-41, ADR-011).

**Beneficio esperado.** Publicar sin pasos manuales ni miedo: cada cambio llega probado y se puede deshacer. Hipótesis medible: **100 % de las publicaciones a producción desde un tag con CI en verde**; **vuelta atrás en menos de 10 minutos** (propuesta).

**Usuarios / roles.** Equipo de desarrollo y operación (hoy José Ángel Espinoza, DT-07; aún sin código ACT en el BRD) (escribe, revisa y publica).

**Pantallas de referencia.** No tiene pantallas de negocio: se opera desde GitHub, el panel de Dokploy, Uptime Kuma y GlitchTip (mockup navegable, DT-04; no reemplaza al G2, DEP-06).

## 2. Catálogo de requerimientos funcionales

| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |
| --- | --- | --- | --- | --- | --- |
| RQ-PLA-01-01 | El repositorio es un monorepo pnpm con las carpetas de ADR-001 y `infra/`, y un README que explica cómo levantarlo en local. | Debe tener | DT-36 · ADR-001 | Dado un equipo nuevo con Node y Docker, cuando se clona el repositorio y se corre `pnpm install` y `docker compose up`, entonces la API, la web, PostgreSQL y Redis quedan corriendo en local siguiendo solo el README. | Propuesto |
| RQ-PLA-01-02 | La API arranca con su configuración por ambiente, Prisma, Redis, Socket.IO, registros JSON y GlitchTip. | Debe tener | DT-37 · DT-45 · DT-46 | Dada la API en local, cuando arranca, entonces escribe un registro JSON de inicio con la versión y el ambiente, se conecta a la base y a Redis, y un error de prueba aparece en GlitchTip sin DNI ni teléfonos. | Propuesto |
| RQ-PLA-01-03 | La API expone `/salud` (base y Redis) y `/version` (versión y commit). | Debe tener | DT-44 · RNF-CAP-003 | Dada la API en pruebas, cuando se apaga Redis, entonces `/salud` responde 503 indicando qué falló; `/version` devuelve la versión y el commit desplegados. | Propuesto |
| RQ-PLA-01-04 | Cada pull request corre lint, pruebas, la regla de dependencias entre módulos, el build y Trivy, y no se puede unir si algo falla. | Debe tener | DT-41 · DT-47 · ADR-001 | Dado un PR que importa una tabla de otro módulo, cuando corre el CI, entonces la regla de dependencias falla y GitHub no permite unirlo a `main`. | Propuesto |
| RQ-PLA-01-05 | Al unir a `main` se construyen las imágenes, se suben a GHCR, corren las migraciones y se publica en pruebas. | Debe tener | DT-41 | Dado un PR aprobado y unido a `main`, cuando termina el flujo, entonces `staging.caprichos.pe/version` muestra el commit nuevo sin pasos manuales. | Propuesto |
| RQ-PLA-01-06 | Producción se publica solo con un tag `vX.Y.Z` y deja registro de quién y qué se publicó. | Debe tener | DT-41 · RN-CAP-015 | Dado un tag `v0.3.0`, cuando se publica, entonces producción muestra `v0.3.0` en `/version` y el historial de Dokploy registra la publicación; un push a `main` sin tag no toca producción. | Propuesto |
| RQ-PLA-01-07 | Una publicación se puede volver atrás a la versión anterior siguiendo el runbook RB-CAP-001. | Debe tener | ADR-011 · DT-51 | Dada `v0.3.0` con un error grave, cuando se sigue RB-CAP-001, entonces producción vuelve a `v0.2.x` en menos de 10 minutos y las migraciones aplicadas siguen siendo compatibles (expandir antes de contraer). | Propuesto |
| RQ-PLA-01-08 | Las migraciones de base de datos son compatibles hacia atrás: primero se agrega, después se quita. | Debe tener | ADR-003 | Dada una columna que se renombra, cuando se publica, entonces primero se agrega la nueva y se copian los datos, y la vieja se quita en una versión posterior. | Propuesto |
| RQ-PLA-01-09 | El CI termina en menos de 10 minutos y el PR muestra qué paso falló. | Debería tener | DT-41 | Dado un PR con una prueba rota, cuando termina el CI, entonces el PR muestra en rojo el paso «pruebas» con el nombre de la prueba, y el CI completo tardó menos de 10 minutos. | Propuesto |
| RQ-PLA-01-10 | Ningún PR se une a `main` sin una revisión registrada distinta del autor. | Debe tener | Marco Aybar (nadie se autoaprueba) | Dado un PR del autor, cuando intenta unirlo sin revisión, entonces la protección de la rama `main` lo impide hasta que quede una revisión aprobada. | Propuesto |

Prioridad *Debe tener*: es la primera ola de construcción; sin esto ninguna épica de negocio se puede publicar. Todos nacen *Propuesto* hasta que el PO los apruebe (DT-48).

## 3. Requerimientos no funcionales

| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |
| --- | --- | --- | --- | --- |
| RNF-CAP-003 | Disponibilidad | La carta, el administrativo y el chatbot están en línea durante el horario de atención. | ≥ 99,5 % mensual en horario · medición: monitoreo externo (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-009 | Auditoría | Toda acción que cambia datos guarda quién la hizo y cuándo. | 100 % de cambios con autor y fecha (umbral propuesto) | Debe tener (hereda de la feature) |
| RNF-CAP-006 | Seguridad | Cada acción se autoriza en el servidor según el rol, no solo ocultando botones. | 0 accesos a módulos o datos fuera del rol · prueba con un usuario por rol (umbral propuesto) | Debe tener (hereda de la feature) |

El BRD deja los RNF por definir (BRD §2); estos `RNF-CAP-###` son un catálogo propuesto para el paquete, con umbrales por confirmar en G3. RNF-CAP-003 depende de que una publicación mala se pueda deshacer rápido; RNF-CAP-009 de que quede registro de cada publicación.

## 4. Reglas de negocio

| ID | Regla | Fuente |
| --- | --- | --- |
| DT-36 | Monorepo con pnpm workspaces y `packages/compartido`. | decisiones.md |
| DT-41 | CI/CD con GitHub Actions, GHCR y Dokploy; producción con tag. | decisiones.md |
| DT-37 | Hexagonal ligero; reglas de dominio probadas sin base de datos. | decisiones.md |
| ADR-003 | Migraciones revisadas: expandir antes de contraer. | ADR-003 |

## 5. Trazabilidad y planificación

| Requerimiento | Historias de usuario | Dependencia | Riesgo |
| --- | --- | --- | --- |
| RQ-PLA-01-01 | HU-CAP-178 | — | R-01 |
| RQ-PLA-01-02 | HU-CAP-178 | — | R-01 |
| RQ-PLA-01-03 | HU-CAP-178 | FT-PLA-04 | R-01 |
| RQ-PLA-01-04 | HU-CAP-179 | — | R-01 |
| RQ-PLA-01-05 | HU-CAP-180 | FT-PLA-02 | R-01 |
| RQ-PLA-01-06 | HU-CAP-180 | FT-PLA-02 | R-01 |
| RQ-PLA-01-07 | HU-CAP-180 | operacion/RB-CAP-001 | R-01 |
| RQ-PLA-01-08 | HU-CAP-180 | — | R-01 |
| RQ-PLA-01-09 | HU-CAP-179 | — | R-01 |
| RQ-PLA-01-10 | HU-CAP-179 | — | R-01 |

Historias de usuario de esta feature (en `historias/`, en draft):

- HU-CAP-178 Crear el monorepo y la base de la API
- HU-CAP-179 Validar cada pull request en el CI
- HU-CAP-180 Publicar en pruebas y en producción y volver atrás

Decisiones técnicas que la rigen (ADR propuestos, G3): ADR-001, ADR-011, ADR-014, ADR-003, ADR-012.

**Fuera de alcance**

- Servidor y ambientes: FT-PLA-02.
- Revisión de dependencias e imágenes en el tiempo: FT-PLA-05.

**Preguntas abiertas**

1. **¿Quién revisa los PR si solo hay un desarrollador?** El marco pide revisor distinto del autor; propuesta: revisión asistida por IA más una revisión humana semanal (pendiente).

---

Generado por IA: DT-36, DT-37, DT-41, ADR-001, ADR-003, ADR-011 y DT-51 — Revisado por: *(pendiente)*
