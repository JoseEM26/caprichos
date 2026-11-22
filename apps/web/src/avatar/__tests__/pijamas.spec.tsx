import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

// Sin WebGL en jsdom: la escena 3D y las miniaturas se reemplazan por espías (igual que EditorAvatar.spec)
const escenas: { reconstruir: ReturnType<typeof vi.fn> }[] = [];
vi.mock('../escena', () => ({
  EscenaAvatar: class {
    reconstruir = vi.fn();
    accion = vi.fn();
    irA = vi.fn();
    dispose = vi.fn();
    constructor() {
      escenas.push(this);
    }
  },
  liberar: vi.fn(),
  luces: vi.fn(),
}));
vi.mock('../miniaturas', () => ({ crearMiniaturas: () => ({ pedir: vi.fn(), cancelar: vi.fn(), retrato: vi.fn(() => 'data:image/png;base64,AAAA'), dispose: vi.fn() }) }));
vi.mock('../../mascota/soporteWebGL', () => ({ tieneSoporteWebGL: () => true, prefiereMovimientoReducido: () => false }));

import EditorAvatar from '../EditorAvatar';
import { cargarAvatar } from '../piezas';
import { aplicarDisfraz, GRUPO_DESTACADOS, normalizar } from '../config';
import type { ConfigAvatar } from '../tipos';

const PIJAMAS = ['dz_kig_conejita', 'dz_kig_michi', 'dz_kig_diablito', 'dz_kig_perrito', 'dz_kig_osito'];
const NOMBRES = ['Conejita Fresa', 'Michi Caramelo', 'Diablito Arándano', 'Perrito Nube de Leche', 'Osito Latte'];
const ID_API = /^[a-z0-9_]{1,40}$/;

describe('registro de pijamas kigurumi', () => {
  const A = cargarAvatar();

  it('hay 5 disfraces destacados y nuevos, con ids que acepta la API', () => {
    const d = A.REG.disfraz.filter((x) => x.destacado);
    expect(d.map((x) => x.id)).toEqual(PIJAMAS);
    expect(d.map((x) => x.nombre)).toEqual(NOMBRES);
    for (const x of d) {
      expect(x.grupo).toBe(GRUPO_DESTACADOS);
      expect(x.nuevo).toBe(true);
      expect(x.id).toMatch(ID_API);
    }
  });

  it('cada pijama junta cuerpo entero, capucha y pantuflas que existen en el catálogo', () => {
    for (const id of PIJAMAS) {
      const d = A.buscar('disfraz', id)!;
      const ap = d.aplica as Record<string, { id: string }>;
      for (const cat of ['arriba', 'cabeza', 'calzado']) {
        expect(A.buscar(cat, ap[cat].id), `${id}/${cat}`).toBeDefined();
        expect(ap[cat].id).toMatch(ID_API);
      }
      expect(A.buscar('arriba', ap.arriba.id)).toMatchObject({ cubreAbajo: true });
      expect(A.buscar('cabeza', ap.cabeza.id)).toMatchObject({ sinCabello: true, ocultaCabello: true, orejasAltas: true });
    }
  });

  it('ninguna pieza nueva copia un personaje de otra marca (nombres propios de Caprichos)', () => {
    const todos = [...A.REG.disfraz, ...A.REG.arriba, ...A.REG.cabeza, ...A.REG.calzado].filter((x) => /^dz_(kig_|capucha_|pantufla_)/.test(x.id));
    expect(todos.length).toBeGreaterThanOrEqual(17);
    for (const x of todos) expect(x.nombre.toLowerCase()).not.toMatch(/kitty|melody|kuromi|cinnamoroll|pompompurin|pochacco|sanrio/);
  });

  it('aplicarDisfraz deja el avatar con la pijama puesta y sin accesorios ni cara pintada', () => {
    const c = aplicarDisfraz(A, normalizar(A, null, 'Lu'), A.buscar('disfraz', 'dz_kig_michi')!);
    expect(c.disfrazId).toBe('dz_kig_michi');
    expect([c.arriba.id, c.cabeza.id, c.calzado.id]).toEqual(['dz_kig_michi', 'dz_capucha_michi', 'dz_pantufla_patita']);
    expect([c.accesorio.id, c.cara.id]).toEqual(['ninguno', 'ninguno']);
  });
});

