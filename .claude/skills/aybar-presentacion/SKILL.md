---
name: aybar-presentacion
description: Use cuando hay que armar una presentación (artifact de slides) con la marca Aybar, por ejemplo para exponer un requerimiento, un paquete de documentos del Marco o una propuesta al líder técnico. Fija colores, tipografía, logos, estructura de láminas y los tropiezos ya resueltos.
---

# Aybar · Presentación con la marca Aybar

Guía para armar una presentación como **artifact de slides** con la identidad de Aybar Corp. Nació de la presentación de aybar-mcp (16 láminas) y deja ya resuelto lo que costó trabajo: los logos, la paleta, las plantillas de lámina y el orden de un requerimiento.

## 1. Cuándo se usa

- El usuario pide una presentación, una exposición o "un artifact para presentar" algo (un requerimiento, una propuesta, el estado del paquete de análisis y diseño).
- Es **un artifact de tipo Slides**, no un `.pptx`. Si el usuario pide expresamente un `.pptx`, usar la skill de pptx.
- No sustituye a los documentos del Marco: la presentación **resume** el paquete (ficha, BRD, épicas, features, ADR, HU, DoR, tareas, plan de pruebas), no lo reemplaza. Si hay paquete, **léelo antes** y no inventes cifras que no estén ahí.

## 2. Identidad Aybar (sale de `aybar-platform-front-digital`, `resources/css/core/tokens/`)

| Elemento | Valor |
|---|---|
| Primario (verde petróleo) | `#02424E` |
| Secundario (naranja) | `#FFA726` |
| Fondo principal (hueso) | `#FBF9F4` |
| Fondo alterno (hueso oscuro) | `#F1EFE8` |
| Tarjeta clara | `#FFFFFF`, borde `#E2DFD6` |
| Texto principal | `#1F2D31` |
| Texto secundario | `#4A5A5E` (sobre claro) · `#D6E8EA` y `#9CC0C5` (sobre verde) |
| Píldora o franja suave | `#E4EEEF` |
| Tipografía | **Instrument Sans** (Google Fonts): `https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400..700&display=swap` |

Reglas de color:
- **Predomina el blanco hueso**, como pidió el usuario; el verde petróleo va en títulos, en una o dos láminas oscuras (portada y cierre) y en las tarjetas destacadas.
- **El naranja es acento de forma**: barra corta bajo el encabezado, numerales en recuadro, flechas, cifras sobre verde. **No lo uses como color de texto sobre hueso** (no alcanza el contraste); sobre naranja, texto verde `#02424E`.
- Nada de blanco ni negro puros fuera de las tarjetas.

## 3. Logos (ya convertidos, en `assets/`)

| Archivo | Se usa sobre | Texto del logo |
|---|---|---|
| `assets/logo-sobre-claro.svg` | fondos hueso o blancos | verde petróleo |
| `assets/logo-sobre-oscuro.svg` | fondos verde petróleo | blanco |

**Ojo con los nombres originales** en `aybar-platform-front-digital/public/assets/imagen/`: están al revés de lo que parece. `logo-aybar-corp-verde.svg` lleva texto **blanco** (es para fondos verdes) y `logo-aybar-corp-blanco.svg` lleva texto **verde** (es para fondos blancos).

**Por qué hay copias convertidas:** los originales usan estilos CSS internos (`<style>` y clases), y el almacén de la presentación **borra los `<style>`**; el logo saldría sin color. Las copias de `assets/` ya llevan el color como atributo `fill`. Si hay que convertir otro logo, cambiar cada `class="..."` por `fill="#..."` leyendo el color de su regla, y quitar `<defs>`, `<style>` y el `DOCTYPE`.

## 4. Procedimiento

