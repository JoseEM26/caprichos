import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { ESPERA_PANORAMA, MIN_ESTADO, puedeInteractuar, siguienteEstado, type EstadoDirector, type Foco } from '../camaraDirector';
import { generoClasico, opcionesClasicas } from '../acompanantes';
import { crearCtx } from '../base';
import { construirLocal } from '../local';
import { crearDirector } from '../director';
import { planoAEscena } from '../planoAEscena';
import type { Persona } from '../personas';
import { salonEjemplo, pedido } from '../../__tests__/datosEjemplo';

const foco = (o: Partial<Foco> = {}): Foco => ({ caminando: false, ocupada: false, cerca: null, rumbo: null, quietoS: 0, ...o });

describe('Seguir a Capri', () => {
  it('con «Seguir a Capri» el usuario no puede mover la cámara; en las otras vistas sí', () => {
    expect(puedeInteractuar('capri')).toBe(false);
    for (const v of ['general', 'cocina', 'salon']) expect(puedeInteractuar(v)).toBe(true);
  });

  it('ciclo seguir → panorama → Capri se mueve → vuelve a seguir, todas las veces', () => {
    let d: EstadoDirector = { estado: 'SIGUIENDO', desde: 0 };
    let t = 0;
    for (let vuelta = 0; vuelta < 4; vuelta++) {
      t += MIN_ESTADO.SIGUIENDO + 1;
      d = siguienteEstado(d, foco({ quietoS: ESPERA_PANORAMA }), t);
      expect(d.estado).toBe('PANORAMA');
      t += MIN_ESTADO.PANORAMA + 0.1;
      d = siguienteEstado(d, foco({ caminando: true, ocupada: true }), t);
      expect(d.estado).toBe('SIGUIENDO');
    }
  });
});

describe('clientes sin avatar: hombre o mujer clásico', () => {
  it('la elección es estable por semilla y reparte ambos', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `pedido-${i}:0`);
    const g = ids.map(generoClasico);
    expect(ids.map(generoClasico)).toEqual(g);
    expect(new Set(g)).toEqual(new Set(['hombre', 'mujer']));
    expect(opcionesClasicas('x:1')).toEqual(opcionesClasicas('x:1'));
    expect(opcionesClasicas(ids[g.indexOf('mujer')]).estilo).toBe('largo');
    expect(opcionesClasicas(ids[g.indexOf('hombre')]).estilo).toBe('corto');
  });
});

beforeAll(() => {
  const g = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: () => undefined }) : () => undefined), set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => g) as any);
});
afterEach(() => vi.useRealTimers());

const sonido = { activar: () => true, murmullo: vi.fn(), campana: vi.fn(), caja: vi.fn(), cafetera: vi.fn(), moto: vi.fn(), cerrar: vi.fn() };
function armar() {
  const datos = salonEjemplo();
  const plano = planoAEscena(datos.pisos[0]);
  const escena = new THREE.Scene();
  const ctx = crearCtx(escena, document.createElement('div'), plano.ancho, plano.alto, false, true);
  const gente = new Set<Persona>();
  const local = construirLocal(ctx, plano, gente);
  const director = crearDirector(ctx, plano, local, gente, sonido, vi.fn());
  return { datos, gente, director };
}

describe('director: solo Capri y repartidor con su moto', () => {
  it('no hay mozos aparte de Capri', () => {
    const e = armar();
    expect(e.director.resumenMeseros().map((m) => m.nombre)).toEqual(['Capri']);
    expect([...e.gente].some((p) => p.rol === 'mozo')).toBe(false);
  });

  it('al salir con el pedido, la persona va montada en la moto (mismo grupo) en cada paso, aunque los datos pidan salir a mitad de la entrega', () => {
    vi.useFakeTimers();
    const e = armar();
    e.director.aplicar(e.datos, true);
    const rep = [...e.gente].find((p) => p.rol === 'repartidor')!;
    const d = salonEjemplo();
    d.despacho = [pedido('CP-D9', { id: 'd9', modalidad: 'DELIVERY', estado: 'LISTO', mesas: [], mesaIds: [], areas: [{ nombre: 'Bebidas', estado: 'LISTA' as const }] })];
    e.director.aplicar(d, false);
    let montado = 0;
    for (let i = 0; i < 1800; i++) {
      e.director.paso(i * 0.05, 0.05); vi.advanceTimersByTime(50);
      if (i % 40 === 0) e.director.aplicar(d, false); // refrescos de datos con el delivery en reparto
      if (i === 100) { const r = salonEjemplo(); r.despacho = d.despacho; e.director.aplicar(r, false); }
      if (rep.raiz.parent === e.director.moto) {
        montado++;
        expect(rep.enMoto).toBe(true);
        // misma pieza: su posición local en la moto no cambia mientras la moto anda
        expect(rep.raiz.position.x).toBe(0); expect(rep.raiz.position.z).toBeCloseTo(-0.1);
        expect(e.director.estaCaminando(rep.raiz)).toBe(false);
      }
    }
    expect(montado).toBeGreaterThan(0);
  });
});
