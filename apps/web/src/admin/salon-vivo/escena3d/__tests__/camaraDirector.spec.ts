import { describe, expect, it } from 'vitest';
import {
  ESPERA_PANORAMA, MIN_ESTADO, distanciaParaEncuadrar, factorSuave, poseCocina, poseDeEstado, poseMesa, poseSiguiendo, siguienteEstado, suavizarAngulo,
  type EstadoDirector, type Foco, type Mundo,
} from '../camaraDirector';

const foco = (o: Partial<Foco> = {}): Foco => ({ caminando: false, ocupada: false, cerca: null, rumbo: null, quietoS: 0, ...o });
const ini = (estado: EstadoDirector['estado'] = 'PANORAMA', desde = 0): EstadoDirector => ({ estado, desde });

// Local de 20 x 12 con una pared al este (x >= 8) y una columna en (0, 0)
const mundo: Mundo = {
  ancho: 20, alto: 12, fov: 40, aspecto: 16 / 9,
  libre: (x, z) => x < 8 && !(Math.abs(x) < 0.5 && Math.abs(z) < 0.5),
  general: { pos: [0, 17, 16], obj: [0, 0, 1] },
};

describe('director de cámara: estados', () => {
  it('Capri caminando: SIGUIENDO', () => {
    expect(siguienteEstado(ini('PANORAMA', 0), foco({ caminando: true, ocupada: true }), 10).estado).toBe('SIGUIENDO');
  });

  it('camino a la cocina muestra la cocina; en la mesa encuadra la mesa', () => {
    expect(siguienteEstado(ini('SIGUIENDO', 0), foco({ caminando: true, ocupada: true, rumbo: 'cocina' }), 10).estado).toBe('EN_COCINA');
    expect(siguienteEstado(ini('SIGUIENDO', 0), foco({ ocupada: true, cerca: 'mesa' }), 10).estado).toBe('EN_MESA');
    expect(siguienteEstado(ini('SIGUIENDO', 0), foco({ ocupada: true, cerca: 'cocina' }), 10).estado).toBe('EN_COCINA');
  });

  it('sin hacer nada vuelve a la vista amplia, pero solo tras la espera', () => {
    expect(siguienteEstado(ini('SIGUIENDO', 0), foco({ quietoS: ESPERA_PANORAMA - 0.5 }), 10).estado).toBe('SIGUIENDO');
    expect(siguienteEstado(ini('SIGUIENDO', 0), foco({ quietoS: ESPERA_PANORAMA }), 10).estado).toBe('PANORAMA');
  });

  it('al moverse de nuevo retoma el seguimiento', () => {
    expect(siguienteEstado(ini('PANORAMA', 0), foco({ caminando: true, ocupada: true }), 10).estado).toBe('SIGUIENDO');
  });

  it('respeta el tiempo mínimo de cada estado (no salta)', () => {
    for (const e of ['SIGUIENDO', 'EN_MESA', 'EN_COCINA', 'PANORAMA'] as const) {
      const quieto = foco({ quietoS: 99 });
      const mover = foco({ caminando: true, ocupada: true });
      const f = e === 'PANORAMA' ? mover : quieto;
      const destino = e === 'PANORAMA' ? 'SIGUIENDO' : 'PANORAMA';
      expect(siguienteEstado(ini(e, 5), f, 5 + MIN_ESTADO[e] - 0.1).estado).toBe(e);
      expect(siguienteEstado(ini(e, 5), f, 5 + MIN_ESTADO[e]).estado).toBe(destino);
    }
  });

  it('parada hace poco y sin nada cerca: no cambia de estado', () => {
    expect(siguienteEstado(ini('SIGUIENDO', 0), foco({ quietoS: 1 }), 10).estado).toBe('SIGUIENDO');
    expect(siguienteEstado(ini('EN_MESA', 0), foco({ quietoS: 1 }), 10).estado).toBe('EN_MESA');
  });

  it('la secuencia típica de un servicio no parpadea: ninguna fase dura menos que su mínimo', () => {
    let d = ini('PANORAMA', -10);
    const historial: Array<[number, string]> = [];
    const guion = (t: number): Foco =>
      t < 2 ? foco({ quietoS: 9 })
        : t < 8 ? foco({ caminando: true, ocupada: true, rumbo: 'cocina' })
          : t < 12 ? foco({ ocupada: true, cerca: 'cocina' })
            : t < 18 ? foco({ caminando: true, ocupada: true })
              : t < 24 ? foco({ ocupada: true, cerca: 'mesa' })
                : t < 29 ? foco({ caminando: true, ocupada: true })
                  : foco({ quietoS: t - 29 });
    for (let t = 0; t < 40; t += 0.1) {
      const n = siguienteEstado(d, guion(t), t);
      if (n !== d) historial.push([t, n.estado]);
      d = n;
    }
    expect(historial.map((h) => h[1])).toEqual(['EN_COCINA', 'SIGUIENDO', 'EN_MESA', 'SIGUIENDO', 'PANORAMA']);
    for (let i = 1; i < historial.length; i++) {
      expect(historial[i][0] - historial[i - 1][0]).toBeGreaterThanOrEqual(MIN_ESTADO[historial[i - 1][1] as keyof typeof MIN_ESTADO] - 0.001);
    }
  });
});

