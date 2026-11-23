import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { crearCtx } from '../base';
import { construirLocal } from '../local';
import { crearDirector } from '../director';
import { planoAEscena } from '../planoAEscena';
import type { Persona } from '../personas';
import { salonEjemplo, pedido } from '../../__tests__/datosEjemplo';

/** Las piezas reales del avatar no se bajan en la prueba: se simula el motor con partes mínimas. */
const construir = vi.fn();
vi.mock('../avatarReal', async (original) => ({
  ...(await original<typeof import('../avatarReal')>()),
  cargarMotorAvatar: vi.fn(async () => ({ A: { construir, REG: {} }, normalizar: (_a: unknown, c: unknown) => c, conPelo: (c: unknown) => c })),
}));

beforeAll(() => {
  const g = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: () => undefined }) : () => undefined), set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => g) as any);
  construir.mockImplementation(() => {
    const gr = () => new THREE.Group();
    return { raiz: gr(), cuerpo: gr(), cabeza: gr(), brazos: [gr(), gr()], codos: [gr(), gr()], piernas: [gr(), gr()], rodillas: [gr(), gr()], ojos: [gr(), gr()], boca: gr(), animar: () => undefined };
  });
});

const sonido = { activar: () => true, murmullo: vi.fn(), campana: vi.fn(), caja: vi.fn(), cafetera: vi.fn(), moto: vi.fn(), cerrar: vi.fn() };
const AV = { url: '/archivos/a.png', config: { genero: 'mujer' } };

function armar(ligero = false) {
  const datos = salonEjemplo();
  datos.caja = []; // sin clientes para llevar: aquí se cuentan solo los de las mesas
  const plano = planoAEscena(datos.pisos[0]);
  const escena = new THREE.Scene();
  const ctx = crearCtx(escena, document.createElement('div'), plano.ancho, plano.alto, false, ligero);
  const gente = new Set<Persona>();
  const local = construirLocal(ctx, plano, gente);
  const director = crearDirector(ctx, plano, local, gente, sonido, vi.fn());
  return { datos, gente, director };
}
const avatares = (g: Set<Persona>) => [...g].filter((p) => p.avatarReal);

describe('clientes con avatar real en el salón', () => {
  it('el titular usa su avatar y el acompañante es un hombre o mujer clásico', async () => {
    const e = armar();
    e.datos.mesas[0].pedido!.avatar = AV;
    e.director.aplicar(e.datos, true);
    await vi.waitFor(() => expect(avatares(e.gente)).toHaveLength(1));
    expect(construir.mock.calls.some((c) => c[0] === AV.config)).toBe(true);
    expect(e.gente.size).toBeGreaterThan(2);
  });

  it('los acompañantes salen de las bebidas del pedido (3 bebidas = cliente + 2) con tope en las sillas', async () => {
    const e = armar();
    e.datos.mesas[0].estado = 'LIBRE'; e.datos.mesas[0].pedido = null;
    e.datos.mesas[1].estado = 'ESPERANDO';
    e.datos.mesas[1].pedido = { id: '77', codigo: 'CP-W77', personas: null, bebidas: 3, minutos: 2, areasPendientes: [] };
    const antes = e.gente.size;
    e.director.aplicar(e.datos, true);
    await vi.waitFor(() => expect(e.gente.size - antes).toBe(3));
    expect(avatares(e.gente)).toHaveLength(0);
    const f = armar();
    f.datos.mesas[0].estado = 'LIBRE'; f.datos.mesas[0].pedido = null;
    f.datos.mesas[1].estado = 'ESPERANDO';
    f.datos.mesas[1].pedido = { id: '78', codigo: 'CP-W78', personas: null, bebidas: 9, minutos: 2, areasPendientes: [] };
    f.director.aplicar(f.datos, true);
    await vi.waitFor(() => expect(f.gente.size - antes).toBe(4));
    expect(avatares(f.gente)).toHaveLength(0);
  });

  it('un cliente sin avatar sale como hombre o mujer clásico, igual en cada refresco', () => {
    const colores = () => {
      const e = armar();
      e.datos.mesas[0].pedido = { id: '501', codigo: 'CP-W501', personas: null, bebidas: 1, minutos: 2, areasPendientes: [] };
      e.director.aplicar(e.datos, true);
      expect(avatares(e.gente)).toHaveLength(0);
      return e.gente.size;
    };
    expect(colores()).toBe(colores());
  });

  it('si el cliente cambia su avatar en la carta, el muñeco se reconstruye sin recargar', async () => {
    const e = armar();
    e.datos.mesas[0].pedido!.avatar = AV;
    e.director.aplicar(e.datos, true);
    await vi.waitFor(() => expect(avatares(e.gente)).toHaveLength(1));
    const antes = e.gente.size;
    const primero = avatares(e.gente)[0];
    construir.mockClear();
    const nuevo = { ...e.datos, mesas: e.datos.mesas.map((m, i) => (i === 0 ? { ...m, pedido: { ...m.pedido!, avatar: { url: '/archivos/b.png', config: { genero: 'hombre' } } } } : m)) };
    e.director.aplicar(nuevo, false);
    await vi.waitFor(() => expect(construir).toHaveBeenCalledTimes(1));
    expect(construir.mock.calls[0][0]).toEqual({ genero: 'hombre' });
    expect(avatares(e.gente)).toHaveLength(1);
    expect(avatares(e.gente)[0]).not.toBe(primero);
    expect(e.gente.size).toBe(antes);
    // sin cambios no se reconstruye
    construir.mockClear();
    e.director.aplicar({ ...nuevo }, false);
    expect(construir).not.toHaveBeenCalled();
  });

  it('un cliente para llevar con avatar en caja también lo usa', async () => {
    const e = armar();
    e.datos.caja = [pedido('CP-W905', { modalidad: 'LLEVAR', mesas: [], mesaIds: [], avatar: AV })];
    e.director.aplicar(e.datos, true);
    await vi.waitFor(() => expect(avatares(e.gente).some((p) => p.rol === 'cliente')).toBe(true));
    expect(construir.mock.calls.some((c) => c[0] === AV.config)).toBe(true);
  });

  it('en modo ligero no hay avatares reales aunque los traiga', async () => {
    const b = armar(true);
    b.datos.mesas[0].pedido!.avatar = AV;
    b.director.aplicar(b.datos, true);
    expect(avatares(b.gente)).toHaveLength(0);
    expect(b.gente.size).toBeGreaterThan(2);
  });

  it('con una configuración rota cae a la figura genérica', async () => {
    construir.mockImplementation(() => { throw new Error('pieza rota'); });
    const e = armar();
    e.datos.mesas[0].pedido!.avatar = AV;
    const antes = e.gente.size;
    e.director.aplicar(e.datos, true);
    await vi.waitFor(() => expect(e.gente.size).toBeGreaterThan(antes));
    expect(avatares(e.gente)).toHaveLength(0);
  });
});