1. **Entender el pedido:** a quién se presenta, qué decisión se busca, cuántas láminas. Si hay un paquete de documentos, leer lo que se va a resumir. Si el usuario nombra un sistema de diseño distinto, usarlo en lugar de esta guía. Existe el artifact **Aybar Design System** (https://claude.ai/artifact/AaoPfHNYzBVR52dPHZHWg2) con los mismos tokens, la escala de tipos de presentación y los logos; si el usuario lo pide, instalarlo en la presentación en lugar de copiar los valores a mano. Si no, esta guía es suficiente.
2. **Crear el artifact:** `Artifact` con `action: "quickstart"` e `intent: "slides"`; luego publicar con el `type_url` que devuelva, un `title` (nombre corto de la presentación) y `auto_open: "after_first_write"`. Seguir las instrucciones del tipo que devuelve la creación.
3. **Subir los logos** como assets del artifact (`asset: true`, `file_paths` con los dos SVG de `assets/`). Guardar las dos URLs `/_blob/<id>` que devuelve y usarlas tal cual en `<img src>`.
4. **Escribir primero `project/deck.json`** completo (título, `order` con todas las láminas, `sections`, `faces` con Instrument Sans, `designSystems: []`) y la **portada**; publicar los dos de una vez. Luego las láminas **de tres en tres**, cada tanda con una sola publicación.
5. **No verificar** (abrir, renderizar, capturar) a menos que el usuario lo pida. Al final, entregar el enlace y decir que el artifact es **privado** hasta que lo comparta desde el menú Share.
6. Si el usuario pide cambios, editar solo las láminas nombradas y publicar los archivos cambiados.

Las plantillas HTML de cada tipo de lámina están en `references/plantillas.md`.

## 5. Estructura recomendada para exponer un requerimiento (≈16 láminas)

| # | Lámina | Fondo |
|---|---|---|
| 1 | Portada: nombre, subtítulo, para quién y fecha | verde |
| 2 | El problema: 3 dolores concretos | hueso |
| 3 | El propósito: una frase y 3 resultados, más lo que *no* es | hueso oscuro |
| 4 | La solución: las piezas y cómo se conectan (3 columnas con flechas) | hueso |
| 5–7 | Cómo funciona: un flujo de 5 pasos por lámina (los 3 flujos principales) | alterna |
| 8 | Servicios: tabla Servicio · Para qué · Estado | hueso |
| 9 | Alcance: cifras (épicas, features, HU, ADR, tareas, casos) y las épicas | hueso oscuro |
| 10–11 | Las historias de usuario agrupadas por feature | alterna |
| 12 | Decisiones tomadas: tabla Tema · Decidido | hueso |
| 13 | Datos y seguridad: qué sale y qué nunca sale | hueso oscuro |
| 14 | Plan: olas de construcción y horas | hueso |
| 15 | Pendientes y riesgos | hueso oscuro |
| 16 | Cierre: «¿Empezamos?» y lo que se pide | verde |

Adaptar: menos láminas si el tema es chico; el orden problema → propósito → solución → flujos → alcance → decisiones → plan → pedido casi siempre funciona.

## 6. Reglas de contenido

- **Una idea por lámina.** Título corto que anuncia el tema; el detalle va en tarjetas, tablas o pasos.
- **Texto de 24 px o más**, en todas partes (pies, celdas y etiquetas incluidos). Tamaños usados: 150 (portada), 88 (cierre), 64 (título), 38–30 (subtítulos y cuerpo), 26–24 (apoyo).
- **Cifras solo de fuente.** Horas, costos y conteos salen del paquete. Si una estimación es aproximada o de la IA, **la lámina lo dice**; lo que no tiene fuente va como «por definir».
- **Datos sensibles:** nunca poner claves, tokens ni datos reales en una lámina o en las notas.
- **Notas del orador** en cada lámina (`<aside>` al final): qué decir, qué aclarar y qué historia o documento respalda.
- **Pie en cada lámina** (salvo la portada): nombre corto a la izquierda, `NN / total` a la derecha. **Si se añaden o quitan láminas, actualizar el total** en todos los pies.
- **Aprobaciones:** la presentación no aprueba nada. Si muestra estados del paquete, decir «borrador» mientras los documentos estén en `draft`.

## 7. Tropiezos ya resueltos

- Las **flechas** son `<x-shape kind="arrow-right">` de 40×32 entre tarjetas; con 5 pasos en fila caben tarjetas de ~280 px con texto de 26 px.
- Una **tabla de más de 7 u 8 filas** con texto largo no cabe en 824 px de alto: usar tarjetas en dos columnas o partir la lámina.
- **Listas largas de historias:** dos columnas de bloques con borde naranja a la izquierda (`border-left:6px solid #FFA726`), título del bloque en negrita y una línea por historia.
- En la tabla, el **ancho se fija con `width:N%` en cada celda de la primera fila** y el color de fondo va en el `<tr>`, no en las celdas.
- Los números en recuadro naranja se hacen con un `<p>` de ancho y alto iguales y `line-height` igual al alto.
- El logo va fijado arriba a la derecha (96×96) en las láminas de contenido y a 200×200 arriba a la izquierda en la portada.
- `<ul>` solo admite `<li>` planos; sin listas anidadas.
- El token de la API de OpenAI u otras credenciales **nunca** se pegan en una presentación.
