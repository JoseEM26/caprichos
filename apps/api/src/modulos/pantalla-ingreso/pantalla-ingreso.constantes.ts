export const CLAVE_PARAMETRO_IMAGENES_INGRESO = 'login_imagenes';
export const CLAVE_PARAMETRO_FRASE_INGRESO = 'login_frase';

/** Imágenes de fábrica (en apps/web/public/imagenes/caprichos/). */
export const IMAGENES_FABRICA = [
  'caprichos-de-octubre.webp',
  'donuts-halloween.webp',
  'fantasma-cafe.webp',
  'hechizo-pumpkin.webp',
  'caprichos-del-mes.webp',
] as const;

export const RUTA_IMAGENES_FABRICA = '/imagenes/caprichos/';
export const IMAGEN_INGRESO_POR_DEFECTO = 'fantasma-cafe.webp';
export const FRASE_INGRESO_POR_DEFECTO = 'Hecho a mano, servido con cariño';

export const MAX_IMAGENES_INGRESO = 5;
export const MAX_LONGITUD_FRASE_INGRESO = 80;

/** Solo rutas de archivos públicos propios subidos al sistema (ver ArchivosService.subirArchivo). */
export const REGEX_ARCHIVO_PUBLICO = /^\/archivos\/publico\/[A-Za-z0-9_\-/]+\.webp$/;
