import { clienteFetch } from '../../comun/api';
import { subirImagenAlServidor } from '../../comun/subidaImagen';

/** Clave de la versión vieja (solo navegador). Se migra al servidor y luego se limpia. */
export const CLAVE_FOTOS_NAVEGADOR = 'caprichos_fotos_local';

export interface FotoLocal {
  slot: string;
  orden: number;
  archivoId: string;
  url: string;
}

const ruta = (slot: string) => `/admin/local/fotos/${encodeURIComponent(slot)}`;

export const listarFotosLocal = () => clienteFetch<FotoLocal[]>('/admin/local/fotos');

export const ponerFotoLocal = (slot: string, archivoId: string) =>
  clienteFetch<FotoLocal>(ruta(slot), {
    method: 'PUT',
    body: JSON.stringify({ archivoId }),
  });

/** Sube la imagen (con reducción) y la pone en el slot. Resuelve solo si el servidor guardó todo. */
export async function subirFotoLocal(slot: string, archivo: File): Promise<FotoLocal> {
  const subida = await subirImagenAlServidor(archivo);
  return ponerFotoLocal(slot, subida.id);
}

export const quitarFotoLocal = (slot: string) => clienteFetch(ruta(slot), { method: 'DELETE' });

/** Convierte una data URL (base64) en Blob sin depender de fetch. */
export function dataUrlABlob(dataUrl: string): Blob {
  const coma = dataUrl.indexOf(',');
  const tipo = dataUrl.slice(5, coma).split(';')[0] || 'image/jpeg';
  const binario = atob(dataUrl.slice(coma + 1));
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

/**
 * Sube al servidor las fotos que quedaron solo en este navegador (localStorage) y que el servidor
 * todavía no tiene en ese slot. Si todas se suben, limpia la clave; si alguna falla, la conserva.
 */
export async function migrarFotosDelNavegador(
  fotosServidor: FotoLocal[],
): Promise<{ recuperadas: number; fallidas: number }> {
  let guardadas: Record<string, unknown> = {};
  try {
    const crudo = localStorage.getItem(CLAVE_FOTOS_NAVEGADOR);
    if (!crudo) return { recuperadas: 0, fallidas: 0 };
    guardadas = JSON.parse(crudo) ?? {};
  } catch {
    return { recuperadas: 0, fallidas: 0 };
  }

  const pendientes = Object.entries(guardadas).filter(
    ([slot, valor]) =>
      typeof valor === 'string' &&
      valor.startsWith('data:') &&
      !fotosServidor.some((f) => f.slot === slot),
  );

  let recuperadas = 0;
  let fallidas = 0;
  for (const [slot, valor] of pendientes) {
    try {
      const blob = dataUrlABlob(valor as string);
      const archivo = new File([blob], `${slot}.jpg`, { type: blob.type });
      await subirFotoLocal(slot, archivo);
      recuperadas++;
    } catch {
      fallidas++;
    }
  }

  if (fallidas === 0) {
    try {
      localStorage.removeItem(CLAVE_FOTOS_NAVEGADOR);
    } catch {
      // Sin acceso a localStorage no hay nada que limpiar
    }
  }
  return { recuperadas, fallidas };
}
