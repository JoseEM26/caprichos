---
name: aybar-intake-brd
description: Use cuando hay que redactar, revisar o actualizar la Ficha de Intake (T-INTAKE) de Gate G0 o el Business Requirement Document (BRD) de Gate G1 en el paquete de análisis y diseño Aybar.
---

# Aybar · Intake y BRD (Ficha T-INTAKE y Business Requirement Document)

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.**
> 1. Crea **un solo** documento (o una sola sección si es muy largo) y **detente**.
> 2. Muéstraselo al usuario y espera su visto bueno explícito. Si pide cambios, corrige ese mismo documento.
> 3. Solo con su aprobación pasa al siguiente, empezando por el primero de la cadena (intake → BRD → épica/feature → diseño → ADR → HU → DoR → tareas).
> 4. **Nunca generes varios documentos, carpetas o copias de golpe**, ni reorganices el paquete, sin que el usuario lo haya pedido paso a paso. Tampoco delegues la creación en masa a otros agentes.
> 5. Si el trabajo toca archivos existentes, pregunta antes: no muevas, copies ni borres por tu cuenta.

> **CARPETA DESTINO (fija): `<paquete>/analisis/`** — archivo `ficha-intake.md y BRD.md`. El nombre de la carpeta es exactamente ese y no se cambia (mismo esquema que `Roles y permisos`). `<paquete>` es la carpeta del proyecto en curso. Si la carpeta no existe, créala con ese nombre al guardar el primer documento de este tipo; no la crees antes ni dejes el archivo suelto en la raíz.

Especializada en los artefactos iniciales del flujo de gobierno Aybar: la **Ficha de Intake** para Gate G0 (Intake) y el **BRD** para Gate G1 (Discovery).

## 1. Para qué sirve y en qué gate entra

- **Ficha de Intake (`analisis/ficha-intake.md`) — Gate G0**: Formaliza la entrada de una iniciativa o cambio. Registra solicitante, problema, valor esperado, clasificación del cambio (T1/T2/T3) y artefactos exigidos según el marco. Alimenta el correo de formalización de G0 (`gates/<ticket>/G0.md`). Aprueba el PO.
- **BRD (`analisis/BRD.md`) — Gate G1**: Documenta las necesidades de negocio (R12) como salida formal de F1 Discovery. Define problema, objetivos medibles cruzados con RNF, mapa de stakeholders, alcance detallado (Ahora/Siguiente/Después/Fuera de alcance), reglas de negocio vigentes, criterios iniciales de aceptación y riesgos principales. Aprueba el Stakeholder; el PO cierra G1.

## 2. Frontmatter obligatorio y convenciones

Frontmatter YAML obligatorio en este orden exacto:
`id, tipo, titulo, estado, producto, version, owner, aprobadores, fecha, relacionados, tags`

- **Ficha de Intake**:
  - Archivo: `analisis/ficha-intake.md`
  - Convención id: `INT-<DOM>-###` (ej. `INT-IDN-001`)
  - Frontmatter: `tipo: spec`, `estado: draft`, `version: "1.0"`, `owner: "(pendiente — R16)"`, `aprobadores: []`, `relacionados: [AYB-1042, BRD-IDN-001, ...]`, `tags: [intake, g0, t3]`
- **BRD**:
  - Archivo: `analisis/BRD.md`
  - Convención id: `BRD-<DOM>-###` (ej. `BRD-IDN-001`)
  - Frontmatter: `tipo: brd`, `estado: draft`, `version: "1.0"`, `owner: "(pendiente — R16)"`, `aprobadores: []`, `relacionados: [AYB-1042, RMP-IDN-001, ADR-001, OBJ-IDN-001, ...]`, `tags: [brd, <tema>, g1]`

## 3. Secciones obligatorias en orden (sin agregar ninguna)

### Ficha de Intake (T-INTAKE) — Modelo: `analisis/ficha-intake.md`
Título: `# Ficha de Intake (T-INTAKE) - G0`
Campos obligatorios en lista viñeteada:
1. `- Ticket: **<TICKET>** (R13; ...)`
2. `- Solicitante: <Rol y nombre>`
3. `- Problema: <Descripción concisa del problema actual>`
4. `- Valor esperado: <Beneficios cuantificables, citando OBJ y metas>`
5. `- Tipo: **<T1|T2|T3>** (asignan PO y TL juntos) - motivo: <justificación>`
6. `- Owner de negocio: *(pendiente — R16)*`
7. `- Duplicado de ítem existente: no, según solicitante *(a confirmar contra el tablero)*`
8. `- Correo de formalización: borrador en gates/<ticket>/G0.md, sección 1; pendiente de envío`
9. `- Generado por IA: sí - Revisado por: *(pendiente)*`
10. `**Artefactos que exige <T#>**: <Lista exhaustiva de artefactos según matriz del marco>`

