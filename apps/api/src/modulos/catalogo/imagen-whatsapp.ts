import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { pngImagenInicial } from './imagen-inicial';

// WhatsApp muestra la tarjeta del carrusel apaisada (~5:3) y recorta lo que no entra: la imagen ya va en 5:3
const ANCHO = 1200;
const ALTO = 720;
const MAX_CACHE = 600;
const cache = new Map<string, Buffer>();

/**
 * JPEG 5:3 con el producto completo al centro (contain) sobre la misma foto ampliada y difuminada de fondo,
 * para que WhatsApp no corte el vaso. Con iniciales si no tiene foto local legible.
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
  const fondo = await sharp(entrada)
    .resize(ANCHO, ALTO, { fit: 'cover' })
    .flatten({ background: '#ffffff' })
    .blur(28)
    .modulate({ brightness: 0.85 })
    .toBuffer();
  const frente = await sharp(entrada)
    .resize(ANCHO, ALTO, { fit: 'inside' })
    .flatten({ background: '#ffffff' })
    .toBuffer();
  const jpg = await sharp(fondo)
    .composite([{ input: frente, gravity: 'center' }])
    .jpeg({ quality: 85 })
    .toBuffer();
  if (cache.size >= MAX_CACHE) cache.delete(cache.keys().next().value as string);
  cache.set(clave, jpg);
  return jpg;
}
