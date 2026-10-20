# Qué preguntar cuando falta algo

Pregunta con `AskUserQuestion` (si no está disponible, pregunta en el chat con las opciones numeradas), en lenguaje simple y con opciones concretas, una cosa a la vez y empezando por lo imprescindible. Si el usuario no sabe, propón la opción más segura y dile qué consecuencia tiene en el gráfico.

## Imprescindible

**No se encontraron las HU (`historias/`).**
"No encontré las historias de usuario. ¿Dónde están?"
- Están en otra carpeta del proyecto → pide la ruta y vuelve a correr el extractor sobre ella.
- Están en Jira o en un Excel → pide el archivo exportado (CSV o XLSX) y arma `proyecto.json` a mano (`references/formato-datos.md`).
- No existen todavía → explica que el gráfico necesita al menos la lista de HU con su épica y feature, y detente.

**No se encontraron dependencias (`backlog/tareas/*.json`).**
"No encontré el backlog de tareas, que es de donde salen las flechas. ¿Cómo quieres que obtenga qué HU va antes de cuál?"
- Leerlas del texto de cada HU (sección «Reglas, dependencias y evidencias», frases como «HU-X va antes»). El extractor ya las encontró: di cuántas (`revision`) y avisa que suelen estar incompletas, así que el gráfico tendrá menos flechas. Si acepta, corre `aplicar_revision.py <proyecto.json> --como-base`: pasan a ser las dependencias principales, sin notas de diferencias (no hay backlog con qué comparar).
- El usuario las da en una tabla o un Excel (HU → depende de).
- Construir sin dependencias: no tiene sentido (todo quedaría en el paso 1). No lo ofrezcas como opción.

**HU sin épica o sin feature** (avisos del extractor).
Muestra la lista y pregunta a qué épica y feature pertenece cada una. Si son muchas, pregunta si hay otra fuente (por ejemplo la tabla de features de cada épica).

## Recomendable

**Prioridad no reconocida.**
"Estas HU no tienen una prioridad que reconozca (Alta / Media / Baja / No esta vez). ¿Cómo las clasifico?"
Opciones: como "Debe tener" (por defecto), como la prioridad de su feature, o que el usuario la indique.

**No se encontró el roadmap con los DEP-xx.**
"Las HU mencionan bloqueos externos (DEP-01, DEP-06…), pero no encontré su descripción. ¿Los describo yo o me pasas la lista?"
Si no hay respuesta, deja solo los códigos.

**Hay HU «No esta vez».**
"¿Qué significa «No esta vez» en este proyecto? (por ejemplo: fuera de alcance por ahora, siguiente fase, capa B)". Va a `fueraDeAlcance`.

## Opcional

**No hay Definition of Ready (`dor/`).**
No hace falta preguntar: el panel no mostrará "Lo que falta resolver" y lo demás funciona igual. Solo menciónalo al final.

**Nombre del proyecto.**
El extractor usa el nombre de la carpeta. Si no parece un nombre presentable, pregunta cómo debe aparecer arriba de la página.

## Diferencias entre el texto de las HU y el backlog

No es un faltante, pero sí requiere decisión del usuario (paso 3 del flujo). Preséntalas así:

| HU | El texto dice | El backlog dice | Qué significa |
|---|---|---|---|
| HU-061 | HU-043 va después | no lo tiene | El backlog lo omitió |
| HU-010 | HU-012 va antes | al revés | Se necesitan mutuamente en partes distintas |

Recomienda aplicarlas con notas. Recuerda que no se corrige la documentación del proyecto, solo el gráfico.
