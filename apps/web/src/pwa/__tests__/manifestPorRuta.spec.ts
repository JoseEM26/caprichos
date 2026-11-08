import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect, beforeEach } from 'vitest';
import { APPS_PWA, ajustarManifestPorRuta, appDeRuta, esRutaAdmin } from '../manifestPorRuta';

const web = resolve(__dirname, '../../..');
const leer = (f: string) => JSON.parse(readFileSync(resolve(web, 'public', f), 'utf8'));

describe('manifest por ruta', () => {
  beforeEach(() => {
    document.head.innerHTML = '<link rel="manifest" href="/manifest.webmanifest">';
  });

  it('reconoce las rutas del panel', () => {
    expect(esRutaAdmin('/admin')).toBe(true);
    expect(esRutaAdmin('/admin/pedidos')).toBe(true);
    expect(esRutaAdmin('/administrador')).toBe(false);
    expect(esRutaAdmin('/')).toBe(false);
  });

  it('elige la app por ruta; ?instalar= manda sobre la ruta', () => {
    expect(appDeRuta('/', '')).toBe('carta');
    expect(appDeRuta('/mis-pedidos', '')).toBe('carta');
    expect(appDeRuta('/admin/pedidos', '')).toBe('admin');
    expect(appDeRuta('/admin/mi-asistencia', '')).toBe('asistencia');
    expect(appDeRuta('/admin/', '?instalar=asistencia')).toBe('asistencia');
    expect(appDeRuta('/admin/', '?instalar=otra')).toBe('admin');
  });

  it('el link rel=manifest cambia según la ruta', () => {
    ajustarManifestPorRuta('/admin/ingresar', '');
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest-admin.webmanifest');
    ajustarManifestPorRuta('/admin/mi-asistencia', '');
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest-asistencia.webmanifest');
    ajustarManifestPorRuta('/', '');
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest.webmanifest');
    ajustarManifestPorRuta('/', '?instalar=admin');
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest-admin.webmanifest');
  });

  it('el script de index.html pone el manifest dentro del <head>, antes de que el navegador lo pida', () => {
    const html = readFileSync(resolve(web, 'index.html'), 'utf8');
    expect(html).toContain("'/manifest.webmanifest'");
    expect(html).toContain("'/manifest-' + a + '.webmanifest'");
    expect(html).toContain('/admin/mi-asistencia');
    expect(html.indexOf('/manifest-')).toBeLessThan(html.indexOf('</head>'));
  });

  it('cada app tiene id, start_url y scope propios, y el start_url cae dentro de su scope', () => {
    const admin = leer('manifest-admin.webmanifest');
    const asistencia = leer('manifest-asistencia.webmanifest');
    const vite = readFileSync(resolve(web, 'vite.config.ts'), 'utf8');
    expect(vite).toContain("id: '/'");
    expect(vite).toContain("start_url: '/'");
    expect(vite).toContain("scope: '/'");

    expect([admin.id, admin.start_url, admin.scope, admin.name]).toEqual(['/admin/', '/admin/', '/admin/', 'Caprichos Admin']);
    expect([asistencia.id, asistencia.start_url, asistencia.scope, asistencia.name]).toEqual([
      '/admin/mi-asistencia',
      '/admin/mi-asistencia',
      '/admin/',
      'Caprichos Asistencia',
    ]);
    expect(new Set(['/', admin.id, asistencia.id]).size).toBe(3);
    for (const m of [admin, asistencia]) expect(m.start_url.startsWith(m.scope)).toBe(true);
    expect(APPS_PWA.admin.manifest).toBe('/manifest-admin.webmanifest');
    expect(APPS_PWA.asistencia.manifest).toBe('/manifest-asistencia.webmanifest');
  });
});
