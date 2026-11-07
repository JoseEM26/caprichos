// La app instalable del panel (/admin) y la de la carta (/) son distintas: cada una con su propio manifest, así que al instalar
// desde el panel se abre el panel (no la carta virtual).
const MANIFEST_ADMIN = '/manifest-admin.webmanifest';

export function esRutaAdmin(ruta: string): boolean {
  return ruta === '/admin' || ruta.startsWith('/admin/');
}

/** Pone el manifest del panel cuando la ruta es /admin. En otras rutas no toca nada (la carta conserva el suyo). */
export function ajustarManifestPorRuta(ruta: string = window.location.pathname): void {
  if (typeof document === 'undefined' || !esRutaAdmin(ruta)) return;
  const link =
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]') ??
    document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'manifest' }));
  if (link.getAttribute('href') !== MANIFEST_ADMIN) link.setAttribute('href', MANIFEST_ADMIN);
}
