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
  cargarMotorAvatar: vi.fn(async () => ({ A: { construir }, normalizar: (_a: unknown, c: unknown) => c })),
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
  it('solo el titular de la mesa usa su avatar; el acompañante sigue genérico', async () => {
    const e = armar();
    e.datos.mesas[0].pedido!.avatar = AV;
    e.director.aplicar(e.datos, true);
    await vi.waitFor(() => expect(avatares(e.gente)).toHaveLength(1));
    expect(e.gente.size).toBeGreaterThan(2);
  });

  it('un cliente para llevar con avatar en caja también lo usa', async () => {
    const e = armar();
    e.datos.caja = [pedido('CP-W905', { modalidad: 'LLEVAR', mesas: [], mesaIds: [], avatar: AV })];
    e.director.aplicar(e.datos, true);
    await vi.waitFor(() => expect(avatares(e.gente)).toHaveLength(1));
  });

  it('sin avatar no se carga nada; en modo ligero tampoco aunque lo traiga', async () => {
    const a = armar();
    a.director.aplicar(a.datos, true);
    expect(avatares(a.gente)).toHaveLength(0);
    const b = armar(true);
    b.datos.mesas[0].pedido!.avatar = AV;
    b.director.aplicar(b.datos, true);
    expect(avatares(b.gente)).toHaveLength(0);
    expect(b.gente.size).toBeGreaterThan(2);
  });

  it('con una configuración rota cae a la figura genérica', async () => {
    construir.mockImplementationOnce(() => { throw new Error('pieza rota'); });
    const e = armar();
    e.datos.mesas[0].pedido!.avatar = AV;
    const antes = e.gente.size;
    e.director.aplicar(e.datos, true);
    await vi.waitFor(() => expect(e.gente.size).toBeGreaterThan(antes));
    expect(avatares(e.gente)).toHaveLength(0);
  });
});
