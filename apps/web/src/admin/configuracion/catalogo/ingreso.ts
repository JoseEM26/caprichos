import type { EntradaConfig } from './tipos';

// Pestaña «Ingreso» (pantalla /admin/ingresar). Solo lo ve y edita quien tiene configuracion/editar.
const S = 'Pantalla de ingreso';

export const INGRESO: EntradaConfig[] = [
  { id: 'ingreso-carrusel', tab: 'ingreso', seccion: S, titulo: 'Imágenes elegidas del carrusel de ingreso (orden)', descripcion: 'Fotos que rotan en la pantalla donde el personal inicia sesión (hasta 5), en el orden de la lista. Subir y Bajar cambian el orden; Quitar la saca del carrusel sin borrarla del sistema.', ejemplo: 'Pon primero «Caprichos del mes» para que sea la primera foto que ve el equipo al ingresar.', permiso: 'configuracion/editar', palabras: ['login', 'inicio de sesion', 'carrusel', 'fondo', 'fotos', 'portada', 'orden', 'imagenes', 'ingresar'] },
  { id: 'ingreso-biblioteca', tab: 'ingreso', seccion: S, titulo: 'Biblioteca de imágenes del carrusel (marcar o desmarcar)', descripcion: 'Imágenes de fábrica y fotos propias disponibles. Marcar una la agrega al carrusel; desmarcarla la quita. No se borra del sistema.', permiso: 'configuracion/editar', palabras: ['biblioteca', 'imagenes', 'fotos', 'elegir imagen', 'login', 'carrusel'] },
  { id: 'ingreso-subir-foto', tab: 'ingreso', seccion: S, titulo: 'Subir foto propia para la pantalla de ingreso', descripcion: 'Sube una foto JPG, PNG o WebP propia; el navegador la reduce antes de enviarla. Queda en la biblioteca y se agrega al carrusel si hay lugar (máximo 5).', permiso: 'configuracion/editar', palabras: ['subir foto', 'foto propia', 'imagen', 'login', 'carrusel', 'cargar imagen'] },
  { id: 'ingreso-frase', tab: 'ingreso', seccion: S, titulo: 'Frase de la pantalla de ingreso', descripcion: 'Texto de bienvenida que ve el personal al ingresar. Máximo 80 caracteres; vacía se usa «Hecho a mano, servido con cariño».', ejemplo: 'Hecho a mano, servido con cariño', permiso: 'configuracion/editar', palabras: ['frase', 'bienvenida', 'login', 'texto', 'mensaje', 'lema', 'eslogan'] },
  { id: 'ingreso-guardar', tab: 'ingreso', seccion: S, titulo: 'Guardar pantalla de ingreso', descripcion: 'Aplica las imágenes elegidas, su orden y la frase. El cambio se ve en la siguiente carga de la pantalla de ingreso, para todo el personal.', permiso: 'configuracion/editar', palabras: ['guardar', 'aplicar', 'login', 'carrusel', 'frase'] },
];
