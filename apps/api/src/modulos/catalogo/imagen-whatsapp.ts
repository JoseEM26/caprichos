import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { pngImagenInicial } from './imagen-inicial';

const LADO = 800;
const MAX_CACHE = 600;
const cache = new Map<string, Buffer>();

/**
 * JPEG cuadrado (cover) de la foto del producto, o de sus iniciales si no tiene foto local legible.
 * Caché en memoria por (id, ruta, tamaño y mtime del archivo). ponytail: solo memoria; a disco si el reinicio pesa.
 */
export async function jpegProductoWhatsApp(id: string, nombre: string, ruta: string | null, uploadsDir: string): Promise<Buffer> {
  let archivo: string | null = null;
  let firma = 'iniciales';
  if (ruta && !/^https?:\/\//i.test(ruta)) {
    const base = path.resolve(uploadsDir);
    const abs = path.resolve(base, ruta.replace(/^\/+/, ''));
    try {
      const st = fs.statSync(abs);
      if (abs.startsWith(base + path.sep) && st.isFile()) {
        archivo = abs;
        firma = `${ruta}|${st.size}|${st.mtimeMs}`;
      }
    } catch {
      /* sin archivo: iniciales */
    }
  }
  const clave = `${id}|${firma}|${archivo ? '' : nombre}`;
  const hit = cache.get(clave);
  if (hit) return hit;
  const entrada = archivo ? fs.readFileSync(archivo) : await pngImagenInicial(nombre);
  const jpg = await sharp(entrada)
    .resize(LADO, LADO, { fit: 'cover' })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 82 })
    .toBuffer();
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(clave, jpg);
  return jpg;
}
