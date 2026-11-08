// Tres apps instalables e independientes: la carta (/), el panel (/admin) y la asistencia (/admin/mi-asistencia).
// Cada una tiene su manifest, su `id` único (así el navegador las trata como apps distintas y se pueden tener las tres a la vez),
// su `start_url` y su `scope`. Asistencia comparte scope /admin/ con el panel a propósito (si la sesión caduca, el login /admin/ingresar
// sigue dentro de la app); lo que evita que se pisen es su `id` propio.
// OJO: el mismo mapa está copiado en el script de arranque de index.html (corre antes de que el navegador pida el manifest).
export type AppPwa = 'carta' | 'admin' | 'asistencia';

export const APPS_PWA: Record<AppPwa, { manifest: string; inicio: string; nombre: string }> = {
  carta: { manifest: '/manifest.webmanifest', inicio: '/', nombre: 'Caprichos' },
  admin: { manifest: '/manifest-admin.webmanifest', inicio: '/admin/', nombre: 'Caprichos Admin' },
  asistencia: { manifest: '/manifest-asistencia.webmanifest', inicio: '/admin/mi-asistencia', nombre: 'Caprichos Asistencia' },
};

export const esRutaAdmin = (ruta: string): boolean => ruta === '/admin' || ruta.startsWith('/admin/');

/** App que corresponde a la ruta; `?instalar=carta|admin|asistencia` manda sobre la ruta. */
export function appDeRuta(ruta: string = window.location.pathname, search: string = window.location.search): AppPwa {
  const pedida = new URLSearchParams(search).get('instalar');
  if (pedida === 'carta' || pedida === 'admin' || pedida === 'asistencia') return pedida;
  if (ruta === '/admin/mi-asistencia' || ruta.startsWith('/admin/mi-asistencia/')) return 'asistencia';
  return esRutaAdmin(ruta) ? 'admin' : 'carta';
}

/** Deja en el <link rel="manifest"> el de la app de esta ruta. */
export function ajustarManifestPorRuta(ruta?: string, search?: string): void {
  if (typeof document === 'undefined') return;
  const href = APPS_PWA[appDeRuta(ruta, search)].manifest;
  const link =
    document.querySelector<HTMLLinkElement>('link[rel="manifest"]') ??
    document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'manifest' }));
  if (link.getAttribute('href') !== href) link.setAttribute('href', href);
}
