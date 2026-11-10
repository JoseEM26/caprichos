/** URL pública de la foto de un archivo guardado (ruta relativa → /archivos/…; si ya es una URL, tal cual). */
export function obtenerFotoUrl(archivo?: { ruta: string } | null): string | null {
  if (!archivo?.ruta) return null;
  if (archivo.ruta.startsWith('http://') || archivo.ruta.startsWith('https://')) {
    return archivo.ruta;
  }
  const limpia = archivo.ruta.replace(/^\/+/, '');
  return `/archivos/${limpia}`;
}
