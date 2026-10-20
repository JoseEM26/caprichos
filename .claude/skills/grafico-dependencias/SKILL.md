---
name: grafico-dependencias
description: Crea el "Gráfico de dependencias" de AybarCorp para un proyecto, una página interactiva (artifact) que muestra qué épicas, features e historias de usuario (HU) se construyen antes que otras, qué puede ir en paralelo, por dónde empezar, la ruta hasta cualquier pieza y qué la detiene (Definition of Ready, bloqueos externos). Úsala siempre que alguien pida un mapa, grafo, diagrama u orden de dependencias del backlog, la ruta crítica o el orden de construcción de épicas/features/HU, qué se puede trabajar en paralelo, por dónde empezar un proyecto, o "el gráfico de dependencias como el de Roles y permisos", aunque no diga la palabra "skill" ni "artifact". Lee la documentación estándar de Aybar (epicas/, features/, historias/, backlog/tareas/*.json, dor/, roadmap) y pregunta lo que falte.
---

# Gráfico de dependencias (AybarCorp)

Genera una página que responde, a simple vista: **¿por dónde empezamos, qué va en paralelo y qué nos detiene?** La página es la misma para todos los proyectos de Aybar; lo que cambia son los datos. Tú extraes los datos del proyecto, los revisas con el usuario y construyes la página con los scripts de esta skill.

Qué trae la página (para que sepas explicarlo):
- Vistas por **Épica** (siempre horizontal), **Feature** y **HU**, como red de cajas y flechas de izquierda a derecha. Cada columna es un **Paso**: el paso 1 es lo que no necesita nada antes; lo del mismo paso puede ir en paralelo.
- Solo flechas directas (si A→B→C no se dibuja A→C) y un acomodo calculado para cruzar lo mínimo.
- Clic en una caja: en azul lo que necesita antes, en naranja lo que desbloquea; panel con sus HU/features ("Ver todas →"), su épica/feature ("Ver →"), **Qué te detiene** (HU previas, para empezar y para terminar, y lo pendiente según el Definition of Ready) y **Ver ruta hasta aquí**.
- Filtro por prioridad (Debe tener, Debería, Podría, No esta vez; esta última oculta por defecto) y "Ruta hasta…" con lista copiable por pasos.
- Paleta AybarCorp, solo tema claro.

## Requisitos

`python3` y `node` (v16 o más). Google Chrome es opcional (para revisar capturas). Los scripts están en `scripts/` de esta skill; no necesitan internet (dagre va incluido).

## Flujo

### 1. Extraer los datos

Ubica la carpeta del proyecto (la que contiene `epicas/`, `historias/`, etc.; puede estar dentro de `docs/`). Corre:

```bash
python3 <skill>/scripts/extraer_aybar.py "<carpeta del proyecto>" "<carpeta de trabajo>/proyecto.json"
```

Imprime un resumen: cuántas épicas, features, HU y dependencias encontró, la prioridad, los Definition of Ready, las diferencias entre el texto de las HU y el backlog, y una sección **NO ENCONTRADO**. Usa una carpeta de trabajo fuera del repositorio del proyecto (por ejemplo el scratchpad de la sesión); no ensucies su documentación.

### 2. Completar lo que falte, preguntando

Si aparece **NO ENCONTRADO** o hay avisos importantes, no inventes datos: pregunta al usuario con `AskUserQuestion` (o en el chat, si esa herramienta no está), dando opciones concretas. Las preguntas y qué hacer con cada respuesta están en `references/preguntas.md`. Lo imprescindible es: la lista de HU, la épica y feature de cada HU, y las dependencias entre HU. Sin dependencias no hay gráfico: si no existe `backlog/tareas/`, esa es la primera pregunta.

Cuando el usuario te dé los datos en otro formato (Excel, Jira, una tabla en el chat), escríbelos tú en `proyecto.json` siguiendo `references/formato-datos.md`.

### 3. Revisar con el usuario tres cosas antes de construir

Si el proyecto no tenía backlog de tareas y se usaron las frases del texto como dependencias (`--como-base`), salta el punto 1: no hay diferencias que revisar.

1. **Diferencias entre el texto de las HU y el backlog** (`revision` en proyecto.json). Muéstralas en una tabla simple: qué dice el texto, qué dice el backlog y qué significa. Recomienda aplicarlas: el gráfico incluye lo que dice el texto y cada HU afectada muestra la nota "No coincidía en la documentación". Si acepta (todas o algunas):
   ```bash
   python3 <skill>/scripts/aplicar_revision.py "<trabajo>/proyecto.json"            # todas
   python3 <skill>/scripts/aplicar_revision.py "<trabajo>/proyecto.json" --solo HU-ABC-061,HU-ABC-010
   ```
   Avisa que agregar dependencias puede cambiar el acomodo del gráfico (aparecen flechas largas). En el proyecto donde nació esta skill, el usuario se molestó cuando el gráfico cambió sin avisarle.
2. **Etiquetas de los bloqueos externos** (`externos`). El extractor copia la descripción del roadmap, que suele ser larga y técnica. Reescríbelas cortas y en lenguaje simple (≤ 60 caracteres), por ejemplo `"DEP-06": "Mockups en Figma"`. Quita nombres de personas, de otros equipos o de proyectos internos: la página se proyecta en reuniones con el PO y usuarios.
3. **Qué significa "No esta vez"** en este proyecto (`fueraDeAlcance`), por ejemplo "fuera de alcance por ahora (capa B)". Pregunta solo si hay HU con esa prioridad.

Revisa también `proyecto.nombre` (aparece arriba de la página) y `proyecto.prefijoId` (el extractor lo deduce: `-IDN-` hace que HU-IDN-010 se muestre como HU-010).

### 3b. Redactar en lenguaje simple (lo que hace que la página se entienda sin abrir documentos)

Los textos originales de la documentación son técnicos y están llenos de siglas. El extractor los deja en `crudo` (épicas y features), en `hus[].historia` (como / quiero / para) y en `codigos` (D-##, O##, G#, DEP-xx, con su texto original, responsable y la ruta del documento). Con eso, escribe en `proyecto.json`:

- `logros[id]` para cada épica, feature y HU: **qué se logra al terminarla**. Épica y feature: 2 o 3 oraciones, máximo 320 caracteres. HU: 1 o 2 oraciones, máximo 220.
- En cada código de `codigos`:
  - D-## (decisión): `pregunta` (la decisión escrita como pregunta, ≤160) y `propuesta` (≤200; empieza con "Ya decidida:" o "Corregida:" si el original lo dice).
  - O## (pregunta abierta): `simple` (qué falta definir, ≤180).
  - G# (puerta): `nombre` (≤40, por ejemplo "Diseño de pantallas aprobado") y `simple` (qué se aprueba, ≤140).
  - DEP-xx (bloqueo externo): `nombre` (≤60) y `simple` (qué hace falta y para qué, ≤180).

Reglas de estilo, porque esto lo lee el PO en una reunión: español claro, oraciones cortas, voz activa; sin nombres de tablas o campos, sin siglas técnicas (RF, RN, ADR, FK, OIDC, token…: tradúcelas a lo que significan); sin nombres de personas ni de proyectos o sistemas internos de otros equipos; sin inventar nada que el original no diga. Con más de 50 textos, reparte el trabajo entre subagentes en paralelo con estas mismas reglas y luego revisa una muestra. Avisa al usuario que son resúmenes redactados y que conviene revisarlos.

Con esto, la página muestra en el panel "Qué se logra", cada código se abre con su explicación y la ruta corta del documento (por ejemplo `analisis/decisiones.md · D-22`), los pendientes se agrupan por quién los resuelve (el TL, quién aprueba, a cargo de UX…) y el botón **¿Qué significa?** abre un glosario con buscador.

### 4. Construir

```bash
node <skill>/scripts/construir.js "<trabajo>/proyecto.json" "<proyecto>/grafico-dependencias.html"
```

Si el gráfico ya se había publicado y solo cambian textos, agrega `--acomodo "<proyecto>/grafico-dependencias.html"` (el HTML anterior) para conservar el mismo acomodo de cajas: el usuario se fija en dónde está cada cosa y no quiere que se mueva.

Tarda alrededor de un minuto con 60 HU (usa `--rapido` para pruebas). Al final imprime cuántos cruces quedaron en cada vista y la verificación **"ninguna dependencia se pierde al simplificar las flechas"**. Si dice que se perdieron dependencias, o hay avisos de HU sin épica o feature, corrígelo antes de seguir.

Guarda el HTML en la carpeta del proyecto (o donde el usuario prefiera) para poder volver a publicarlo.

### 5. Revisar cómo se ve

Si hay Chrome, toma una captura de la vista por HU y de una selección (los scripts de la página exponen `st`, `render()`, `navTo()`):

```bash
cp grafico.html /tmp/prev.html && echo '<script>st.lvl="hu";render();</script>' >> /tmp/prev.html
google-chrome --headless=new --no-sandbox --window-size=1600,1000 --virtual-time-budget=6000 --screenshot=/tmp/hu.png file:///tmp/prev.html
```

Mira la captura con la herramienta Read. Si algo se ve mal, corrígelo antes de publicar.

### 6. Publicar

Publica el HTML con la herramienta **Artifact** (título "Gráfico de dependencias", icono `map`, una descripción de una línea). Si no está disponible, entrega la ruta del archivo HTML: se abre con doble clic en cualquier navegador. Recuerda al usuario que el artifact es privado hasta que lo comparta desde el menú Compartir.

### 7. Informar

En lenguaje simple: cuántas épicas, features y HU; por dónde se empieza (las cajas del paso 1); cuántos pasos hay (aclara que no son semanas ni sprints); las diferencias de documentación aplicadas; y qué revisaste y qué no.

## Criterios que el usuario original dejó claros

- **Lenguaje para el PO**: nada de jerga interna. Se dice "Paso" (no "oleada"), "Necesita antes / Desbloquea a" (no "predecesora"). La página habla al público, no al presentador.
- **Fiel a la documentación**: no inventes dependencias ni cambies las del proyecto. Si el texto de una HU y el backlog no coinciden, se muestra y se explica; no se esconde.
- **No modifiques la documentación del proyecto**. Las diferencias se reportan; corregirlas es tarea de quien la mantiene.
- **Avisa antes de cambios que muevan el gráfico**: el acomodo depende de las flechas. Cambiar datos lo reordena.
- **Honestidad al cerrar**: di qué verificaste (por ejemplo la verificación de dependencias y las capturas) y qué no (clics reales, otros tamaños de pantalla).

## Archivos de la skill

- `scripts/extraer_aybar.py`: lee la documentación estándar de Aybar y genera `proyecto.json`, con la lista de diferencias y lo que falta.
- `scripts/aplicar_revision.py`: aplica las diferencias aprobadas (dependencias del texto y notas).
- `scripts/construir.js`: calcula pasos, flechas directas y el acomodo con menos cruces, verifica y arma el HTML.
- `scripts/graphcore.js`, `scripts/dagre.min.js`: motor del gráfico (lo usan el script y la página).
- `assets/template.html`: la página; no la edites por proyecto, todo lo propio va en `proyecto.json`.
- `references/formato-datos.md`: formato de `proyecto.json`, para cuando armes los datos a mano.
- `references/preguntas.md`: qué preguntar cuando falta algo.