describe('director de cámara: poses', () => {
  it('SIGUIENDO: delante de Capri, un poco arriba y mirándola', () => {
    const p = poseSiguiendo({ x: -3, z: 2 }, Math.PI / 2, mundo); // camina hacia +x
    expect(p.pos[0]).toBeGreaterThan(-3 + 1);
    expect(p.pos[1]).toBeGreaterThan(1.4);
    expect(p.obj).toEqual([-3, 1, 2]);
  });

  it('no atraviesa paredes: si delante hay pared se acerca o pasa detrás', () => {
    const p = poseSiguiendo({ x: 7.2, z: 2 }, Math.PI / 2, mundo); // la pared está a 0.8 hacia delante
    expect(mundo.libre(p.pos[0], p.pos[2])).toBe(true);
    expect(Math.abs(p.pos[2])).toBeLessThanOrEqual(mundo.alto / 2 - 0.4);
    const q = poseSiguiendo({ x: 9.3, z: 0 }, 0, { ...mundo, libre: () => false });
    expect(q.pos[1]).toBeGreaterThan(3); // sin sitio libre: desde arriba
  });

  it('no atraviesa muebles: nunca cae sobre la columna', () => {
    const p = poseSiguiendo({ x: -2, z: 0 }, Math.PI / 2, { ...mundo, libre: (x, z) => !(Math.abs(x) < 1.5 && Math.abs(z) < 1.5) });
    expect(Math.abs(p.pos[0]) >= 1.5 || Math.abs(p.pos[2]) >= 1.5).toBe(true);
  });

  it('EN_MESA: toda la mesa en cuadro, de costado y a una distancia que depende de la pantalla', () => {
    const mesa = { x: -4, z: 1 }, clientes = [{ x: -4.9, z: 1 }, { x: -3.1, z: 1 }, { x: -4, z: 0.1 }], capri = { x: -4, z: 2.75 };
    const p = poseMesa(capri, mesa, clientes, mundo);
    expect(mundo.libre(p.pos[0], p.pos[2])).toBe(true);
    const ancha = poseMesa(capri, mesa, clientes, { ...mundo, aspecto: 3 });
    const angosta = poseMesa(capri, mesa, clientes, { ...mundo, aspecto: 0.6 });
    const d = (q: { pos: number[]; obj: number[] }) => Math.hypot(q.pos[0] - q.obj[0], q.pos[2] - q.obj[2]);
    expect(d(angosta)).toBeGreaterThan(d(ancha) - 0.001);
    // el centro del encuadre queda entre Capri y los clientes
    expect(p.obj[2]).toBeGreaterThan(0.5); expect(p.obj[2]).toBeLessThan(2.75);
  });

  it('EN_MESA junto a la pared: la cámara se pone en el lado libre', () => {
    const p = poseMesa({ x: 6.5, z: 2.5 }, { x: 6.5, z: 1 }, [{ x: 6.5, z: 0.2 }], mundo);
    expect(mundo.libre(p.pos[0], p.pos[2])).toBe(true);
  });

  it('EN_COCINA: encuadra a Capri y la cocina desde el lado del salón', () => {
    const p = poseCocina({ x: -3, z: -2 }, { x: -3, z: -5 }, mundo);
    expect(p.pos[2]).toBeGreaterThan(-2);
    expect(p.obj[2]).toBeCloseTo(-3.5);
  });

  it('PANORAMA: la vista amplia del local; poseDeEstado elige según el estado', () => {
    const base = { capri: { x: 0, z: 3 }, rumbo: 0, cocina: { x: -3, z: -5 } };
    expect(poseDeEstado({ ...base, estado: 'PANORAMA' }, mundo)).toBe(mundo.general);
    expect(poseDeEstado({ ...base, estado: 'EN_MESA', mesa: null }, mundo).obj[1]).toBe(1); // sin mesa conocida: sigue a Capri
    expect(poseDeEstado({ ...base, estado: 'EN_COCINA' }, mundo).obj[2]).toBeCloseTo(-1);
  });
});

describe('director de cámara: suavizado', () => {
  it('el factor crece con el tiempo y nunca pasa de 1', () => {
    expect(factorSuave(0)).toBe(0);
    expect(factorSuave(1 / 60)).toBeLessThan(factorSuave(1));
    expect(factorSuave(100)).toBeLessThanOrEqual(1);
  });
  it('tras ~1.5 s ya llegó casi del todo (transición de 1 a 2 s)', () => {
    let x = 0;
    for (let i = 0; i < 90; i++) x += (10 - x) * factorSuave(1 / 60);
    expect(x).toBeGreaterThan(9.6);
  });
  it('el ángulo gira por el camino corto', () => {
    expect(suavizarAngulo(3, -3, 1)).toBeCloseTo(-3 + 2 * Math.PI);
  });
  it('distancia para encuadrar: más lejos en pantalla angosta', () => {
    expect(distanciaParaEncuadrar(3, 40, 0.5)).toBeGreaterThan(distanciaParaEncuadrar(3, 40, 2));
  });
});
