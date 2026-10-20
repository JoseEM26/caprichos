---
name: aybar-dor
description: Use cuando hay que crear o auditar un documento Definition of Ready (PLT-05) por feature para el Gate G4 en el paquete de analisis y diseno Aybar (también para features de plataforma o DevOps).
---

# Aybar · Definition of Ready (PLT-05)

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.**
> 1. Crea **un solo** documento (o una sola sección si es muy largo) y **detente**.
> 2. Muéstraselo al usuario y espera su visto bueno explícito. Si pide cambios, corrige ese mismo documento.
> 3. Solo con su aprobación pasa al siguiente, empezando por el primero de la cadena (intake → BRD → épica/feature → diseño → ADR → HU → DoR → tareas).
> 4. **Nunca generes varios documentos, carpetas o copias de golpe**, ni reorganices el paquete, sin que el usuario lo haya pedido paso a paso. Tampoco delegues la creación en masa a otros agentes.
> 5. Si el trabajo toca archivos existentes, pregunta antes: no muevas, copies ni borres por tu cuenta.

> **CARPETA DESTINO (fija): `<paquete>/dor/`** — archivo `DOR-<FT-id>-<slug>.md`. El nombre de la carpeta es exactamente ese y no se cambia (mismo esquema que `Roles y permisos`). `<paquete>` es la carpeta del proyecto en curso. Si la carpeta no existe, créala con ese nombre al guardar el primer documento de este tipo; no la crees antes ni dejes el archivo suelto en la raíz.

## 1. Para que sirve y en que gate entra

El documento **PLT-05 (Definition of Ready)** establece las condiciones mínimas verificables para que una feature y sus historias de usuario asociadas puedan ingresar a desarrollo sin bloqueos. Entra en el **Gate G4** (especificación funcional, técnica y preparación para construcción). Existe exactamente **un documento DoR por cada feature** (`FT-<AREA>-##`).

## 2. Frontmatter obligatorio y convenciones

### Frontmatter obligatorio
```yaml
---
id: DOR-FT-CAT-01
tipo: spec
titulo: "Definition of Ready — FT-CAT-01 Registro de roles y permisos por microservicios"
estado: draft
producto: aybarcorp
version: "1.0"
owner: "(pendiente — R16)"
aprobadores: []
fecha: 2026-10-04
relacionados: [AYB-1042, EP-IDN-005, FT-CAT-01, RF-IDN-014, HU-IDN-054, ADR-021]
tags: [dor, plt-05, roles-permisos, dom-idn-001, capa-a, ayb-1042]
---
```

- **Convención de ID:** `DOR-<FT-id>` (ej. `DOR-FT-CAT-01`, `DOR-FT-EMI-01`, `DOR-FT-IDN-001`).
- **Convención de archivo:** `dor/DOR-<FT-id>-<slug>.md` (ej. `dor/DOR-FT-CAT-01-registro-por-microservicios.md`). Debe comenzar estrictamente con `DOR-` seguido del ID exacto de la feature.
- **Valores iniciales:** `estado: draft` obligatorio al crear; `aprobadores: []`; `owner: "(pendiente — R16)"` si no hay persona asignada.

## 3. Secciones obligatorias en orden estricto

Tomadas directamente de los modelos reales `dor/DOR-FT-CAT-01-registro-por-microservicios.md` y `dor/DOR-FT-EMI-01-pkce.md`:

1. **Cabecera de evaluación:**
   - Título `# PLT-05 · DOR — DEFINITION OF READY` (o `# PLT-05 · DEFINITION OF READY — <FT-id> <Título>`).
   - Subtítulo con frentes, servicios y ticket (ej. `AYB-1042`).
   - Tabla de evaluación: `ÍTEM EVALUADO` (Épica y Feature), `PRODUCT OWNER`, `LÍDER TÉCNICO`, `FECHA DE REVISIÓN`, `SPRINT / RELEASE DESTINO`, `RESULTADO` (`(lo decide el PO — propuesta IA: READY / READY CON CONDICIONES / NO READY)`).
   - Bloque de contexto/insumos citando la fuente de verdad (`analisis/decisiones.md`), la feature, sus HU y la épica padre.
2. `## 1 CHECKLIST DE PREPARACIÓN`:
   - Tabla con columnas: `Grupo`, `☐/☑` (o `Estado`), `Ítem`, `Responsable / evidencia`.
   - **5 grupos obligatorios:**
     - `NEGOCIO`: Objetivo y valor con KPI; Alcance in/out acordado; Prioridad y release confirmados.
     - `FUNCIONAL`: Historias con criterios verificables; Reglas de negocio documentadas/validadas; Estimación por el equipo.
     - `DISEÑO / UX`: Prototipos/wireframes aprobados (DEP-06); Textos y mensajes definidos.
     - `TÉCNICO`: Diagramas dependencias/modelado/arquitectura; Contrato API (OpenAPI); Modelo de datos / DDL; RNF y seguridad.
     - `CALIDAD`: Estrategia y datos de prueba definidos (test-plan); Riesgos identificados con mitigación y dueño.
