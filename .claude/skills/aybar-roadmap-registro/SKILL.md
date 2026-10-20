---
name: aybar-roadmap-registro
description: Use cuando hay que crear o actualizar el Roadmap de producto PLT-01 en roadmap/ o consultar y registrar decisiones, pendientes, aclaraciones y riesgos en analisis/decisiones.md.
---

# Aybar · Roadmap PLT-01 y Registro de Decisiones

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.**
> 1. Crea **un solo** documento (o una sola sección si es muy largo) y **detente**.
> 2. Muéstraselo al usuario y espera su visto bueno explícito. Si pide cambios, corrige ese mismo documento.
> 3. Solo con su aprobación pasa al siguiente, empezando por el primero de la cadena (intake → BRD → épica/feature → diseño → ADR → HU → DoR → tareas).
> 4. **Nunca generes varios documentos, carpetas o copias de golpe**, ni reorganices el paquete, sin que el usuario lo haya pedido paso a paso. Tampoco delegues la creación en masa a otros agentes.
> 5. Si el trabajo toca archivos existentes, pregunta antes: no muevas, copies ni borres por tu cuenta.

> **CARPETA DESTINO (fija): `<paquete>/roadmap/`** — archivo `PLT-01-roadmap.md (el registro decisiones.md va en analisis)`. El nombre de la carpeta es exactamente ese y no se cambia (mismo esquema que `Roles y permisos`). `<paquete>` es la carpeta del proyecto en curso. Si la carpeta no existe, créala con ese nombre al guardar el primer documento de este tipo; no la crees antes ni dejes el archivo suelto en la raíz.

Especializada en la planificación temporal y dependencias del producto mediante el **Roadmap PLT-01** (Gate G1) y en la gestión de la fuente única de verdad del paquete: el **Registro de Decisiones** (`analisis/decisiones.md`).

## 1. Para qué sirve y en qué gate entra

- **Roadmap PLT-01 (`roadmap/PLT-01-roadmap.md`) — Gate G1 (Discovery)**:
  Sintetiza la visión del producto, el cronograma por día o trimestre (adaptación según plazo R14), el diagrama Gantt en Mermaid, los hitos clave (H1 a H3), la matriz de dependencias con bloqueos y los riesgos priorizados. Se aprueba junto con el BRD en G1 por PO y Stakeholder.
- **Registro de Decisiones (`analisis/decisiones.md`) — Fuente de verdad transversal**:
  Gobierna todos los documentos del paquete (G0 a G4). Si un documento, especificación o diagrama contradice este registro, **manda el registro** y el documento debe corregirse inmediatamente.

## 2. Frontmatter obligatorio y convenciones de archivo

### Roadmap PLT-01
Frontmatter YAML obligatorio en este orden exacto:
`id, tipo, titulo, estado, producto, version, owner, aprobadores, fecha, relacionados, tags`
- Archivo: `roadmap/PLT-01-roadmap.md` (o `roadmap/<id>-roadmap.md`)
- Convención id: `RMP-<DOM>-###` (ej. `RMP-IDN-001`)
- Frontmatter: `tipo: spec`, `estado: draft`, `version: "1.0"`, `owner: "(pendiente — R16)"`, `aprobadores: []`, `relacionados: [AYB-1042, ADR-001, BRD-IDN-001, ...]`, `tags: [roadmap, <tema>, plt-01]`

### Registro de Decisiones
- Archivo: `analisis/decisiones.md`
- **Sin frontmatter YAML** por diseño del marco (es documento maestro de consulta).

## 3. Secciones obligatorias en orden (sin agregar ninguna)

### Roadmap (PLT-01) — Modelo: `roadmap/PLT-01-roadmap.md`
Cabecera: `# PLT-01 · ROADMAP DE PRODUCTO` + subtítulo `Dependencias · Riesgos · Hitos` + tabla de metadatos (Producto, PO, Versión/Fecha, Horizonte, Visión del producto, Estado) + bloque de adaptación del formato si aplica.
Secciones numeradas obligatorias:
1. `## 1 ROADMAP POR DÍA` (o por trimestre): tabla de épicas/iniciativas por fechas + diagrama Gantt Mermaid (`gantt`) + tabla de Hitos (Hito, Fecha, Logro, Gate) + agrupación por horizonte (Ahora, Siguiente, Después).
2. `## 2 DEPENDENCIAS`: tabla con columnas `ID` (`DEP-##`), `Dependencia`, `Tipo` (Interna / Externa / Técnica / Legal), `Bloquea a`, `Responsable`, `Fecha requerida`, `Estado` (Pendiente / En curso / Resuelta).
3. `## 3 RIESGOS`: tabla de riesgos (`ID` `R-##`, `Riesgo`, `Prob.`, `Impacto`, `Nivel` MEDIO/ALTO, `Mitigación / plan de contingencia`, `Dueño`) + tabla `Matriz de probabilidad e impacto` + guía de uso de la matriz + párrafos de `Supuestos` y `Restricciones`.
4. `## 4 CONTROL DE VERSIONES Y APROBACIÓN`: tabla (Versión, Fecha, Autor, Cambio, Aprobado por).
Pie de trazabilidad: `Generado por IA: ... — Revisado por: (pendiente)`

