import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('three', async (orig) => {
  const T: any = await orig();
  class WebGLRenderer {
    shadowMap = {}; constructor(_o?: unknown) { /* sin WebGL */ }
    setPixelRatio() { /* */ } setClearColor() { /* */ } setSize() { /* */ } render() { /* */ } dispose() { /* */ }
  }
  return { ...T, WebGLRenderer };
});

import { crearMotor } from '../motor';
import { salonEjemplo } from '../../__tests__/datosEjemplo';

let cuadros: Array<(ms: number) => void> = [];
beforeAll(() => {
  const g = new Proxy({}, { get: (_t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop: () => undefined }) : () => undefined), set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => g) as any);
  (globalThis as any).ResizeObserver = class { observe() { /* */ } disconnect() { /* */ } };
});
afterEach(() => { vi.useRealTimers(); cuadros = []; });

describe('cámara del motor: Capri ↔ Ver todo', () => {
  it('Seguir a Capri bloquea la interacción y el ida y vuelta con Ver todo repite el mismo encuadre', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (f: (ms: number) => void) => { cuadros.push(f); return cuadros.length; });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const contenedor = document.createElement('div');
    Object.defineProperty(contenedor, 'clientWidth', { value: 1600 }); Object.defineProperty(contenedor, 'clientHeight', { value: 900 });
    const m = crearMotor({ piso: salonEjemplo().pisos[0], contenedor, lienzo: document.createElement('canvas'), capa: document.createElement('div'), reducir: false, ligero: true });
    m.actualizar(salonEjemplo());
    let ms = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => ms);
    const correr = (seg: number) => { for (let i = 0; i < seg * 20; i++) { ms += 50; vi.advanceTimersByTime(50); const f = cuadros.splice(0); f.forEach((c) => c(ms)); } };
    correr(3);
    expect(m.poseCamara().interactiva).toBe(false);

    const general: Array<ReturnType<Motor['poseCamara']>> = [];
    for (let v = 0; v < 3; v++) {
      m.camara('general'); correr(12);
      expect(m.poseCamara().interactiva).toBe(true);
      general.push(m.poseCamara());
      m.camara('capri'); correr(6);
      expect(m.poseCamara().interactiva).toBe(false);
    }
    // Ver todo llega siempre EXACTO a la misma pose, sin degradarse
    for (const p of general.slice(1)) {
      p.pos.forEach((c, i) => expect(c).toBeCloseTo(general[0].pos[i], 5));
      p.obj.forEach((c, i) => expect(c).toBeCloseTo(general[0].obj[i], 5));
    }
    m.destruir();
    vi.unstubAllGlobals();
  });
});

type Motor = ReturnType<typeof crearMotor>;
