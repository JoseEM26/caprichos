---
name: aybar-historia-usuario
description: Use cuando hay que crear o corregir una Historia de Usuario (HU) en el formato estándar Aybar (gate G4), asegurando trazabilidad con épica, feature, criterios de aceptación DADO/CUANDO/ENTONCES, checklist DoR/DoD y datos sintéticos.
---

# Aybar · Historia de Usuario (HU)

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.**
> 1. Crea **un solo** documento (o una sola sección si es muy largo) y **detente**.
> 2. Muéstraselo al usuario y espera su visto bueno explícito. Si pide cambios, corrige ese mismo documento.
> 3. Solo con su aprobación pasa al siguiente, empezando por el primero de la cadena (intake → BRD → épica/feature → diseño → ADR → HU → DoR → tareas).
> 4. **Nunca generes varios documentos, carpetas o copias de golpe**, ni reorganices el paquete, sin que el usuario lo haya pedido paso a paso. Tampoco delegues la creación en masa a otros agentes.
> 5. Si el trabajo toca archivos existentes, pregunta antes: no muevas, copies ni borres por tu cuenta.

> **CARPETA DESTINO (fija): `<paquete>/historias/`** — archivo `HU-<DOM>-###-<slug>.md`. El nombre de la carpeta es exactamente ese y no se cambia (mismo esquema que `Roles y permisos`). `<paquete>` es la carpeta del proyecto en curso. Si la carpeta no existe, créala con ese nombre al guardar el primer documento de este tipo; no la crees antes ni dejes el archivo suelto en la raíz.

Guía especializada para redactar y validar Historias de Usuario bajo el formato oficial Aybar. Este artefacto pertenece al **Gate G4** (Ready for Sprint / Refinamiento técnico completado).

Modelos de referencia en el paquete:
- `historias/HU-IDN-010-asignar-y-revocar-roles.md`
- `historias/HU-IDN-056-registrar-roles-permisos-e-incompatibilidades.md`

## 1. Para qué sirve y Gate

- **Propósito:** Especificar funcionalmente el incremento de software desde la perspectiva del usuario o consumidor (persona o cuenta de servicio), delimitando alcance, dependencias, reglas de negocio e invariantes de datos verificables.
- **Gate:** Entra y se valida en **G4** (Definition of Ready previa a construcción).

## 2. Convención de archivos y Frontmatter obligatorio

- **Ruta y nombre:** `historias/HU-<DOM>-###-<slug>.md` (ejemplo: `historias/HU-IDN-010-asignar-y-revocar-roles.md`).
- **Frontmatter YAML obligatorio** (exactamente en este orden):

```yaml
---
id: HU-<DOM>-###
tipo: hu
titulo: "<Título descriptivo de la necesidad>"
estado: draft
producto: aybarcorp
version: "1.0"
owner: "(pendiente — R16)"
aprobadores: []
fecha: YYYY-MM-DD
relacionados: [AYB-1042, EP-<DOM>-###, FT-<AREA>-##, ...]
tags: [hu, <area-slug>, capa-a, <tags-adicionales>]
---
```

## 3. Secciones obligatorias en orden estricto

No inventar secciones ni alterar el orden. Todo documento debe contener:

1. `# FORMATO DE HISTORIA DE USUARIO`
   - Tabla 1: `| ID / Código | Título | Épica / Módulo (con EP y FT) | Sprint / Release |`
   - Tabla 2: `| Prioridad | Estado | Responsable | Estimación |`
