import { subirImagenAlServidor } from '../../../comun/subidaImagen';
import type { FotoGaleria } from '../../../carta/conocenosContenido';
import { normalizarUrlArchivo } from '../paletas-constantes';
import { moverIndice, reubicar } from './mover';
import { subirFotoEdicion } from './subirFoto';

/** Clave de la versión vieja de «Fotos del local» (solo navegador). Se recupera una vez y luego se limpia. */
export const CLAVE_FOTOS_NAVEGADOR = 'caprichos_fotos_local';

let secuencia = 0;
/** Id de una foto nueva: único dentro de la sesión del editor. */
export const nuevaFotoId = () => `nueva-${Date.now()}-${secuencia++}`;

/** Abre el selector de archivos del sistema y entrega la imagen elegida. Lo llama un clic del usuario. */
export function elegirFoto(alElegir: (archivo: File) => void): void {
  const entrada = document.createElement('input');
  entrada.type = 'file';
  entrada.accept = 'image/*';
  entrada.onchange = () => {
    const archivo = entrada.files?.[0];
    if (archivo) alElegir(archivo);
  };
  entrada.click();
}

/** Mueve una foto una posición arriba (-1) o abajo (1). */
export const moverFoto = (lista: FotoGaleria[], id: string, dir: -1 | 1): FotoGaleria[] =>
  moverIndice(lista, lista.findIndex((f) => f.id === id), dir);

/** Arrastrar y soltar: la clave de origen es `${prefijo}${id}`; la foto se deja en el lugar de `idDestino`. */
export function reubicarFoto(lista: FotoGaleria[], desde: string, idDestino: string, prefijo: string): FotoGaleria[] {
  return reubicar(
    lista,
    lista.findIndex((f) => `${prefijo}${f.id}` === desde),
    lista.findIndex((f) => f.id === idDestino),
  );
}

/** Quitar y mostrar solo cambian `activo`: nada se borra. */
export const cambiarActivo = (lista: FotoGaleria[], id: string, activo: boolean): FotoGaleria[] =>
  lista.map((f) => (f.id === id ? { ...f, activo } : f));

/** Pone la foto nueva (ya subida) en el lugar de la anterior. Se aplica sobre la lista al momento, no la de antes de subir. */
export const ponerUrlFoto = (lista: FotoGaleria[], id: string, url: string): FotoGaleria[] =>
  lista.map((f) => (f.id === id ? { ...f, url } : f));

/** Una foto nueva al final de la lista, ya subida al servidor. */
export async function agregarFotoArchivo(archivo: File): Promise<FotoGaleria> {
  const url = await subirFotoEdicion(archivo);
  return { id: nuevaFotoId(), url, activo: true };
}

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
 * Fotos que quedaron solo en este navegador de la versión anterior y que todavía no están en la galería
 * (las que ya tienen su lugar de origen en la galería se saltan). Si todas se suben, limpia la clave.
 */
export async function recuperarFotosDelNavegador(galeria: FotoGaleria[]): Promise<FotoGaleria[]> {
  let guardadas: Record<string, unknown> = {};
  try {
    const crudo = localStorage.getItem(CLAVE_FOTOS_NAVEGADOR);
    if (!crudo) return [];
    guardadas = JSON.parse(crudo) ?? {};
  } catch {
    return [];
  }
  const yaEstan = new Set(galeria.map((f) => f.origen).filter(Boolean));
  const pendientes = Object.entries(guardadas).filter(
    ([slot, valor]) => typeof valor === 'string' && valor.startsWith('data:') && !yaEstan.has(slot),
  );

  const recuperadas: FotoGaleria[] = [];
  let fallidas = 0;
  for (const [slot, valor] of pendientes) {
    try {
      const blob = dataUrlABlob(valor as string);
      const archivo = new File([blob], `${slot}.jpg`, { type: blob.type });
      const subida = await subirImagenAlServidor(archivo);
      recuperadas.push({ id: nuevaFotoId(), url: normalizarUrlArchivo(subida.url) || subida.url, activo: true, origen: slot });
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
  return recuperadas;
}
