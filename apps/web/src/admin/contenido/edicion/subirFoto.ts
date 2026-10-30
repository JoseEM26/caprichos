import { clienteFetch } from '../../../comun/api';
import { reducirImagenVoucher } from '../../vouchers/reducirImagenVoucher';
import { normalizarUrlArchivo } from '../paletas-constantes';

/** Reduce la foto en el navegador y la sube; si no se puede subir, queda como imagen incrustada (borrador local). */
export async function subirFotoEdicion(archivo: File): Promise<string> {
  const reducida = await reducirImagenVoucher(archivo, 1600, 0.85);
  try {
    const fd = new FormData();
    fd.append('archivo', reducida, archivo.name || 'foto.jpg');
    const res = await clienteFetch<{ id: string; url: string }>('/admin/archivos', { method: 'POST', body: fd });
    if (res?.url) return normalizarUrlArchivo(res.url) || res.url;
  } catch {
    // respaldo abajo
  }
  return new Promise<string>((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = (ev) => resolve((ev.target?.result as string) || '');
    lector.onerror = () => reject(new Error('No se pudo leer la imagen'));
    lector.readAsDataURL(reducida);
  });
}
