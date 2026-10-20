---
name: aybar-generar-documento
description: Use cuando hay que crear o corregir un documento del paquete de análisis y diseño Aybar - ADR, Historia de Usuario (formato HU Aybar), Feature PLT-03, Épica PLT-02, DoR PLT-05, ficha de intake, BRD, roadmap, plan de pruebas, JSON de tareas o paquete de envío de gate. Fija el frontmatter, las secciones obligatorias en su orden y las reglas de trazabilidad. Para saber QUÉ documento toca después, usar primero aybar-siguiente-paso. Para runbooks, planes de release, revisiones de seguridad e inventario de infraestructura usar `aybar-devops-operacion`.
---

# Aybar · generar un documento del paquete

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.**
> 1. Crea **un solo** documento (o una sola sección si es muy largo) y **detente**.
> 2. Muéstraselo al usuario y espera su visto bueno explícito. Si pide cambios, corrige ese mismo documento.
> 3. Solo con su aprobación pasa al siguiente, empezando por el primero de la cadena (intake → BRD → épica/feature → diseño → ADR → HU → DoR → tareas).
> 4. **Nunca generes varios documentos, carpetas o copias de golpe**, ni reorganices el paquete, sin que el usuario lo haya pedido paso a paso. Tampoco delegues la creación en masa a otros agentes.
> 5. Si el trabajo toca archivos existentes, pregunta antes: no muevas, copies ni borres por tu cuenta.

Antes de escribir: corre `aybar-siguiente-paso` (qué falta) y lee `analisis/decisiones.md` (si un documento lo contradice, manda el registro). Copia la estructura de un documento hermano ya existente del mismo tipo (p. ej. `adr/ADR-021-*.md`, `historias/HU-IDN-056-*.md`): el paquete es la mejor plantilla.

## Dónde va cada documento (estructura fija, igual que `Roles y permisos`)

El ejemplo de referencia es la carpeta `Roles y permisos`. **Todo proyecto nuevo usa exactamente estas carpetas, con estos nombres, sin subcarpetas** (salvo `backlog/tareas` y `gates/<ticket>`). Nada va suelto en la raíz salvo `README.md` y `VARIABLES.md`.

| Orden | Carpeta | Qué va dentro | Gate | Skill |
|---|---|---|---|---|
| 1 | `analisis/` | ficha de intake, BRD, registro de decisiones, AS-IS | G0 · G1 | `aybar-intake-brd`, `aybar-roadmap-registro` |
| 2 | `roadmap/` | PLT-01 roadmap | G1 | `aybar-roadmap-registro` |
| 3 | `epicas/` | épicas PLT-02 | G1 | `aybar-epica` |
| 4 | `features/` | features PLT-03 | G1 · G4 | `aybar-feature` |
| 5 | `arquitectura/` | arquitectura técnica, contrato OpenAPI | G3 | *(sin skill aún)* |
| 6 | `datos/` | modelo de datos, estados, flujos, diccionario | G3 | *(sin skill aún)* |
| 7 | `adr/` | decisiones de arquitectura | G3 | `aybar-adr` |
| 8 | `historias/` | historias de usuario | G4 | `aybar-historia-usuario` |
| 9 | `dor/` | Definition of Ready, uno por feature | G4 | `aybar-dor` |
| 10 | `backlog/tareas/` | un JSON de tareas por épica | G4 | `aybar-tareas-json` |
| 11 | `pruebas/` | plan de pruebas | G4 | `aybar-plan-pruebas` |
| 12 | `gates/<ticket>/` | G0.md a G4.md | G0–G4 | `aybar-gate` |
| 13 | `skills/` | copias selladas de las skills del SDK | — | *(solo se copian)* |
| 14 | `presentacion/` | HTML de presentación y explorador | — | *(sin skill aún)* |

Reglas de carpeta:
1. **Crea la carpeta con su nombre exacto solo cuando guardes el primer documento de ese tipo**; no pre-crees la estructura vacía.
2. El orden de la tabla es el orden de lectura y de trabajo: se avanza por gates (G0 → G4) y, dentro de cada gate, un documento a la vez con aprobación del usuario.
3. No inventes carpetas nuevas ni subcarpetas. Si un documento no encaja en ninguna, pregunta al usuario.

