import { clienteFetch } from './api';
import { reducirImagenVoucher } from '../admin/vouchers/reducirImagenVoucher';

export interface ArchivoSubido {
  id: string;
  url: string;
}

/**
 * Reduce la imagen en el navegador y la sube a POST /admin/archivos.
 * Resuelve solo cuando el servidor respondió con el archivo guardado; si no, lanza el error.
 * Público (privado = false): el servidor la deja en WebP de 1200 px. Privado: se guarda tal cual (comprobantes).
 */
export async function subirImagenAlServidor(
  archivo: File,
  opciones: { privado?: boolean; maxDimension?: number } = {},
): Promise<ArchivoSubido> {
  const reducida = opciones.privado
    ? archivo
    : await reducirImagenVoucher(archivo, opciones.maxDimension ?? 1600, 0.85);
  const fd = new FormData();
  fd.append('archivo', reducida, archivo.name || 'imagen.jpg');
  if (opciones.privado) fd.append('privado', 'true');
  const res = await clienteFetch<ArchivoSubido>('/admin/archivos', { method: 'POST', body: fd });
  if (!res?.id) throw new Error('El servidor no devolvió la imagen guardada');
  return res;
}