### BRD (R12) — Modelo: `analisis/BRD.md`
Título: `# BRD — <Título del servicio/producto>`
Nota de plantilla: blockquote sobre el marco (R12) + tabla de metadatos (Ticket, Tipo T3, Gate que alimenta G1, Aprueba).
Secciones numeradas obligatorias:
1. `## 1. Problema` (narrativa del dolor actual + tabla de necesidades `NEC-<DOM>-###`)
2. `## 2. Objetivos medibles` (tabla: Objetivo `OBJ-###`, Métrica con código RNF/V#, Línea base «por medir», Meta, Fuente de datos, Frecuencia)
3. `## 3. Stakeholders` (tabla: Quién, Rol en este cambio, Fuente/catálogo `ACT-###`, R16 si no hay nombre)
4. `## 4. Alcance` (subsecciones: En alcance — E1 / Debe tener, Siguiente / Debería y Podría, Después / horizonte futuro, Fuera de alcance)
5. `## 5. Reglas de negocio` (tabla: ID `RN-###`, Regla, Fuente: catálogo / registro)
6. `## 6. Criterios iniciales de aceptación` (tabla: Criterio, Cómo se verifica, Cuándo / Hito)
7. `## 7. Riesgos y supuestos` (referencia al roadmap `PLT-01` §3 con lista de códigos R-## y párrafo de supuestos)
8. `## 8. Firmas` (tabla: Rol, Nombre, Fecha, Decisión con casillas vacías: Stakeholder, Product Owner, Technical Lead)
Pie de trazabilidad: `Generado por IA: <qué> — Revisado por: (pendiente)`

## 4. Reglas críticas y errores típicos

1. **La IA nunca firma ni marca `approved`**: `estado` siempre nace `draft` y `aprobadores: []`. Solo el humano aprueba.
2. **Owner y firmas no bloquean (R16)**: Si no hay nombre asignado, colocar `owner: "(pendiente — R16)"` y casillas vacías en §8 Firmas.
3. **Tipo T3 y ticket obligatorio (R13)**: En cambio T3, registrar ticket formal (ej. `AYB-1042`) en `relacionados` y en el cuerpo.
4. **Lo no existente en una fuente no se escribe como hecho**: Si un dato no está en el catálogo o decisiones, se deja como «por medir» o vacío indicando la decisión pendiente (`D-xx`, `O-xx`).
5. **Todos los IDs citados deben existir**: Todo `OBJ-###`, `RNF-###`, `ADR-###`, `RMP-###` citado en `relacionados` o tablas debe ser válido en el paquete.
6. **Trazabilidad IA obligatoria**: Todo documento debe declarar `Generado por IA: ... — Revisado por: (pendiente)`.
7. **El registro `analisis/decisiones.md` manda**: Si un RF o suposición contradice `decisiones.md`, se respeta el registro de decisiones.

## 5. Checklist final de verificación

- [ ] Frontmatter completo con las 11 claves en orden correcto y `estado: draft`.
- [ ] Todas las secciones obligatorias presentes en su orden exacto sin añadir secciones inventadas.
- [ ] IDs en `relacionados` existen en el paquete y ticket R13 presente.
- [ ] Pie de trazabilidad IA presente y casillas de firma vacías (R16).
- [ ] Ejecutar el validador oficial y verificar cero incumplimientos:
  ```bash
  python3 -I '/home/jose/Aybar-Corp/equipo-innovacion/NEXORA/.claude/skills/aybar-siguiente-paso/scripts/estado.py' '<ruta-del-paquete>'
  ```

## 6. Documentos modelo para copiar

- Para Ficha de Intake: copiar estructura de `analisis/ficha-intake.md`.
- Para BRD: copiar estructura de `analisis/BRD.md`.

## DevOps, plataforma e infraestructura (DT-51)

- Si el cambio exige servidores, despliegue o datos personales, anota en el intake y en el BRD (supuestos y riesgos) que habrá una **épica habilitadora** de plataforma y documentos de operación (runbooks, plan de release, revisión de seguridad), aunque se detallen después.
