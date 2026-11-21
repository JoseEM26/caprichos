import { describe, it, expect } from 'vitest';
import { areaDeEtiqueta, buscarRuta, claveArea, cocinerosDeArea, planoAEscena, puestosDeMesa } from '../planoAEscena';
import type { ElementoVivo } from '../../salonVivoApi';

let n = 0;
const el = (tipo: string, x: number, y: number, ancho: number, alto: number, extra: Partial<ElementoVivo> = {}): ElementoVivo => ({
  id: String(++n), tipo, nombre: null, x, y, ancho, alto, numero: null, asientos: null, activo: true, ...extra,
});

// Recorte del plano real del Piso 1 (20 × 12)
const piso = () => {
  n = 0;
  return {
    cuadriculaAncho: 20, cuadriculaAlto: 12,
    elementos: [
      el('MESA', 2, 9, 2, 2, { numero: 1, nombre: 'Mesa 1', asientos: 2 }),
      el('MESA', 8, 9, 2, 2, { numero: 3, nombre: 'Mesa 3', asientos: 4 }),
      el('MESA', 16, 4, 2, 2, { numero: 7, nombre: 'Mesa 7', asientos: 2 }),
      el('MESA', 11, 4, 2, 2, { numero: 8, nombre: 'Mesa 8', asientos: 4 }),
      el('BANO', 0, 6, 1, 5, { nombre: 'Baños' }),
      el('BARRA', 5, 3, 4, 1, { nombre: 'Exhibidor' }),
      el('CAJA', 2, 3, 3, 1, { nombre: 'Caja' }),
      el('COCINA', 13, 1, 6, 2, { nombre: 'SALADO' }),
      el('COCINA', 9, 1, 4, 1, { nombre: 'POSTRES' }),
      el('COCINA', 1, 1, 8, 1, { nombre: 'BEBIDAS' }),
      el('COCINA', 1, 2, 1, 1, { nombre: 'DESPACHO' }),
      el('ENTRADA', 19, 6, 1, 3),
      el('PARED', 0, 0, 20, 1),
      el('PARED', 0, 11, 20, 1),
      el('PARED', 19, 1, 1, 5),
      el('PARED', 9, 3, 10, 1),
      el('ESCALERA', 3, 5, 1, 2),
      el('XYZ', 6, 6, 1, 1, { nombre: 'Rareza' }),
      el('MESA', 12, 7, 2, 2, { numero: 9, activo: false }),
    ],
  };
};

describe('planoAEscena', () => {
  const p = planoAEscena(piso());
  const por = (id: string) => p.items.find((i) => i.etiqueta === id)!;

  it('centra el plano en el mundo y deja fuera lo inactivo', () => {
    expect(p.ancho).toBe(20);
    expect(p.items.filter((i) => i.clase === 'mesa')).toHaveLength(4);
    const m = por('Mesa 1');
    expect(m.cx).toBe(2 + 1 - 10);
    expect(m.cz).toBe(9 + 1 - 6);
  });

  it('reconoce cada tipo y manda lo desconocido a caja neutra', () => {
    const clases = p.items.map((i) => i.clase);
    expect(clases).toEqual(expect.arrayContaining(['mesa', 'bano', 'barra', 'caja', 'cocina', 'entrada', 'pared', 'escalera', 'otro']));
    expect(p.items.find((i) => i.etiqueta === 'Rareza')!.clase).toBe('otro');
  });

  it('casa las áreas de cocina por su etiqueta y cuenta cocineros', () => {
    expect(por('SALADO')).toMatchObject({ area: 'SALADOS', claveArea: claveArea('Salados') });
    expect(por('POSTRES').area).toBe('POSTRES');
    expect(por('BEBIDAS').area).toBe('BEBIDAS');
    expect(por('DESPACHO').area).toBe('DESPACHO');
    expect(areaDeEtiqueta('Horno').area).toBe('GENERAL');
    expect([por('SALADO'), por('POSTRES'), por('BEBIDAS'), por('DESPACHO')].map(cocinerosDeArea)).toEqual([2, 1, 2, 0]);
  });

  it('elige el rol de cada pared: ladrillo bajo la cocina, rosada al sur, fachada con ventanas', () => {
    const roles = p.items.filter((i) => i.clase === 'pared').map((i) => i.rol);
    expect(roles).toEqual(['norte', 'rosada', 'fachada', 'ladrillo']);
  });

  it('da estilo a las mesas: sofá pegado a la pared sur, sillones azules para 2 junto a la cocina, sillas si no', () => {
    expect(por('Mesa 1').estilo).toBe('sofa');
    expect(por('Mesa 3').estilo).toBe('sofa');
    expect(por('Mesa 7').estilo).toBe('sillones');
    expect(por('Mesa 8').estilo).toBe('sillas');
    expect(por('Mesa 7').arriba).toBe(true);
    expect(puestosDeMesa(por('Mesa 7'))).toHaveLength(2);
    expect(puestosDeMesa(por('Mesa 1'))).toHaveLength(2);
    expect(puestosDeMesa(por('Mesa 3'))).toHaveLength(4);
    expect(puestosDeMesa(por('Mesa 3'))[0].tipo).toBe('sofa');
  });

  it('ubica la entrada con la calle al este y un pasillo libre entre las filas de mesas', () => {
    expect(p.entrada).toMatchObject({ dirX: 1, dirZ: 0 });
    expect(p.pasilloY).toBe(7.5);
    expect(p.bloqueo[9][2]).toBe(true);
    expect(p.bloqueo[7][10]).toBe(false);
    expect(p.bloqueo[7][19]).toBe(false);
  });
});

describe('buscarRuta', () => {
  const p = planoAEscena(piso());
  it('rodea las mesas y termina en el destino', () => {
    const r = buscarRuta(p, [19.5, 7.5], [3.5, 10.2]); // de la puerta a un puesto de la mesa 1
    expect(r[r.length - 1]).toEqual([3.5, 10.2]);
    for (const [x, y] of r.slice(0, -1)) expect(p.bloqueo[Math.floor(y)][Math.floor(x)]).toBe(false);
  });
  it('si el destino está libre, va derecho', () => {
    expect(buscarRuta(p, [10.5, 7.5], [14.5, 7.5])).toEqual([[14.5, 7.5]]);
  });
});
