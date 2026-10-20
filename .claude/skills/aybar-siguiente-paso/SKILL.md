---
name: aybar-siguiente-paso
description: Use cuando el usuario trabaja en un paquete de análisis y diseño Aybar (carpetas adr/, historias/, features/, epicas/, dor/, gates/, backlog/) y pregunta qué sigue, en qué estado está, qué falta para cerrar un gate (G0-G4), o antes de dar por "listo" cualquier documento. Corre un script de solo lectura que cuenta documentos, valida frontmatter y trazabilidad, y dice el siguiente paso (incluye la carpeta operacion/ de DevOps).
---

# Aybar · qué paso sigue

> **REGLA DE TRABAJO (innegociable): un documento a la vez, aprobado por el usuario antes del siguiente.**
> 1. Crea **un solo** documento (o una sola sección si es muy largo) y **detente**.
> 2. Muéstraselo al usuario y espera su visto bueno explícito. Si pide cambios, corrige ese mismo documento.
> 3. Solo con su aprobación pasa al siguiente, empezando por el primero de la cadena (intake → BRD → épica/feature → diseño → ADR → HU → DoR → tareas).
> 4. **Nunca generes varios documentos, carpetas o copias de golpe**, ni reorganices el paquete, sin que el usuario lo haya pedido paso a paso. Tampoco delegues la creación en masa a otros agentes.
> 5. Si el trabajo toca archivos existentes, pregunta antes: no muevas, copies ni borres por tu cuenta.

Marco del TL (registro de decisiones R1-R16): **no se escribe código hasta que G3 y G4 estén `approved` con evidencia**. La IA propone; el humano firma. Solo `approved` es evidencia para un gate.

## Cómo usarla

1. Ubícate en la raíz del paquete (la carpeta que contiene `adr/`, `historias/`, `gates/`…) y corre:
   ```bash
   python3 -I .claude/skills/aybar-siguiente-paso/scripts/estado.py .
   ```
2. Lee la salida: conteos por tipo, estado de G0-G4, **incumplimientos** y **SIGUIENTE PASO**.
3. Dile al usuario el siguiente paso en una frase y los incumplimientos más graves. No inventes estados: lo que el script no midió, dilo.

## Qué mide el script (y qué no)

Mide: frontmatter obligatorio (`id, tipo, titulo, estado, producto, version, owner, aprobadores, fecha, relacionados, tags`); ids citados en `relacionados` que no existen; HU sin épica o sin feature en su cabecera; feature sin DoR; épica sin JSON de tareas; HU sin tareas; ADR que ningún HU/FT/DoR cita; tareas sin estimar; estado de G0-G4.

**No mide:** si el contenido es correcto, si las firmas son reales, ni si el diseño es bueno. Un paquete sin incumplimientos y todo en `draft` sigue sin poder cerrar ningún gate.

## Orden de los gates (el primero sin `approved` manda)

| Gate | Aprueba | Qué exige | Documentos |
|---|---|---|---|
| G0 Intake | PO | Ficha de intake | `analisis/ficha-intake.md` |
| G1 Discovery | PO + Stakeholder | BRD, objetivos medibles, alcance, riesgos | `analisis/BRD.md`, `roadmap/`, `epicas/` |
| G2 Design | PO + Stakeholder | Mockup Figma enlazado y versionado (lo hace UX) | enlace en sección 04 de cada HU con pantalla |
| G3 Architecture | TL | ADR con contexto/opciones/decisión/consecuencias, "Compatibilidad con M0" o dispensa, costo cloud | `adr/`, `arquitectura/`, `datos/` |
| G4 DoR | PO + TL | HU formato Aybar, DoR por feature, tareas, plan de pruebas | `historias/`, `dor/`, `backlog/tareas/`, `pruebas/` |

Cambio T3 (crítico): aprueban PO + Stakeholder + TL. El acto formal de cada gate es el **correo de formalización**; el documento `gates/<ticket>/Gn.md` va adjunto.

## Qué hacer según el resultado

- **Faltan documentos o hay incumplimientos de trazabilidad** → usar la skill `aybar-generar-documento` para crearlos o corregirlos, y volver a correr el script.
- **Todo en `draft` y sin incumplimientos** → el siguiente paso es humano: enviar el correo del gate, no escribir más documentos. Prepara el paquete de envío (`gates/.../Gn.md`) y di quién debe firmar.
- **Un documento contradice `analisis/decisiones.md`** → manda el registro; corrige el documento.
- **Decisión pendiente (D-xx, O-xx)** → no la resuelvas tú: déjala escrita como pendiente con su recomendación.

## Reglas que no se rompen

- Lo que no está en una fuente no se escribe como hecho: el campo queda vacío con la decisión pendiente que lo llenará.
- Cada documento dice qué generó la IA y quién lo revisó (`Generado por IA: … — Revisado por: (pendiente)`).
- La IA no firma, no marca `approved` y no cierra gates.
- Las copias publicadas del paquete no se editan: se edita en `access-control-service/docs/` (o el repo origen) y se vuelve a copiar.

## DevOps, plataforma e infraestructura (DT-51)

- `estado.py` también revisa el frontmatter de `operacion/` (runbooks, plan de release, revisión de seguridad e inventario).
- Si el paquete no tiene épica habilitadora de plataforma o le faltan los runbooks mínimos (publicar y volver atrás, restaurar una copia, servicio caído, servidor nuevo, rotar claves), dilo como siguiente paso: sin ellos no se puede preparar G7 ni G8 (skill `aybar-devops-operacion`).