### Registro de Decisiones — Modelo: `analisis/decisiones.md`
Cabecera: `# Registro de decisiones del paquete de análisis y diseño`, metadatos en negrita (Frente, Servicio, Fecha, Decide: Technical Lead), declaración de fuente de verdad y pie IA.
Secciones estructuradas:
1. `## 1. Forma de trabajo` (tabla: `#`, `Decisión`, `Fuente`)
2. `## 2. Plazo y equipo` (tabla: `#`, `Decisión`, `Fuente`)
3. `## 3. Alcance` (tabla: `#`, `Decisión`, `Fuente`)
4. Secciones temáticas según el dominio (ej. `## 4. Niveles de autenticación`, `## 5. Arquitectura`)
5. `## 6. Prioridades` (tabla: Prioridad Debe/Debería/Podría/No esta vez, Épica, Features, Por qué)
6. `## 7. Valores` (tablas: valores aprobados `V#` y valores agregados/propuestos con fuente y justificación)
7. `## 8. Pendientes` (tabla: `#` `D-##`, `Qué falta`, `Recomendación` fundamentada)
8. `## 9. Aclaraciones de alcance` (tabla: `#` `A#`, `Aclaración`, `Por qué`)
9. `## 10. Observaciones al libro de requisitos` (tabla: `#` `O#`, `Observación`, `Origen`)

## 4. Convenciones de prefijos, numeración y reglas críticas

### Prefijos de numeración
- **`R#` (R1, R2...)**: Decisiones vinculantes de gobierno, arquitectura y trabajo tomadas por el TL.
- **`D-##` (D-01, D-14...)**: Decisiones pendientes o abiertas que requieren validación. Deben registrarse siempre con una **Recomendación técnica concreta**, nunca abiertas sin propuesta.
- **`A#` (A1, A2...)**: Aclaraciones interpretativas sobre alcance, prioridades o estándares técnicos.
- **`O#` (O1, O2...)**: Observaciones de discrepancias encontradas en el libro de requisitos para el dueño del frente.
- **`V#` (V1, V2...)**: Valores de configuración y parámetros numéricos aprobados o propuestos.
- **`DEP-##` (DEP-01...)**: Dependencias del proyecto registradas en el Roadmap.
- **`R-##` con guion (R-01, R-02...)**: Riesgos del Roadmap (se distinguen de las decisiones `R#` por el guion).

### Reglas críticas
1. **El registro manda**: Si un documento contradice `analisis/decisiones.md`, se corrige el documento.
2. **Dependencia sin fecha bloquea DoR**: Toda dependencia en DEP-## sin fecha comprometida impide marcar READY el ítem que bloquea (sale NO READY).
3. **Decisiones pendientes con recomendación**: La IA no toma decisiones finales ni firma; plantea la duda en `D-##` con su propuesta argumentada en la columna "Recomendación".
4. **La IA no aprueba ni firma**: Los aprobadores quedan en blanco y `estado: draft`.
5. **No inventar hechos**: Campos sin confirmar quedan vacíos con referencia a `D-##` u `O-##`.

## 5. Checklist final de verificación

- [ ] Roadmap contiene sus 4 secciones exactas (`1 ROADMAP...`, `2 DEPENDENCIAS`, `3 RIESGOS`, `4 CONTROL...`).
- [ ] Diagrama Gantt en Mermaid sintácticamente válido.
- [ ] Dependencias `DEP-##` y riesgos `R-##` correctamente correlacionados con épicas y features existentes.
- [ ] Nuevas decisiones o pendientes en `decisiones.md` usan el prefijo adecuado (`R#`, `D-##`, `A#`, `O#`) y `D-##` tiene recomendación.
- [ ] Ejecutar el validador oficial y confirmar 0 incumplimientos:
  ```bash
  python3 -I '/home/jose/Aybar-Corp/equipo-innovacion/NEXORA/.claude/skills/aybar-siguiente-paso/scripts/estado.py' '<ruta-del-paquete>'
  ```

## 6. Documentos modelo para copiar

- Para Roadmap: copiar estructura de `roadmap/PLT-01-roadmap.md`.
- Para Registro de Decisiones: seguir estructura y tablas de `analisis/decisiones.md`.
