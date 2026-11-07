import { describe, it, expect, beforeEach } from 'vitest';
import { ajustarManifestPorRuta, esRutaAdmin } from '../manifestPorRuta';

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

  it('en /admin usa el manifest del panel', () => {
    ajustarManifestPorRuta('/admin/ingresar');
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest-admin.webmanifest');
  });

  it('en la carta deja el manifest de siempre', () => {
    ajustarManifestPorRuta('/');
    expect(document.querySelector('link[rel="manifest"]')?.getAttribute('href')).toBe('/manifest.webmanifest');
  });
});
