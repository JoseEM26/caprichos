---
name: aybar-feature
description: Use cuando hay que redactar o corregir una Feature (PLT-03 / spec) para los gates G1 o G4 en el paquete de análisis y diseño Aybar.
---

# Aybar · Feature (PLT-03)

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.**
> 1. Crea **un solo** documento (o una sola sección si es muy largo) y **detente**.
> 2. Muéstraselo al usuario y espera su visto bueno explícito. Si pide cambios, corrige ese mismo documento.
> 3. Solo con su aprobación pasa al siguiente, empezando por el primero de la cadena (intake → BRD → épica/feature → diseño → ADR → HU → DoR → tareas).
> 4. **Nunca generes varios documentos, carpetas o copias de golpe**, ni reorganices el paquete, sin que el usuario lo haya pedido paso a paso. Tampoco delegues la creación en masa a otros agentes.
> 5. Si el trabajo toca archivos existentes, pregunta antes: no muevas, copies ni borres por tu cuenta.

> **CARPETA DESTINO (fija): `<paquete>/features/`** — archivo `FT-<AREA>-##-<slug>.md`. El nombre de la carpeta es exactamente ese y no se cambia (mismo esquema que `Roles y permisos`). `<paquete>` es la carpeta del proyecto en curso. Si la carpeta no existe, créala con ese nombre al guardar el primer documento de este tipo; no la crees antes ni dejes el archivo suelto en la raíz.

Especializada en la redacción y validación de especificaciones de Features (PLT-03) del marco Aybar.

## 1. Para qué sirve y en qué gate entra

- **Propósito:** Define una capacidad funcional completa descomponiendo requerimientos funcionales (RF/RQ), no funcionales (RNF), reglas de negocio y trazabilidad hacia Historias de Usuario (HU).
- **Gates:** Entra en **G1** (catálogo inicial de requerimientos funcionales y no funcionales) y se refina en **G4** (trazabilidad completa hacia HU, dependencias y DoR previa a construcción).
- **Modelos de referencia:** `features/FT-CAT-01-registro-de-roles-y-permisos-por-microservicios.md` y `features/FT-IDN-005-roles-y-caducidad.md`.

## 2. Frontmatter obligatorio y convenciones

El archivo debe ubicarse en `features/FT-<AREA>-##-<slug>.md` (ej. `features/FT-CAT-01-registro-de-roles-y-permisos-por-microservicios.md`, `features/FT-IDN-005-roles-y-caducidad.md`).

```yaml
---
id: FT-<AREA>-##
tipo: spec
titulo: "<Título descriptivo de la feature>"
estado: draft
producto: aybarcorp
version: "1.0"
owner: "(pendiente — R16)"
aprobadores: []
fecha: AAAA-MM-DD
relacionados:
  - EP-<DOM>-###
  - AYB-1042
tags: [<dominio>, dom-idn-001, capa-a, autorizacion, plt-03, ayb-1042]
---
```

## 3. Secciones obligatorias en orden estricto

Tomadas estrictamente de `features/FT-CAT-01-*.md` y `features/FT-IDN-005-*.md`:

1. `# FT-<AREA>-## — <Nombre>`
   - Subtítulo: `**PLT-03 · Feature · Catálogo de requerimientos** · Frente ...`
   - Tabla de cabecera:
     `| ID FEATURE | NOMBRE | ÉPICA PADRE |`
     `| PRODUCT OWNER | PRIORIDAD | ESTADO |`
     `| RELEASE OBJETIVO | ESTIMACIÓN (T-SHIRT) | FECHA / VERSIÓN |`
2. `## 1. Descripción y valor`
   - **Descripción:** Detalle del proceso, componentes y alcance de la feature.
   - Mecanismos de control específicos (ej. doble autorización, vigencias, alcances OAuth).
   - **Beneficio esperado:** Impacto de negocio, vínculo a objetivos (`OBJ-###`) e hipótesis medibles.
   - **Usuarios / roles:** Actores catalogados (`ACT-###`), roles y cuentas de servicio.