describe('construcción 3D de las pijamas', () => {
  // jsdom no trae canvas 2D: un contexto falso que acepta cualquier llamada de dibujo
  const ctx2d = new Proxy({}, { get: (_t, k) => (k === 'measureText' ? () => ({ width: 1 }) : () => {}), set: () => true });
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx2d) as never);
  });

  it.each(PIJAMAS)('%s se construye con todas sus piezas, sin errores ni NaN, y anima orejas y cola', (id) => {
    const A = cargarAvatar();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const cfg = aplicarDisfraz(A, { ...normalizar(A, null, 'Lu'), cabello: { id: 'largo_ondulado', colores: {} } }, A.buscar('disfraz', id)!);
    const p = A.construir(cfg);
    expect(err).not.toHaveBeenCalled();
    let mallas = 0;
    p.raiz.traverse((o) => {
      const m = o as import('three').Mesh;
      if (!m.isMesh) return;
      mallas++;
      for (const v of m.geometry.attributes.position.array) if (Number.isNaN(v)) throw new Error('NaN en ' + id);
    });
    expect(mallas).toBeGreaterThan(60);
    expect(mallas).toBeLessThan(260); // no más pesado que los disfraces completos actuales
    expect(() => { p.animar(1.3, 0.016); p.animar(2.6, 0.016); }).not.toThrow();
    err.mockRestore();
  });

  it('con la capucha puesta el cabello largo no se construye (mismas mallas que sin cabello)', () => {
    const A = cargarAvatar();
    const base = normalizar(A, null, 'Lu');
    const mallas = (cabello: string) => {
      let n = 0;
      A.construir(aplicarDisfraz(A, { ...base, cabello: { id: cabello, colores: {} } }, A.buscar('disfraz', 'dz_kig_osito')!)).raiz.traverse((o) => { if ((o as import('three').Mesh).isMesh) n++; });
      return n;
    };
    expect(mallas('largo_ondulado')).toBe(mallas('calvo'));
  });
});

describe('Disfraces › Destacados ✨ en el editor', () => {
  beforeEach(() => {
    escenas.length = 0;
  });
  const montar = () => render(<EditorAvatar inicial={null} nombreCuenta="Lucía" guardar={vi.fn().mockResolvedValue(undefined)} cerrar={vi.fn()} />);

  it('al abrir Disfraces se ve primero «Destacados ✨» con sus 5 pijamas y la insignia «Nuevo»', () => {
    montar();
    fireEvent.click(screen.getByRole('tab', { name: /Disfraces/ }));
    const chips = screen.getAllByRole('button').filter((b) => b.className.includes('av-chip'));
    expect(chips[0]).toHaveTextContent(GRUPO_DESTACADOS);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');
    expect(chips[1]).toHaveTextContent('Todos');
    const items = document.querySelectorAll<HTMLButtonElement>('.av-item');
    expect([...items].map((b) => b.dataset.id)).toEqual(PIJAMAS);
    expect(document.querySelector('.av-rejilla--grande')).not.toBeNull();
    expect(document.querySelectorAll('.av-nuevo')).toHaveLength(5);
    for (const n of NOMBRES) expect(screen.getByRole('button', { name: new RegExp(n) })).toBeInTheDocument();
  });

  it('en «Todos» los destacados van primero y elegir uno reconstruye el avatar con la pijama', () => {
    montar();
    fireEvent.click(screen.getByRole('tab', { name: /Disfraces/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Todos' }));
    const ids = [...document.querySelectorAll<HTMLButtonElement>('.av-item')].map((b) => b.dataset.id);
    expect(ids.slice(0, 5)).toEqual(PIJAMAS);
    expect(ids.length).toBeGreaterThan(20);
    expect(document.querySelector('.av-rejilla--grande')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Osito Latte/ }));
    const c: ConfigAvatar = escenas[escenas.length - 1].reconstruir.mock.calls.at(-1)![0];
    expect(c.disfrazId).toBe('dz_kig_osito');
    expect(c.cabeza.id).toBe('dz_capucha_osito');
    expect(screen.getByRole('status')).toHaveTextContent(/Osito Latte/);
  });
});
