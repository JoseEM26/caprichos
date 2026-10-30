import { api, clienteFetch } from '../../comun/api';

export type TipoImagenIngreso = 'defecto' | 'archivo';

export interface ImagenIngresoConfig {
  tipo: TipoImagenIngreso;
  /** defecto: nombre de la imagen de fábrica; archivo: ruta pública /archivos/publico/... */
  valor: string;
}

/** Respuesta pública de GET /carta/ingreso: URLs ya resueltas. */
export interface PantallaIngresoPublica {
  imagenes: string[];
  frase: string;
}

/** Respuesta admin de GET/PUT /admin/pantalla-ingreso. */
export interface PantallaIngresoAdmin {
  imagenes: ImagenIngresoConfig[];
  frase: string;
  fabrica: string[];
}

export const RUTA_IMAGENES_FABRICA = '/imagenes/caprichos/';
export const IMAGEN_INGRESO_DEFECTO = `${RUTA_IMAGENES_FABRICA}fantasma-cafe.webp`;
export const FRASE_INGRESO_DEFECTO = 'Hecho a mano, servido con cariño';
export const MAX_IMAGENES_INGRESO = 5;
export const MAX_FRASE_INGRESO = 80;
export const IMAGENES_FABRICA_INGRESO = [
  'caprichos-de-octubre.webp',
  'donuts-halloween.webp',
  'fantasma-cafe.webp',
  'hechizo-pumpkin.webp',
  'caprichos-del-mes.webp',
] as const;

/** URL con la que se muestra una imagen configurada. */
export function urlImagenIngreso(img: ImagenIngresoConfig): string {
  return img.tipo === 'defecto' ? `${RUTA_IMAGENES_FABRICA}${img.valor}` : img.valor;
}

export const pantallaIngresoApi = {
  /** Público, sin sesión: lo usa la pantalla de ingreso. */
  obtenerPublica: () => api.get<PantallaIngresoPublica>('/carta/ingreso'),

  /** Solo ADMIN (configuracion/editar). */
  obtenerAdmin: () => api.get<PantallaIngresoAdmin>('/admin/pantalla-ingreso'),

  guardar: (datos: { imagenes: ImagenIngresoConfig[]; frase: string }) =>
    api.put<PantallaIngresoAdmin>('/admin/pantalla-ingreso', datos),

  /** Sube una imagen propia (ya reducida en el navegador) como archivo público. */
  subirImagen: async (archivo: Blob, nombre = 'pantalla-ingreso.jpg'): Promise<string> => {
    const fd = new FormData();
    fd.append('archivo', archivo, nombre);
    const res = await clienteFetch<{ id: string; url: string }>('/admin/archivos', {
      method: 'POST',
      body: fd,
    });
    return res.url;
  },
};
