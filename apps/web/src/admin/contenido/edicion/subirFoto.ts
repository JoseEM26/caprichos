import { subirImagenAlServidor } from '../../../comun/subidaImagen';
import { normalizarUrlArchivo } from '../paletas-constantes';

/**
 * Sube la foto al servidor y devuelve su URL pública. Si la subida falla, lanza el error:
 * nunca se guarda una imagen incrustada (data URL) dentro del borrador.
 */
export async function subirFotoEdicion(archivo: File): Promise<string> {
  const res = await subirImagenAlServidor(archivo);
  return normalizarUrlArchivo(res.url) || res.url;
}
