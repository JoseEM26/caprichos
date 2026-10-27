import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  armarMosaicoMomentos,
  MosaicoMomentos,
  repartirEnColumnas,
} from '../MosaicoMomentos';
import { IMAGENES_MARCA_FABRICA } from '../../comun/imagenesMarca';

const esDeFabrica = (src: string) => IMAGENES_MARCA_FABRICA.includes(src);

/** Vecinas en la misma fila (índices consecutivos) y en la misma columna (saltos de `columnas`). */
function hayVecinasIguales(lista: string[], columnas: number): boolean {
  for (let i = 0; i < lista.length; i++) {
    if (i + 1 < lista.length && lista[i] === lista[i + 1]) return true;
    if (i + columnas < lista.length && lista[i] === lista[i + columnas]) return true;
  }
  return false;
}

describe('armarMosaicoMomentos', () => {
  it('sin fotos propias llena con las de fábrica repetidas, sin vecinas iguales', () => {
    for (const cantidad of [4, 8, 12, 20]) {
      const lista = armarMosaicoMomentos([], cantidad);
      expect(lista).toHaveLength(cantidad);
      expect(lista.every(esDeFabrica)).toBe(true);
      expect(hayVecinasIguales(lista, 2)).toBe(false);
      expect(hayVecinasIguales(lista, 3)).toBe(false);
      expect(hayVecinasIguales(lista, 4)).toBe(false);
    }
  });

  it('usa las 5 fotos de fábrica (no solo una) al repetir', () => {
    const lista = armarMosaicoMomentos([], 10);
    expect(new Set(lista).size).toBe(5);
  });

  it('pone primero las fotos propias y completa con fábrica', () => {
    const propias = ['/archivos/publico/2026/10/a.webp', '/archivos/publico/2026/10/b.webp'];
    const lista = armarMosaicoMomentos(propias, 6);
    expect(lista).toHaveLength(6);
    expect(lista.slice(0, 2)).toEqual(propias);
    expect(lista.slice(2).every(esDeFabrica)).toBe(true);
  });

  it('muestra todas las propias aunque superen la cantidad, sin repetir', () => {
    const propias = ['/a.webp', '/b.webp', '/a.webp', '/c.webp', '/d.webp'];
    const lista = armarMosaicoMomentos(propias, 3);
    expect(lista).toEqual(['/a.webp', '/b.webp', '/c.webp', '/d.webp']);
  });

  it('ignora entradas vacías', () => {
    const lista = armarMosaicoMomentos(['', '/x.webp'], 2);
    expect(lista[0]).toBe('/x.webp');
    expect(lista).toHaveLength(2);
  });
});

describe('repartirEnColumnas', () => {
  it('reparte en columnas por turnos sin perder elementos', () => {
    const cols = repartirEnColumnas([1, 2, 3, 4, 5], 2);
    expect(cols).toEqual([
      [1, 3, 5],
      [2, 4],
    ]);
  });
});

describe('MosaicoMomentos (render)', () => {
  afterEach(() => {
    delete (window as any).matchMedia;
  });

  it('en PC usa 4 columnas y llena la cantidad pedida con imágenes con alt y lazy por defecto', () => {
    render(<MosaicoMomentos cantidad={8} />);

    const grilla = screen.getByTestId('mosaico-momentos');
    expect(grilla.style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');

    const imagenes = grilla.querySelectorAll('img');
    expect(imagenes).toHaveLength(8);
    imagenes.forEach((img) => {
      expect(img.getAttribute('loading')).toBe('lazy');
      expect(img.getAttribute('alt')).toMatch(/Momento Caprichos/);
    });
  });

  it('en celular usa 2 columnas', () => {
    window.matchMedia = vi.fn().mockImplementation((q: string) => ({
      matches: q.includes('max-width: 699px'),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })) as any;

    render(<MosaicoMomentos cantidad={6} />);
    expect(screen.getByTestId('mosaico-momentos').style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('muestra el encabezado y carga la primera fila de forma inmediata si es prioritaria', () => {
    render(<MosaicoMomentos titulo="Momentos Caprichos" cantidad={8} prioritaria />);

    expect(screen.getByText('Momentos Caprichos')).toBeInTheDocument();
    const imagenes = Array.from(screen.getByTestId('mosaico-momentos').querySelectorAll('img'));
    // Con 4 columnas, la primera fila (4 imágenes) carga de inmediato y el resto de forma perezosa.
    expect(imagenes.filter((img) => img.getAttribute('loading') === 'eager')).toHaveLength(4);
    expect(imagenes.filter((img) => img.getAttribute('loading') === 'lazy')).toHaveLength(4);
  });

  it('prioriza las fotos propias al renderizar', () => {
    render(<MosaicoMomentos fotos={['/archivos/publico/2026/10/propia.webp']} cantidad={3} columnas={1} />);
    const imagenes = Array.from(screen.getByTestId('mosaico-momentos').querySelectorAll('img'));
    expect(imagenes[0].getAttribute('src')).toBe('/archivos/publico/2026/10/propia.webp');
  });
});
