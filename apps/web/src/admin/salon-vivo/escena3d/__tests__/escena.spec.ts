import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { crearCtx } from '../base';
import { construirLocal } from '../local';
import { crearDirector } from '../director';
import { crearDecoracion, crearParticulas, TEMAS } from '../temas';
import { planoAEscena } from '../planoAEscena';
import type { Persona } from '../personas';
import { salonEjemplo, pedido } from '../../__tests__/datosEjemplo';

/** Humo de verdad con three y el plano de ejemplo; solo se simula el canvas 2D (jsdom no lo trae) y no se usa WebGL. */
beforeAll(() => {
  const g = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: () => undefined }) : () => undefined), set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => g) as any);
});
afterEach(() => vi.useRealTimers());

const sonido = { activar: () => true, murmullo: vi.fn(), campana: vi.fn(), caja: vi.fn(), cafetera: vi.fn(), moto: vi.fn(), cerrar: vi.fn() };

function armar(reducir = false) {
  const datos = salonEjemplo();
  const plano = planoAEscena(datos.pisos[0]);
  const escena = new THREE.Scene();
  const capa = document.createElement('div');
  const ctx = crearCtx(escena, capa, plano.ancho, plano.alto, reducir, false);
  const gente = new Set<Persona>();
  const local = construirLocal(ctx, plano, gente);
  const cambios = vi.fn();
  const director = crearDirector(ctx, plano, local, gente, sonido, cambios);
  return { datos, plano, escena, capa, ctx, gente, local, director, cambios };
}
const correr = (d: ReturnType<typeof armar>['director'], seg: number) => { for (let t = 0; t < seg; t += 0.05) d.paso(t, 0.05); };

describe('escena 3D desde el plano real', () => {
  it('construye mesas, cocina por áreas, caja y entrada del plano', () => {
    const { local, plano, capa } = armar();
    expect(local.mesas.map((m) => m.nombre)).toEqual(['Mesa 1', 'Mesa 2']);
    expect([...local.zonas.keys()].sort()).toEqual(['BEBID', 'POSTR']);
    expect(local.cajero).not.toBeNull();
    expect(local.despachoPunto).not.toBeNull();
    expect(local.bandejas).toHaveLength(3);
    expect(plano.entrada).not.toBeNull();
    expect(capa.querySelectorAll('.sv-etq').length).toBeGreaterThan(4);
  });

  it('decora con cada temática sin romper nada', () => {
    const { ctx, local, escena } = armar();
    const luces = { hemi: new THREE.HemisphereLight(), calida: new THREE.PointLight() };
    const particulas = crearParticulas(ctx, 10);
    const deco = crearDecoracion(ctx, luces, local.mesas.map((m) => m.centro), local.spots, particulas);
    for (const [clave, tema] of Object.entries(TEMAS)) { deco.decorar(tema, clave); deco.animar(1.2); }
    expect(escena.children.length).toBeGreaterThan(10);
  });

  it('pone a los clientes de las mesas ocupadas y a Capri a llevar lo que sale al despacho', () => {
    const e = armar();
    e.director.aplicar(e.datos, true);
    expect(e.local.mesas[0].anillo.material).toBeTruthy();
    expect(e.local.mesas[0].etq.el.textContent).toContain('Esperando pedido');
    expect(e.local.mesas[0].etq.el.textContent).toContain('2/2 pers.');
    expect(e.local.mesas[1].etq.el.textContent).toContain('Libre');
    // en despacho hay un pedido de la Mesa 2 (libre en los datos): no se lleva a nadie
    correr(e.director, 3);
    expect(e.local.zonas.get('BEBID')!.carga).toBe(2);
    expect(e.local.bandejas.filter((b) => b.visible)).toHaveLength(1);
  });

  it('un pedido que pasa a listo se lleva a su mesa y al llegar quedan los platos', () => {
    vi.useFakeTimers();
    const e = armar();
    const antes = e.datos;
    e.director.aplicar(antes, true);
    const ahora = salonEjemplo();
    ahora.cocina = ahora.cocina.filter((p) => p.codigo !== 'CP-W901');
    ahora.despacho = [pedido('CP-W901', { estado: 'LISTO', mesas: ['Mesa 1'], mesaIds: ['1'] })];
    e.director.aplicar(ahora, false);
    expect(sonido.campana).toHaveBeenCalled();
    for (let i = 0; i < 400; i++) { e.director.paso(i * 0.05, 0.05); vi.advanceTimersByTime(50); }
    expect(e.local.mesas[0].comida.children.length).toBeGreaterThan(0);
    expect(e.director.resumenMeseros().some((m) => m.esCapri)).toBe(true);
  });

  it('los clientes llegan cuando una mesa se ocupa y se van cuando se libera', () => {
    vi.useFakeTimers();
    const e = armar();
    e.director.aplicar(e.datos, true);
    const personasAntes = e.gente.size;
    const ocupa = salonEjemplo();
    ocupa.mesas[1] = { ...ocupa.mesas[1], estado: 'ESPERANDO', pedido: { codigo: 'CP-W950', personas: 3, minutos: 0, areasPendientes: [] } };
    e.director.aplicar(ocupa, false);
    expect(e.gente.size).toBe(personasAntes + 3);
    for (let i = 0; i < 300; i++) { e.director.paso(i * 0.05, 0.05); vi.advanceTimersByTime(50); }
    const libera = salonEjemplo();
    libera.mesas[1] = { ...libera.mesas[1], estado: 'LIBRE' };
    e.director.aplicar(libera, false);
    for (let i = 0; i < 500; i++) { e.director.paso(20 + i * 0.05, 0.05); vi.advanceTimersByTime(50); }
    expect(e.gente.size).toBe(personasAntes);
  });

  it('sin movimiento (reducir) las personas aparecen en su lugar sin caminar', () => {
    vi.useFakeTimers();
    const e = armar(true);
    e.director.aplicar(e.datos, true);
    const ocupa = salonEjemplo();
    ocupa.mesas[1] = { ...ocupa.mesas[1], estado: 'COMIENDO', pedido: { codigo: 'CP-W951', personas: 2, minutos: 3, areasPendientes: [] } };
    e.director.aplicar(ocupa, false);
    vi.advanceTimersByTime(200);
    const m = e.local.mesas[1];
    expect(m.comida.children.length).toBeGreaterThan(0);
    expect(e.gente.size).toBeGreaterThanOrEqual(4);
  });

  it('destruir detiene los temporizadores', () => {
    const e = armar();
    e.director.aplicar(e.datos, true);
    e.director.destruir();
    expect(() => correr(e.director, 1)).not.toThrow();
  });
});