2. `## 01 | NECESIDAD DEL USUARIO`
   - Tabla: `| COMO | QUIERO | PARA |` (Actor catalogado ACT-### o cuenta de servicio con alcance específico).
3. `## 02 | CONTEXTO Y ALCANCE`
   - Tabla de 2 columnas: `| CONTEXTO / PROBLEMA | ALCANCE / FUERA DE ALCANCE |`
   - Contexto: referencia a RF/RQ/RN aprobados, antecedentes y problema que resuelve.
   - Alcance: endpoints, operaciones y entidades impactadas.
   - Fuera de alcance: límites explícitos y qué otras HU cubren lo complementario.
4. `## 03 | CRITERIOS DE ACEPTACIÓN`
   - Tabla: `| N.° | DADO | CUANDO | ENTONCES |` (identificadores CA-1, CA-2, etc.).
   - Al pie de la tabla: origen de criterios (`rf.csv`, OpenAPI, etc.) y declaración de datos sintéticos.
5. `## 04 | REGLAS, DEPENDENCIAS Y EVIDENCIAS`
   - Tabla 2x2:
     - `REGLAS DE NEGOCIO`: identificadores RB-01, RB-02 con sus RN/RQ asociados.
     - `DATOS Y VALIDACIONES`: entidades de base de datos impactadas, llaves, columnas clave, índices únicos, constraints y hashes de integridad.
     - `DEPENDENCIAS / RIESGOS`: dependencias de orden y prelación con otras HU, servicios externos (DEP-##) y riesgos (R-##).
     - `DISEÑO / ADJUNTOS`: enlace o estado del mockup en Figma (si tiene pantalla), contrato OpenAPI, modelos Mermaid, ADRs asociados.
6. `## 05 | CHECKLIST DE CALIDAD`
   - Tabla: `| DEFINITION OF READY (DoR) | DEFINITION OF DONE (DoD) |`
   - Diagnóstico final de DoR (ej. `DoR: NO READY hasta cerrar G2 y G3`).
   - Bloque de trazabilidad: `Generado por IA: <detalle> — Revisado por: (pendiente)`

## 4. Reglas críticas y errores típicos

- **Existencia de IDs:** Todo ID citado (`EP-###`, `FT-###`, `RF-###`, `RN-###`, `ADR-###`, `HU-###`, `DEP-##`, `D-##`) debe existir y ser coherente con el paquete.
- **La IA nunca aprueba:** `estado: draft`, `aprobadores: []`, `owner: "(pendiente — R16)"` o vacío con su decisión pendiente si no hay responsable humano asignado.
- **Hechos vs Pendientes:** Lo que no provenga de fuentes aprobadas (`analisis/decisiones.md`, BRD, RF) no se escribe como un hecho; se marca explícitamente como `(pendiente — G3)`, `(propuesta D-##)` o `(pendiente — R16)`.
- **Figma:** Si la historia involucra pantalla o interfaz de usuario, indicar el enlace al mockup de Figma en DISEÑO / ADJUNTOS; si no está listo, declarar explícitamente `(pendiente UX — G2)`. Si no lleva pantalla, indicar `no aplica (operación de backend/servicio)`.
- **Datos siempre sintéticos:** Nombres, cuentas (ej. 9001, 9002), emails (`@ejemplo.test`), tokens o identificadores deben ser 100% sintéticos y seguros.

## 5. Checklist de verificación final

Antes de concluir la creación o modificación de una HU:
- [ ] Frontmatter completo con los 11 campos requeridos y en orden.
- [ ] Cabecera con IDs exactos de Épica (EP) y Feature (FT).
- [ ] Criterios CA-n redactados en formato DADO / CUANDO / ENTONCES con casos positivos, negativos y de borde.
- [ ] Mapeo de entidades DDL, invariantes de base de datos y reglas de negocio RB-nn explícitas.
- [ ] Enlace a Figma referenciado o declarado su estado.
- [ ] Checklist DoR/DoD presente con la nota de autoría de IA y revisor pendiente.
- [ ] Verificación automatizada ejecutando:
  ```bash
  python3 -I '/home/jose/Aybar-Corp/equipo-innovacion/NEXORA/.claude/skills/aybar-siguiente-paso/scripts/estado.py' '<ruta-del-paquete>'
  ```
