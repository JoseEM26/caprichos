# Plantillas de láminas Aybar

Fragmentos listos para copiar. Se escriben dentro de `<section id="..." data-transition="fade" style="...">`, un archivo por lámina en `project/slides/<id>.html`. Sustituir `{{...}}`. Los logos son `/_blob/<id>`: el de `logo-sobre-claro.svg` para fondos claros y el de `logo-sobre-oscuro.svg` para fondos verdes.

Valores comunes: `FONT = 'Instrument Sans', Arial, sans-serif`.

## Sección base (fondo claro)

```html
<section id="{{id}}" data-transition="fade" style="background:#FBF9F4;color:#1F2D31;font-family:'Instrument Sans', Arial, sans-serif;padding:128px 128px 160px;display:flex;flex-direction:column;gap:44px">
```
Alternar el fondo con `#F1EFE8` para dar ritmo. Lámina oscura: `background:#02424E;color:#FFFFFF`.

## Encabezado (barra naranja, ceja y título)

```html
<div style="display:flex;flex-direction:column;gap:20px">
<div style="width:72px;height:8px;background:#FFA726;border-radius:4px"></div>
<p style="font-size:26px;font-weight:700;letter-spacing:3px;color:#02424E;text-transform:uppercase">{{Ceja}}</p>
<h2 style="font-size:64px;font-weight:700;line-height:1.1;color:#02424E">{{Título}}</h2>
</div>
```
En láminas oscuras: ceja `color:#FFA726`, título `color:#FFFFFF`.

## Pie, número y logo (al final de la sección, fijados)

```html
<img src="/_blob/{{id-logo-claro}}" alt="Logo de Aybar Corp" style="position:absolute;right:128px;top:56px;width:96px;height:96px;object-fit:contain">
<p style="position:absolute;left:128px;bottom:64px;width:1000px;font-size:24px;color:#6B7A7E">{{nombre corto}} · {{para quién}}</p>
<p style="position:absolute;right:128px;bottom:64px;width:240px;text-align:right;font-size:24px;color:#6B7A7E">{{NN}} / {{total}}</p>
<aside>{{notas del orador}}</aside>
```
En fondo verde: texto del pie `#9CC0C5` y logo oscuro.

## Portada (fondo verde)

```html
<section id="cover" data-transition="fade" style="background:#02424E;color:#FFFFFF;font-family:'Instrument Sans', Arial, sans-serif;padding:128px;display:flex;flex-direction:column;justify-content:flex-end;gap:36px">
<img src="/_blob/{{id-logo-oscuro}}" alt="Logo de Aybar Corp" style="position:absolute;left:128px;top:96px;width:200px;height:200px;object-fit:contain">
<p style="position:absolute;right:128px;top:128px;width:640px;font-size:28px;color:#9CC0C5;text-align:right">{{Equipo}} · {{fecha}}</p>
<p style="font-size:26px;font-weight:700;letter-spacing:3px;color:#02424E;background:#FFA726;padding:12px 28px;border-radius:40px;width:560px">{{ETIQUETA EN MAYÚSCULAS}}</p>
<h1 style="font-size:150px;font-weight:700;line-height:1;color:#FFFFFF">{{nombre}}</h1>
<h2 style="font-size:60px;font-weight:500;line-height:1.15;color:#D6E8EA;width:1400px">{{subtítulo}}</h2>
<p style="font-size:32px;color:#9CC0C5">{{una línea de contexto}}</p>
<aside>{{objetivo de la reunión}}</aside>
</section>
```

## Tres tarjetas con número (problema)

```html
<div style="display:flex;gap:32px">
<div style="flex:1;display:flex;flex-direction:column;gap:20px;background:#FFFFFF;padding:40px;border:1px solid #E2DFD6;border-radius:20px">
<p style="width:64px;height:64px;font-size:34px;font-weight:700;line-height:64px;text-align:center;background:#FFA726;color:#02424E;border-radius:16px">1</p>
<h3 style="font-size:38px;font-weight:700;line-height:1.2;color:#02424E">{{Título}}</h3>
<p style="font-size:30px;line-height:1.4;color:#4A5A5E">{{Texto}}</p>
</div>
</div>
```
Repetir la tarjeta tres veces.

## Pasos de un flujo (5 en fila con flechas)