3. `## 2. Catálogo de requerimientos funcionales`
   - Tabla: `| ID | Requerimiento | Prioridad | Origen | Criterio de verificación | Estado |`
   - IDs con formato `RQ-<AREA>-##-##` (derivados) o `RF-<DOM>-###` (fuente del catálogo).
   - Columnas: Prioridad (*Debe tener* / *Debería tener* / *Podría tener*), Origen (acuerdos R##, decisiones TL, fuentes SRC), Criterio de verificación en formato Dado/Cuando/Entonces y Estado (`Propuesto` para alcance nuevo/derivado o `Aprobado <fecha>`).
   - Párrafo al pie explicando prioridades y consideraciones de DDL/esquema.
4. `## 3. Requerimientos no funcionales`
   - Tabla: `| ID | Categoría | Requerimiento | Métrica / umbral | Prioridad |`
   - Métricas y umbrales cuantitativos (ej. `hash_mismatch: 0`, latencia, ICCSD).
   - Justificación de aplicabilidad al pie (ej. RNF-AUD-005 para hashes, RNF-SEC-013 para zero-trust).
5. `## 4. Reglas de negocio`
   - Tabla: `| ID | Regla | Fuente |`
   - Reglas con IDs reales: acuerdos `R##`, reglas normativas `RN-###`, decisiones `D-##`, acuerdos `A##`.
6. `## 5. Trazabilidad y planificación`
   - Tabla: `| Requerimiento | Historias de usuario | Dependencia | Riesgo |`
   - Mapeo de cada requerimiento a sus historias `HU-<DOM>-###`, dependencias (`DEP-##`, otras FT) y riesgos (`R-##`).
   - Subsección `**Fuera de alcance**` con viñetas delimitando lo que resuelven otras features o épicas.
   - Subsección `**Preguntas abiertas**` numeradas con propuestas `D-##` pendientes de decisión del TL.
7. Pie de trazabilidad:
   `---`
   `Generado por IA: <fuentes, tablas y decisiones usadas> — Revisado por: *(pendiente)*`

## 4. Reglas críticas y errores típicos

- **Existencia de IDs:** Todos los IDs citados en `relacionados` y cuerpo (`EP-###`, `HU-###`, `ADR-###`, `FT-###`) deben existir como documentos reales en el paquete.
- **La IA nunca aprueba:** `estado: draft` en frontmatter y `aprobadores: []`. La IA no firma ni marca `approved`.
- **Campos sin fuente:** PO y estimación T-shirt quedan como `*(vacío: el nombre se define después, R16)*` y `(por estimar: Marisol y Sony)`. Si falta definición, dejar explícito `(pendiente — D-xx)`.
- **Lo no fuente no se escribe como hecho:** Requerimientos derivados no presentes en libro nacen en estado `Propuesto` y citan su decisión/acuerdo.
- **Trazabilidad de IA:** Bloque final obligatorio `Generado por IA: ... — Revisado por: *(pendiente)*`.

## 5. Checklist final de verificación

1. [ ] Archivo creado en `features/FT-<AREA>-##-<slug>.md`.
2. [ ] Frontmatter con los 11 campos requeridos, `tipo: spec`, `estado: draft` y `aprobadores: []`.
3. [ ] Cabecera con tabla de 3 filas (ID/Nombre/Épica, PO/Prioridad/Estado, Release/Estimación/Fecha).
4. [ ] Secciones 1 a 5 en orden exacto, sin renombrar ni agregar secciones ajenas.
5. [ ] Catálogo de RF con columnas ID, Requerimiento, Prioridad, Origen, Criterio de verificación y Estado.
6. [ ] RNF con métrica/umbral cuantificable y reglas de negocio con ID y fuente.
7. [ ] Trazabilidad con tabla RF → HU/DEP/Riesgo, viñetas de Fuera de alcance y Preguntas abiertas numeradas.
8. [ ] Pie de trazabilidad de IA presente.
9. [ ] Ejecutar script de verificación:
   `python3 -I '/home/jose/Aybar-Corp/equipo-innovacion/NEXORA/.claude/skills/aybar-siguiente-paso/scripts/estado.py' '<ruta-del-paquete>'`

## 6. Documento modelo a copiar

Copiar la estructura y convenciones de `features/FT-CAT-01-registro-de-roles-y-permisos-por-microservicios.md` o `features/FT-IDN-005-roles-y-caducidad.md`.
