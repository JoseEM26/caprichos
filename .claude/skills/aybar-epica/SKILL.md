---
name: aybar-epica
description: Use cuando hay que redactar o actualizar una Épica (PLT-02 / spec) para el gate G1 en el paquete de análisis y diseño Aybar.
---

# Aybar · Épica (PLT-02)

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.**
> 1. Crea **un solo** documento (o una sola sección si es muy largo) y **detente**.
> 2. Muéstraselo al usuario y espera su visto bueno explícito. Si pide cambios, corrige ese mismo documento.
> 3. Solo con su aprobación pasa al siguiente, empezando por el primero de la cadena (intake → BRD → épica/feature → diseño → ADR → HU → DoR → tareas).
> 4. **Nunca generes varios documentos, carpetas o copias de golpe**, ni reorganices el paquete, sin que el usuario lo haya pedido paso a paso. Tampoco delegues la creación en masa a otros agentes.
> 5. Si el trabajo toca archivos existentes, pregunta antes: no muevas, copies ni borres por tu cuenta.

> **CARPETA DESTINO (fija): `<paquete>/epicas/`** — archivo `EP-<DOM>-###-<slug>.md`. El nombre de la carpeta es exactamente ese y no se cambia (mismo esquema que `Roles y permisos`). `<paquete>` es la carpeta del proyecto en curso. Si la carpeta no existe, créala con ese nombre al guardar el primer documento de este tipo; no la crees antes ni dejes el archivo suelto en la raíz.

Especializada en la redacción y validación de Épicas (PLT-02) del marco Aybar.

## 1. Para qué sirve y en qué gate entra

- **Propósito:** Agrupa capacidades, requerimientos y features bajo un mismo objetivo estratégico de negocio, delimitando contexto, alcance macro, dependencias y métricas de éxito.
- **Gate:** Entra y se formaliza en **G1 (Business Requirements Gate)**, aprobada por PO, Sponsor y Líder Técnico antes de abrir arquitectura o construcción.
- **Modelos de referencia:** `epicas/EP-IDN-005-roles-permisos-y-sod.md` y `epicas/EP-IDN-001-cuentas-e-identidades-federadas.md`.

## 2. Frontmatter obligatorio y convenciones

El archivo debe ubicarse en `epicas/EP-<DOM>-###-<slug>.md` (ej. `epicas/EP-IDN-005-roles-permisos-y-sod.md`, `epicas/EP-IDN-001-cuentas-e-identidades-federadas.md`).

```yaml
---
id: EP-<DOM>-###
tipo: spec
titulo: "EP-<DOM>-### <Título descriptivo de la épica>"
estado: draft
producto: aybarcorp
version: "1.0"
owner: "(pendiente — R16)"
aprobadores: []
fecha: AAAA-MM-DD
relacionados: [CAP-<DOM>-###, PROC-<DOM>-###, RF-<DOM>-###, ADR-###, R##, FT-###]
tags: [<dominio>, dom-idn-001, capa-a, autorizacion, debe-tener]
---
```

## 3. Secciones obligatorias en orden estricto

Tomadas estrictamente de `epicas/EP-IDN-005-*.md` y `epicas/EP-IDN-001-*.md`:

1. `# EP-<DOM>-### — <Nombre>`
   - Tabla de cabecera:
     `| Campo | Valor |`
     (Campos: `ID ÉPICA`, `NOMBRE`, `PRODUCTO`, `PRODUCT OWNER`, `SPONSOR`, `PRIORIDAD`, `HORIZONTE`, `ESTADO`, `FECHA / VERSIÓN`).
2. `## 1 CONTEXTO`
   - `**Problema u oportunidad**`: Diagnóstico actual, riesgos identificados y justificación del cambio.
   - `**Usuarios / segmentos**`: Actores afectados con sus códigos catalogados (`ACT-###`), roles y sistemas participantes.
   - `**Evidencia**`: Fuentes primarias (`SRC-###`, `DOC-###`), fragmentos de modelo, aprobaciones previas y acuerdos `R##`.
   - `**Alineamiento estratégico**`: Vínculo a objetivos organizacionales (`OBJ-###`) y necesidades (`NEC-###`).
