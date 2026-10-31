import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MosaicoMomentos, repartirEnColumnas } from '../MosaicoMomentos';
import type { FotoMosaico } from '../MosaicoMomentos';
import { ProveedorEdicion } from '../edicion';
import type { ModoEdicion } from '../edicion';

const fotos = (n: number, prefijo = 'f'): FotoMosaico[] =>
  Array.from({ length: n }, (_, i) => ({ id: `${prefijo}${i}`, url: `/archivos/${prefijo}${i}.webp` }));

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

  it('muestra solo sus fotos, sin repetirlas ni rellenar con imágenes de otro lugar', () => {
    render(<MosaicoMomentos fotos={fotos(3)} />);
    const imagenes = Array.from(screen.getByTestId('mosaico-momentos').querySelectorAll('img'));
    expect(imagenes.map((i) => i.getAttribute('src'))).toEqual(['/archivos/f0.webp', '/archivos/f1.webp', '/archivos/f2.webp']);
  });

  it('en la carta pública sin fotos no pinta nada', () => {
    const { container } = render(<MosaicoMomentos titulo="Momentos Caprichos" fotos={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('en PC usa 4 columnas con 8 fotos e imágenes con alt y lazy por defecto', () => {
    render(<MosaicoMomentos fotos={fotos(8)} />);
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
    render(<MosaicoMomentos fotos={fotos(6)} />);
    expect(screen.getByTestId('mosaico-momentos').style.gridTemplateColumns).toBe('repeat(2, minmax(0, 1fr))');
  });

  it('muestra el encabezado y carga la primera fila de forma inmediata si es prioritaria', () => {
    render(<MosaicoMomentos titulo="Momentos Caprichos" fotos={fotos(8)} prioritaria />);
    expect(screen.getByText('Momentos Caprichos')).toBeInTheDocument();
    const imagenes = Array.from(screen.getByTestId('mosaico-momentos').querySelectorAll('img'));
    expect(imagenes.filter((img) => img.getAttribute('loading') === 'eager')).toHaveLength(4);
    expect(imagenes.filter((img) => img.getAttribute('loading') === 'lazy')).toHaveLength(4);
  });

  it('en edición envuelve cada foto con su clave propia y ofrece «+ Agregar foto»', () => {
    const ed: ModoEdicion = {
      cambiarTexto: vi.fn(),
      bloque: vi.fn((clave: string, hijo: any) => <div data-testid={`bloque-${clave}`}>{hijo}</div>),
      agregar: vi.fn((clave: string, etiqueta: string) => <button key="agregar">{etiqueta} ({clave})</button>),
      accion: vi.fn(),
    };
    render(
      <ProveedorEdicion value={ed}>
        <MosaicoMomentos fotos={fotos(2, 'g')} claveFotos="galeria" conAgregar />
      </ProveedorEdicion>,
    );
    expect(screen.getByTestId('bloque-galeria:g0')).toBeTruthy();
    expect(screen.getByTestId('bloque-galeria:g1')).toBeTruthy();
    expect(screen.getByText('Agregar foto (galeria)')).toBeTruthy();
  });

  it('en edición sin fotos igual muestra «+ Agregar foto» para empezar', () => {
    const ed: ModoEdicion = {
      cambiarTexto: vi.fn(),
      bloque: vi.fn((_c: string, hijo: any) => hijo),
      agregar: vi.fn((_c: string, etiqueta: string) => <button key="a">{etiqueta}</button>),
      accion: vi.fn(),
    };
    render(
      <ProveedorEdicion value={ed}>
        <MosaicoMomentos fotos={[]} claveFotos="momento" conAgregar />
      </ProveedorEdicion>,
    );
    expect(screen.getByText('Agregar foto')).toBeTruthy();
  });
});
