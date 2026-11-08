---
modulo: mirest
titulo: Configuración: Pantalla de ingreso
ruta: /admin/mirest
seccion: ingreso
activa_con: [tab=ingreso]
permiso: configuracion/editar
roles: [ADMIN]
relacionados: [pantallas, usuarios, mascota]
sugerencias:
  - ¿Cómo cambio las imágenes de la pantalla de ingreso?
  - ¿Cómo subo una foto propia al carrusel de ingreso?
  - ¿Cómo cambio la frase de bienvenida del ingreso?
  - ¿Por qué no veo la pestaña Pantalla de ingreso?
---
# Configuración: Pantalla de ingreso

## Para que sirve
Personaliza la pantalla donde el personal inicia sesión en el panel: hasta 5 fotos que rotan en un carrusel y una frase de bienvenida. El cambio se ve en la siguiente carga de la pantalla de ingreso, para todo el personal. Las pantallas de TV del local se manejan en [[pantallas]].

## Como se hace: elegir y ordenar las imágenes del carrusel
1. Entra a Configuración del local y pulsa la pestaña "Pantalla de ingreso" ([Pantalla de ingreso](/admin/mirest?tab=ingreso)). Solo la ve quien tiene configuracion/editar.
2. En "Imágenes elegidas" están las fotos en el orden en que rotan (hasta 5). Usa "Subir" y "Bajar" para cambiar el orden; "Quitar" la saca del carrusel sin borrarla del sistema.
3. En "Biblioteca de imágenes" marca una foto para agregarla o desmárcala para quitarla. Con varias imágenes la pantalla las rota sola cada 6 segundos.

## Como se hace: subir una foto propia
1. Pulsa "Subir foto propia" y elige una imagen JPG, PNG o WebP. El navegador la reduce antes de subirla.
2. Queda en la biblioteca y se agrega al carrusel si hay lugar (máximo 5).

## Como se hace: cambiar la frase de la pantalla
1. En "Frase de la pantalla" escribe hasta 80 caracteres (sin los símbolos < o >). Vacía, se usa "Hecho a mano, servido con cariño".

## Como se hace: guardar los cambios
1. Pulsa "Guardar pantalla de ingreso" y confirma con "Sí, guardar".
2. El servidor guarda la respuesta unos 60 segundos: si no ves el cambio, recarga la página de ingreso.

## Ajustes: Pantalla de ingreso
- **Imágenes elegidas del carrusel de ingreso (orden)**: Fotos que rotan en la pantalla donde el personal inicia sesión (hasta 5), en el orden de la lista. Subir y Bajar cambian el orden; Quitar la saca del carrusel sin borrarla del sistema. Ejemplo: Pon primero «Caprichos del mes» para que sea la primera foto que ve el equipo al ingresar. Permiso: configuracion/editar. [Imágenes elegidas del carrusel de ingreso (orden)](/admin/mirest?tab=ingreso&campo=ingreso-carrusel)
- **Biblioteca de imágenes del carrusel (marcar o desmarcar)**: Imágenes de fábrica y fotos propias disponibles. Marcar una la agrega al carrusel; desmarcarla la quita. No se borra del sistema. Permiso: configuracion/editar. [Biblioteca de imágenes del carrusel (marcar o desmarcar)](/admin/mirest?tab=ingreso&campo=ingreso-biblioteca)
- **Subir foto propia para la pantalla de ingreso**: Sube una foto JPG, PNG o WebP propia; el navegador la reduce antes de enviarla. Queda en la biblioteca y se agrega al carrusel si hay lugar (máximo 5). Permiso: configuracion/editar. [Subir foto propia para la pantalla de ingreso](/admin/mirest?tab=ingreso&campo=ingreso-subir-foto)
- **Frase de la pantalla de ingreso**: Texto de bienvenida que ve el personal al ingresar. Máximo 80 caracteres; vacía se usa «Hecho a mano, servido con cariño». Ejemplo: Hecho a mano, servido con cariño. Permiso: configuracion/editar. [Frase de la pantalla de ingreso](/admin/mirest?tab=ingreso&campo=ingreso-frase)
- **Guardar pantalla de ingreso**: Aplica las imágenes elegidas, su orden y la frase. El cambio se ve en la siguiente carga de la pantalla de ingreso, para todo el personal. Permiso: configuracion/editar. [Guardar pantalla de ingreso](/admin/mirest?tab=ingreso&campo=ingreso-guardar)

## Errores y dudas comunes
- No veo la pestaña "Pantalla de ingreso": solo la ve quien tiene el permiso configuracion/editar (el Administrador).
- No puedo elegir una sexta imagen: el máximo es 5; quita una antes.
- "La imagen propia … no existe en el sistema": la foto no se subió completa o fue eliminada; vuelve a subirla.
- La frase no se guarda: no puede pasar de 80 caracteres ni contener < o >.

## Quien puede hacerlo
Solo el Administrador: las imágenes y la frase de la pantalla de ingreso requieren el permiso configuracion/editar.