## Reglas comunes (todos los tipos)

1. **Frontmatter obligatorio**, en este orden: `id, tipo, titulo, estado, producto, version, owner, aprobadores, fecha, relacionados, tags`. `estado` siempre `draft` al crear; `aprobadores: []`; `owner` vacío con su decisión pendiente si no hay nombre. La IA nunca escribe `approved`.
2. **Secciones del formato, en su orden, sin agregar ninguna** (R11). Lo que el formato no tiene va en otro archivo.
3. **Todo en Markdown**; diagramas en Mermaid; datos estructurados en JSON (R10).
4. **Lo que no está en una fuente no se escribe como hecho.** Campo sin fuente → vacío + la decisión pendiente (`D-xx`, `O-xx`) que lo llenará.
5. **Trazabilidad de IA** al pie o bajo el título: `Generado por IA: <qué> — Revisado por: (pendiente)`.
6. **Ticket** (R13) en `relacionados` (p. ej. `AYB-1042`). Ids con formato fijo: `ADR-###`, `EP-<DOM>-###`, `FT-<AREA>-##`, `HU-<DOM>-###`.
7. **Cada id citado debe existir.** Tras escribir, corre `python3 -I .claude/skills/aybar-siguiente-paso/scripts/estado.py <paquete>` y corrige lo que reporte.
8. Los nombres de PO, Sponsor, Stakeholder, QA y UX no bloquean: las casillas de firma quedan vacías (R16).

## Por tipo

