---
name: aybar-gate
description: Use cuando hay que redactar o auditar un paquete de envío de gate (G0 a G4) para formalizar el paso entre etapas en el paquete Aybar.
---

# Aybar · Generar paquete de envío de Gate (G0 a G4)

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.**
> 1. Crea **un solo** documento (o una sola sección si es muy largo) y **detente**.
> 2. Muéstraselo al usuario y espera su visto bueno explícito. Si pide cambios, corrige ese mismo documento.
> 3. Solo con su aprobación pasa al siguiente, empezando por el primero de la cadena (intake → BRD → épica/feature → diseño → ADR → HU → DoR → tareas).
> 4. **Nunca generes varios documentos, carpetas o copias de golpe**, ni reorganices el paquete, sin que el usuario lo haya pedido paso a paso. Tampoco delegues la creación en masa a otros agentes.
> 5. Si el trabajo toca archivos existentes, pregunta antes: no muevas, copies ni borres por tu cuenta.

> **CARPETA DESTINO (fija): `<paquete>/gates/<ticket>/`** — archivo `Gn.md`. El nombre de la carpeta es exactamente ese y no se cambia (mismo esquema que `Roles y permisos`). `<paquete>` es la carpeta del proyecto en curso. Si la carpeta no existe, créala con ese nombre al guardar el primer documento de este tipo; no la crees antes ni dejes el archivo suelto en la raíz.

Especializada en la redacción y auditoría de documentos estándar de envío de gate (`Gn.md`) dentro del marco de refinamiento y diseño Aybar.

## 1. Para qué sirve y en qué gate entra

El documento de envío consolida las evidencias críticas para formalizar el cierre de un gate. El acto formal de entrega es el correo de formalización; este documento acompaña como adjunto.
- **Aprobadores y bloqueos según el gate:**
  - **G0 (Intake Gate):** Aprueba **Product Owner (PO)**. Bloquea: entrada al backlog.
  - **G1 (Discovery Gate):** Aprueba **PO (Stakeholder firma BRD)**. En cambio T3 aprueban PO + Stakeholder + TL. Bloquea: paso a requisitos.
  - **G2 (Design Gate):** Aprueba **PO + UX**. Bloquea: que la HU sea Ready.
  - **G3 (Architecture Gate):** Aprueba **Technical Lead (TL)**. Bloquea: inicio del desarrollo.
  - **G4 (Definition of Ready):** Aprueba **PO**. Bloquea: entrada al sprint.
- **Modelos de referencia:** `gates/AYB-1042/G0.md`, `gates/AYB-1042/G1.md`, `gates/AYB-1042/G2.md`, `gates/AYB-1042/G3.md` y `gates/AYB-1042/G4.md`.

## 2. Frontmatter obligatorio y convenciones

El archivo debe ubicarse en `gates/<ticket>/Gn.md` (ej. `gates/AYB-1042/G3.md`).

```yaml
---
id: GATE-<ticket>-Gn
tipo: spec
titulo: Envío de Gn <Nombre del Gate> — <ticket>
estado: draft
producto: aybarcorp
version: "1.0"
owner: "(pendiente — R16)"
aprobadores: []
fecha: AAAA-MM-DD
relacionados: [<ticket>, <GATE anterior o artefacto de entrada>]
tags: [gate, gn, envio]
---
```

## 3. Secciones obligatorias en orden estricto

Tomadas estrictamente de `gates/AYB-1042/G0.md` a `G4.md`:

1. `# Estándar de envío · Gn · <Nombre del Gate>`
   Párrafo de introducción: tipo de documento, quién aprueba, qué bloquea y mención expresa de que el acto formal es el correo.
2. `## 1 · Correo de formalización`
   Tabla con los campos exactos:
   `| De | Para | Fecha | Asunto | Pedido | Adjunto |`
   (Asunto en formato: `[Gn] · <Artefacto o tema> · <servicio> · T3`).
3. `## 2 · Identificación del cambio`
   Tabla con los campos exactos:
   `| Ticket / ID | Tipo | Producto | Owner de negocio | Documento | Gate que se pide cerrar | Aprobador del gate | Qué bloquea si falta | Duplicado de ítem existente |`.
4. `## 3 · Paquete de evidencias críticas de negocio`
   Tabla con las columnas:
   `| Evidencia crítica de negocio | Qué debe contener | Enlace (commit) | ¿Cumple? |`
   Solo el estado `approved` cuenta como evidencia válida cumplida; si los documentos están en `draft`, el estado es `No` o `Parcial`.
5. `## 4 · Firmas`
   Tabla con las filas exactas de roles:
   `| Rol | Nombre | Fecha | Decisión |`
   Roles: `Stakeholder`, `Product Owner`, `UX/UI Designer`, `Technical Lead`, `QA Engineer`, `Data Chief / Directorio`.
   Nota obligatoria al pie: `La IA no cierra gates ni aprueba pull requests. Nadie se auto-aprueba.`
6. Pie de trazabilidad:
   `Generado por IA: llenado del estándar y estado de cada evidencia — Revisado por: *(pendiente)*`

## 4. Reglas y errores típicos

- **La IA no aprueba ni firma:** Las celdas de nombre y fecha en firmas quedan vacías; `estado` en frontmatter siempre es `draft` y `aprobadores: []`.
- **Solo `approved` es cumplimiento:** Nunca marcar `¿Cumple? = Sí` a un documento que permanezca en `draft`. Enlazar a commits o rutas del repositorio, nunca chats.
- **R16 (nombres de roles):** Si no hay un nombre asignado (ej. PO, Owner de negocio, UX), dejar como `*(pendiente — R16)*`, no inventar identidades.
- **Ticket y trazabilidad:** El ticket (ej. `AYB-1042`) debe coincidir en la ruta `gates/<ticket>/`, en el ID del frontmatter y en la sección 2.
- **Nadie se auto-aprueba:** El solicitante y el aprobador deben ser distintos roles según la matriz de gobierno.

## 5. Checklist final de verificación

1. [ ] Archivo ubicado en `gates/<ticket>/Gn.md`.
2. [ ] Frontmatter completo con `id: GATE-<ticket>-Gn`, `tipo: spec`, `estado: draft` y `aprobadores: []`.
3. [ ] 4 secciones numeradas en orden exacto: 1 Correo, 2 Identificación, 3 Evidencias críticas, 4 Firmas.
4. [ ] Tabla de correo y tabla de identificación completas con sus campos requeridos.
5. [ ] Columna `¿Cumple?` refleja rigurosamente el estado real de los artefactos (`No` o `Parcial` si están en `draft`).
6. [ ] Tabla de firmas con los 6 roles corporativos y nota de auto-aprobación.
7. [ ] Trazabilidad de generación por IA presente.
8. [ ] Ejecutar verificación de estado:
   `python3 -I '/home/jose/Aybar-Corp/equipo-innovacion/NEXORA/.claude/skills/aybar-siguiente-paso/scripts/estado.py' '<ruta-del-paquete>'`

## 6. Documento modelo a copiar

Copiar estructura de `gates/AYB-1042/G3.md` (o `G0.md`, `G1.md`, `G2.md`, `G4.md` según corresponda al gate a enviar).
