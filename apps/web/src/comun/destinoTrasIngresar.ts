/**
 * Adonde volver tras iniciar sesión. Solo rutas internas del panel (/admin/...), nunca URLs externas
 * ni //host. Lo que no cumple cae en /admin.
 */
export function destinoTrasIngresar(desde: unknown): string {
  if (typeof desde !== 'string') return '/admin';
  const interna = /^\/admin(\/[^\s]*)?$/.test(desde) && !desde.startsWith('//');
  return interna && !desde.startsWith('/admin/ingresar') ? desde : '/admin';
}