| Tipo | Archivo | Secciones obligatorias, en orden | Gate |
|---|---|---|---|
| **ADR** (T-ADR) | `adr/ADR-###-<slug>.md` | `# ADR-###: título` · Estado/Ticket/Fecha/**Compatibilidad con M0** · `## Contexto` · `## Opciones evaluadas` · `## Decisión` · `## Consecuencias` · `## Datos` (puerta F4 de Gobierno de Datos, si toca datos) | G3 |
| **Historia** | `historias/HU-<DOM>-###-<slug>.md` | `# FORMATO DE HISTORIA DE USUARIO` + cabecera (ID, título, **épica/módulo con EP y FT**, sprint/release, prioridad, estado, responsable, estimación) · `## 01 NECESIDAD DEL USUARIO` (COMO/QUIERO/PARA) · `## 02 CONTEXTO Y ALCANCE` (problema, alcance, fuera de alcance) · `## 03 CRITERIOS DE ACEPTACIÓN` (tabla N.° / DADO / CUANDO / ENTONCES) · `## 04 REGLAS, DEPENDENCIAS Y EVIDENCIAS` (enlace Figma si hay pantalla) · `## 05 CHECKLIST DE CALIDAD` (DoR y DoD) | G4 |
| **Feature** (PLT-03) | `features/FT-<AREA>-##-<slug>.md` | cabecera (ID, nombre, épica padre, PO, prioridad, estado, release, estimación T-shirt) · `## 1 Descripción y valor` · `## 2 Catálogo de requerimientos funcionales` (RF con prioridad, origen, criterio de verificación, estado) · `## 3 Requerimientos no funcionales` (métrica y umbral) · `## 4 Reglas de negocio` · `## 5 Trazabilidad y planificación` (RF → HU, dependencias, riesgos, fuera de alcance, preguntas abiertas) | G1 · G4 |
| **Épica** (PLT-02) | `epicas/EP-<DOM>-###-<slug>.md` | `## 1 CONTEXTO` (problema, usuarios, evidencia, alineamiento) · `## 2 OBJETIVOS` (KPI, línea base, meta, fuente, frecuencia) · `## 3 ALCANCE` (in/out, features, supuestos, restricciones, dependencias, criterios de éxito) · `## 4 APROBACIONES` (PO, Sponsor, Líder técnico) | G1 |
| **DoR** (PLT-05) | `dor/DOR-<FT-id>-<slug>.md` — **uno por feature**, el nombre empieza por `DOR-` + id de la feature | `## 1 CHECKLIST DE PREPARACIÓN` (negocio, funcional, diseño/UX, técnico, calidad) · `## 2 DIAGRAMA DE DEPENDENCIAS` · `## 3 MODELADO` (ER, flujo, estados, diccionario) · `## 4 DIAGRAMA DE ARQUITECTURA` (C4) · `## 5 RIESGOS` · `## 6 DECISIÓN Y APROBACIÓN` (firmas PO, TL, QA, UX). Resultado propuesto por la IA: READY / READY CON CONDICIONES / NO READY; **lo decide el PO** | G4 |
| **Intake** (T-INTAKE) | `analisis/ficha-intake.md` | solicitante, problema, valor esperado | G0 |
| **BRD** (R12) | `analisis/BRD.md` | 1 Problema · 2 Objetivos medibles · 3 Stakeholders · 4 Alcance · 5 Reglas de negocio · 6 Criterios iniciales · 7 Riesgos y supuestos · 8 Firmas | G1 |
| **Roadmap** (PLT-01) | `roadmap/PLT-01-roadmap.md` | 1 Roadmap · 2 Dependencias · 3 Riesgos (matriz, supuestos, restricciones) · 4 Control de versiones y aprobación | G1 |
| **Plan de pruebas** (T-TEST-PLAN) | `pruebas/test-plan.md` | ciclos · casos (uno por criterio de cada HU de capa A) · adversariales · performance · regresión · anexo HU → casos | G4 |
| **Tareas** | `backlog/tareas/EP-<DOM>-###.json` — un archivo por épica | ver abajo | G4 |
| **Gate** | `gates/<ticket>/Gn.md` | 1 Correo de formalización (de, para, fecha, asunto `[Gn] · …`, pedido, adjunto) · 2 Identificación del cambio (ticket, tipo T3, aprobador, qué bloquea) · 3 Evidencias críticas (evidencia / qué debe contener / enlace al commit / ¿cumple?) · firmas | G0-G4 |

### JSON de tareas

```json
{ "epica": "EP-IDN-005", "generado_por_ia": true, "revisado_por": null,
  "historias": [ { "hu": "HU-IDN-010", "tareas": [
    { "id": "HU-IDN-010-T01", "titulo": "…", "capa": "docs|backend|…",
      "actividad": "ANALISIS|DISENO|…", "responsable": "…",
      "estimacion_horas": null, "depende_de": [] } ] } ] }
```
Toda HU del paquete aparece en el JSON de su épica; `depende_de` solo apunta a ids que existen; `estimacion_horas` queda `null` hasta que lo estime el equipo.

## Alineación con las skills del SDK (para ADR y DoR técnicos)

Las skills `aybar-starter-*` son copias selladas del SDK y asumen un servicio común (AWS, Keycloak, Kafka, Mongo). Cuando un ADR o DoR toque la plataforma, **declara la desviación** en vez de ignorarla: qué starter se usa, cuál se apaga o se rearma y por qué (modelo: `adr/ADR-020-starters-del-sdk-del-servicio.md`). Ejemplos de lo que debe quedar escrito: Mongo apagado, Kafka retirado, secretos por Key Vault, `EntidadAuditable` no se hereda si el esquema trae sus propias columnas, y las cadenas de seguridad que se rearman a mano. No edites las skills selladas: las discrepancias van como observación al backlog del SDK.

## Al terminar

1. Corre `estado.py` y corrige incumplimientos.
2. Entrega al usuario: archivo creado, qué quedó como pendiente de decisión y quién debe firmar. No afirmes "listo" sin la salida del script.

## DevOps, plataforma e infraestructura (DT-51)

| Documento | Carpeta | Prefijo | Gate | Skill |
|---|---|---|---|---|
| Runbook | `operacion/` | `RB-<DOM>-###` | G8, G9 | `aybar-devops-operacion` |
| Plan de release | `operacion/` | `REL-<DOM>-###` | G8 | `aybar-devops-operacion` |
| Revisión de seguridad | `operacion/` | `SEC-<DOM>-###` | G7 | `aybar-devops-operacion` |
| Inventario de infraestructura | `operacion/` | `INV-<DOM>-###` | G3, G8 | `aybar-devops-operacion` |

Si el pedido es de plataforma o DevOps, además de estos documentos se trabaja la **épica habilitadora** con features `FT-PLA-##` e historias con actor `DEV` (DT-51).
