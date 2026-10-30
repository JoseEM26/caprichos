import sharp from 'sharp';

/** Mismas reglas que apps/web/src/carta/TarjetaProducto.tsx: palabras de más de 2 letras, máximo 2, primera en mayúscula. */
export function inicialesProducto(nombre: string): string {
  return String(nombre ?? '')
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

// Colores de la carta (apps/web/src/estilos/tema.css: --cp-gold y --cp-navy)
const ORO = '#D99E39';
const AZUL_MARINO = '#0B2C3E';
export const LADO_IMAGEN_INICIAL = 800;

/**
 * SVG cuadrado dorado con las iniciales en azul marino. Montserrat ExtraBold si el servidor la tiene;
 * si no, cae a DejaVu Sans / sans-serif en negrita (la imagen de Docker instala ttf-dejavu).
 */
export function svgImagenInicial(iniciales: string): string {
  const L = LADO_IMAGEN_INICIAL;
  const t = iniciales.replace(/[<>&"']/g, '');
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${L}" height="${L}" viewBox="0 0 ${L} ${L}">` +
    `<rect width="${L}" height="${L}" fill="${ORO}"/>` +
    `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" fill="${AZUL_MARINO}" font-size="${L * 0.4}" ` +
    `font-weight="800" font-family="Montserrat, 'DejaVu Sans', sans-serif">${t}</text></svg>`
  );
}

const cache = new Map<string, Buffer>();

/** PNG de la imagen de iniciales, en memoria por nombre (el nombre decide las iniciales). */
export async function pngImagenInicial(nombre: string): Promise<Buffer> {
  const clave = inicialesProducto(nombre);
  let png = cache.get(clave);
  if (!png) {
    png = await sharp(Buffer.from(svgImagenInicial(clave))).png().toBuffer();
    if (cache.size > 500) cache.clear();
    cache.set(clave, png);
  }
  return png;
}