3. `## 2 DIAGRAMA DE DEPENDENCIAS`:
   - Diagrama `flowchart LR` en Mermaid con clases (`interna`, `evaluado`, `externa`/`bloqueante`).
   - Detalle de ítems evaluados, dependencias técnicas, dependencias externas (`DEP-##`) y decisiones (`D-##`, `O-##`).
   - Tabla de **Bloqueantes**: columnas `ID`, `Bloqueante`, `Tipo`, `Dueño`, `Fecha`, `Estado`.
4. `## 3 MODELADO (DATOS Y PROCESO)`:
   - Diagrama Entidad-Relación (`erDiagram` en Mermaid) con entidades del fragmento involucrado y FKs físicas.
   - Explicación de lo modelado y propuestas pendientes.
   - Diagrama de flujo de proceso (`flowchart TB`).
   - Diagrama de estados (`stateDiagram-v2`) si la entidad maneja ciclo de vida o vigencia.
5. `## 4 DIAGRAMA DE ARQUITECTURA`:
   - Diagrama C4 de contenedores (`flowchart TB` en Mermaid) categorizado por subgraphs: Canales, API/Seguridad, Servicios, Datos.
   - Tabla de aspectos técnicos: `Decisiones clave (ADR)`, `Integración`, `Ambientes`, `Seguridad`, `Datos personales`.
6. `## 5 RIESGOS`:
   - Matriz con riesgos de roadmap (`R-##`) y riesgos específicos de la feature (`R-<FT-id>-##`).
   - Columnas: `ID`, `Riesgo`, `Prob.`, `Impacto`, `Mitigación`, `Dueño`, `Estado`.
7. `## 6 DECISIÓN Y APROBACIÓN`:
   - Opciones: `☐ READY · Puede ingresar a desarrollo  ☐ READY CON CONDICIONES · ver acuerdos  ☐ NO READY · devolver a refinamiento`.
   - **Propuesta IA** fundamentada: La IA propone `READY`, `READY CON CONDICIONES` o `NO READY` con argumentos técnicos y de negocio, pero **la decisión final la toma el PO**.
   - Tabla de firmas: `Product Owner`, `Líder técnico / Arquitecto`, `QA`, `UX`. Casillas vacías sin firmas ficticias (R16).
   - Pie de trazabilidad: `Generado por IA: <qué> — Revisado por: (pendiente)`.

## 4. Reglas y errores típicos observados

- **No inventar IDs:** Todo `ADR-###`, `EP-###`, `FT-###`, `HU-###`, `DEP-##`, `D-##` citado en el texto o frontmatter debe existir en el paquete o en `analisis/decisiones.md`.
- **Campos sin fuente:** Si un dato o responsable no está en una fuente oficial, dejarlo vacío o marcar `(pendiente — R16)` asociando la decisión pendiente (`D-xx`, `O-xx`). Jamás dar por hecho decisiones no firmadas.
- **La IA no firma ni aprueba:** No marcar casillas de firmas ni poner `estado: approved`. La IA formula la propuesta técnica (`Propuesta IA: ...`) y el PO decide.
- **Convención de riesgos:** Los riesgos propios de la feature deben seguir el prefijo exacto `R-<FT-id>-##` (ej. `R-FT-CAT-01-01`).
- **Trazabilidad:** Incluir obligatoriamente la línea `Generado por IA: ... — Revisado por: (pendiente)`.

## 5. Documentos modelo

- Modelo principal: `dor/DOR-FT-CAT-01-registro-por-microservicios.md` (modelo completo con ER detallado, flujo, estados y C4).
- Modelo complementario: `dor/DOR-FT-EMI-01-pkce.md`.

## 6. Checklist de verificación final

- [ ] Archivo ubicado en `dor/DOR-<FT-id>-<slug>.md` con nombre iniciando en `DOR-<FT-id>`.
- [ ] Frontmatter con las 11 propiedades en orden y `estado: draft`.
- [ ] Las 6 secciones obligatorias presentes en orden estricto sin secciones inventadas.
- [ ] Checklist con los 5 grupos (Negocio, Funcional, Diseño/UX, Técnico, Calidad).
- [ ] Diagramas Mermaid válidos (dependencias, ER, flujo, arquitectura C4).
- [ ] Riesgos identificados con nomenclatura `R-<FT-id>-##`.
- [ ] Propuesta de IA documentada dejando la decisión al PO y firmas vacías.
- [ ] Ejecutar el validador oficial y verificar cero incumplimientos:
```bash
python3 -I '/home/jose/Aybar-Corp/equipo-innovacion/NEXORA/.claude/skills/aybar-siguiente-paso/scripts/estado.py' '<ruta-del-paquete>'
```

## DevOps, plataforma e infraestructura (DT-51)

- En features de plataforma, «3 MODELADO» dice «No aplica un modelo de datos» y apunta al inventario (`operacion/INV-`); se mantiene el diagrama de estados si hay ciclo (por ejemplo, PR → main → pruebas → producción → volver atrás).
- En el checklist TÉCNICO agrega: **runbook escrito y probado** por alguien distinto de quien lo escribió, **inventario actualizado**, **secretos fuera del repositorio**.
- En CALIDAD: la prueba se hace en el ambiente de pruebas; para copias, la restauración se mide en tiempo.
- En RIESGOS cita los del roadmap de disponibilidad y caída (por ejemplo, R-06) y la falta de runbook como riesgo propio `R-<FT-id>-##`.