```html
<div style="display:flex;gap:16px;align-items:stretch">
<div style="flex:1;display:flex;flex-direction:column;gap:14px;background:#FFFFFF;padding:28px;border:1px solid #E2DFD6;border-radius:20px">
<p style="width:52px;height:52px;font-size:28px;font-weight:700;line-height:52px;text-align:center;background:#FFA726;color:#02424E;border-radius:14px">1</p>
<h3 style="font-size:30px;font-weight:700;line-height:1.2;color:#02424E">{{Paso}}</h3>
<p style="font-size:26px;line-height:1.35;color:#4A5A5E">{{Detalle}}</p>
</div>
<x-shape kind="arrow-right" style="align-self:center;width:40px;height:32px;background:#FFA726"></x-shape>
</div>
```
El paso destacado usa `background:#02424E`, título blanco y detalle `#D6E8EA`. Debajo, una franja: `<p style="font-size:30px;line-height:1.4;color:#1F2D31;background:#E4EEEF;padding:28px 40px;border-radius:20px">…</p>`.

## Columnas con flechas (arquitectura)

Tres `div` con `flex:1` y, entre ellos, `<x-shape kind="arrow-right" style="align-self:center;width:72px;height:44px;background:#FFA726">`. Cada columna: una etiqueta `font-size:24px;font-weight:700;letter-spacing:2px;color:#6B7A7E;text-transform:uppercase` y tarjetas con título de 30 px en negrita y detalle de 24 px. Las tarjetas del núcleo propio van en verde (`#02424E`) con texto blanco.

## Cifras (fila de tarjetas)

```html
<div style="flex:1;display:flex;flex-direction:column;gap:6px;background:#FFFFFF;padding:24px;border:1px solid #E2DFD6;border-radius:18px">
<p style="font-size:80px;font-weight:700;line-height:1;color:#02424E">{{N}}</p>
<p style="font-size:24px;color:#4A5A5E">{{etiqueta}}</p>
</div>
```
Una tarjeta destacada: fondo `#02424E`, cifra `#FFA726`, etiqueta `#D6E8EA`.

## Tabla (servicios o decisiones)

```html
<table style="font-size:26px;color:#1F2D31">
<tr><th style="width:27%;text-align:left;color:#02424E">{{Col 1}}</th><th style="width:47%;text-align:left;color:#02424E">{{Col 2}}</th><th style="width:26%;text-align:left;color:#02424E">{{Col 3}}</th></tr>
<tr style="background:#FFFFFF"><td>…</td><td>…</td><td>…</td></tr>
<tr style="background:#F1EFE8"><td>…</td><td>…</td><td>…</td></tr>
</table>
```
Alternar el fondo de las filas. Máximo 7 u 8 filas y textos de una o dos líneas.

## Bloques de historias (dos columnas)

```html
<div style="display:flex;gap:64px">
<div style="flex:1;display:flex;flex-direction:column;gap:26px">
<div style="display:flex;flex-direction:column;gap:4px;border-left:6px solid #FFA726;padding:2px 0 2px 24px">
<p style="font-size:26px;font-weight:700;color:#02424E">{{Feature}}</p>
<p style="font-size:26px;color:#4A5A5E">{{HU-001 Título corto}}</p>
</div>
</div>
</div>
```

## Dos tarjetas con lista (por ejemplo, «sale» y «nunca sale»)

Dos `div` con `flex:1`, tarjeta clara y tarjeta verde, cada una con `<h3>` de 38 px y un `<ul style="font-size:30px;line-height:1.4">` de `<li>` planos. Debajo, píldoras: `<p style="font-size:26px;font-weight:600;color:#02424E;background:#E4EEEF;padding:12px 28px;border-radius:40px">…</p>`.

## Olas o etapas (cuatro tarjetas)

Cuatro `div` con `flex:1`: etiqueta `OLA N` (26 px, `letter-spacing:2px`), título de 34 px, una línea de 26 px, la cifra principal de 44 px en negrita y el detalle de 24 px. La primera ola va en verde para marcar por dónde se empieza.

## Cierre con pedido (fondo verde)

Título «¿Empezamos?» de 88 px en blanco, y una lista de 4 o 5 filas: recuadro naranja con número (56×56) y texto de 32 px en blanco. Logo oscuro arriba a la derecha.