3. `## 2 OBJETIVOS`
   - `**Objetivo de negocio**`: Declaración de valor esperado para el negocio y la organización.
   - `**Objetivo del usuario**`: Propósito centrado en la experiencia y capacidades del usuario final o actor técnico.
   - Tabla de métricas:
     `| Métrica (KPI) | Línea base | Meta | Fuente de datos | Frecuencia |`
4. `## 3 ALCANCE`
   - `**En alcance (IN)**`: Lista exhaustiva de capacidades, flujos, tablas y controles incluidos con sus RF/RN/RQ asociados.
   - `**Fuera de alcance (OUT)**`: Límites precisos y responsabilidades delegadas a otras épicas o sistemas.
   - `**Features que componen la épica**`: Tabla `| ID Feature | Nombre | Prioridad | Estado |` con todas sus `FT-###`.
   - `**Supuestos**`: Hipótesis de partida (adaptadores, estados iniciales, acuerdos de equipo).
   - `**Restricciones**`: Límites normativos, técnicos (Azure, PostgreSQL, FK físicas) y de calendario (`R14`, `R1`).
   - `**Dependencias y riesgos**`: Dependencias funcionales (`DEP-##`), externas y riesgos con impacto (`R-##`).
   - `**Criterios de éxito / salida**`: Condiciones verificables para considerar completada la épica y pasar a G4.
5. `## 4 APROBACIONES`
   - Tabla de firmas requeridas:
     `| Rol | Nombre | Fecha | Firma |`
     (Roles fijos: `Product Owner`, `Sponsor`, `Líder técnico`).
6. Pie de trazabilidad:
   `---`
   `Generado por IA: <fuentes, acuerdos y decisiones> — Revisado por: (pendiente)`

## 4. Reglas críticas y errores típicos

- **Existencia de IDs:** Todos los IDs referenciados (`FT-###`, `HU-###`, `ADR-###`, `RF-###`) deben existir físicamente en el paquete.
- **La IA nunca aprueba:** `estado: draft` en frontmatter, `aprobadores: []` y la tabla de `## 4 APROBACIONES` debe dejarse con casillas de nombre, fecha y firma vacías.
- **Campos sin definir:** `PRODUCT OWNER` y `SPONSOR` en la cabecera van como `*(vacío — R16)*`.
- **Hechos vs Pendientes:** Si una métrica o dato no está medido, indicar `por medir` o `(sin fuente)`; no inventar valores numéricos de línea base.
- **Trazabilidad de IA:** Obligatorio registrar el bloque al pie: `Generado por IA: ... — Revisado por: (pendiente)`.

## 5. Checklist final de verificación

1. [ ] Archivo creado en `epicas/EP-<DOM>-###-<slug>.md`.
2. [ ] Frontmatter con los 11 campos requeridos, `tipo: spec`, `estado: draft` y `aprobadores: []`.
3. [ ] Cabecera con tabla `| Campo | Valor |` con los 9 atributos requeridos.
4. [ ] Secciones 1 CONTEXTO, 2 OBJETIVOS, 3 ALCANCE y 4 APROBACIONES en su orden estricto.
5. [ ] Tabla de KPIs con Línea base, Meta, Fuente de datos y Frecuencia.
6. [ ] Tabla de features componentes con IDs `FT-###` válidos.
7. [ ] Tabla de aprobaciones con casillas vacías para PO, Sponsor y Líder técnico.
8. [ ] Pie de trazabilidad de IA presente.
9. [ ] Ejecutar script de verificación:
   `python3 -I '/home/jose/Aybar-Corp/equipo-innovacion/NEXORA/.claude/skills/aybar-siguiente-paso/scripts/estado.py' '<ruta-del-paquete>'`

## 6. Documento modelo a copiar

Copiar la estructura y tablas de `epicas/EP-IDN-005-roles-permisos-y-sod.md` o `epicas/EP-IDN-001-cuentas-e-identidades-federadas.md`.
