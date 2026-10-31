import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cuentaParaSonar, hayQueSonar, reiniciarSonidoParaPruebas, CADA_SONIDO_MS, useSonidoAvisos } from '../sonidoAviso';
import type { NotificacionPendiente } from '../notificacionesTipos';

const aviso = (over: Partial<NotificacionPendiente>): NotificacionPendiente => ({
  id: '1',
  clave: 'n:1',
  titulo: 'Aviso',
  detalle: '',
  prioridad: 'MEDIA',
  desde: new Date().toISOString(),
  modulo: 'caja',
  accion: 'Ir a Caja',
  leida: false,
  leidaEn: null,
  ...over,
});

function instalarAudioFalso() {
  const osciladores: unknown[] = [];
  class FakeAudioContext {
    state = 'running' as const;
    currentTime = 0;
    destination = {};
    resume = vi.fn(async () => {});
    createOscillator = vi.fn(() => {
      const osc = { type: 'sine', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      osciladores.push(osc);
      return osc;
    });
    createGain = vi.fn(() => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() }));
  }
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudioContext;
  return { osciladores };
}

describe('alcance del sonido de avisos', () => {
  const ahora = new Date('2026-10-31T15:00:00Z');

  it('SOLO_URGENTES no suena con avisos de prioridad media', () => {
    expect(hayQueSonar([aviso({ prioridad: 'MEDIA' })], 'SOLO_URGENTES', ahora)).toBe(false);
    expect(hayQueSonar([aviso({ prioridad: 'ALTA' })], 'SOLO_URGENTES', ahora)).toBe(true);
  });

  it('TODOS_NO_LEIDOS suena por lo no leído salvo prioridad baja', () => {
    expect(hayQueSonar([aviso({ prioridad: 'BAJA' })], 'TODOS_NO_LEIDOS', ahora)).toBe(false);
    expect(hayQueSonar([aviso({ prioridad: 'MEDIA' })], 'TODOS_NO_LEIDOS', ahora)).toBe(true);
    expect(hayQueSonar([aviso({ prioridad: 'MEDIA', leida: true })], 'TODOS_NO_LEIDOS', ahora)).toBe(false);
  });

  it('SOLO_HOY suena solo por lo creado hoy (hora de Lima), y un aviso sin fecha cuenta como hoy', () => {
    const ayer = new Date('2026-10-30T15:00:00Z').toISOString();
    expect(cuentaParaSonar(aviso({ desde: ayer }), 'SOLO_HOY', ahora)).toBe(false);
    expect(cuentaParaSonar(aviso({ desde: ahora.toISOString() }), 'SOLO_HOY', ahora)).toBe(true);
    expect(cuentaParaSonar(aviso({ desde: null }), 'SOLO_HOY', ahora)).toBe(true);
    expect(cuentaParaSonar(aviso({ prioridad: 'BAJA', desde: ahora.toISOString() }), 'SOLO_HOY', ahora)).toBe(false);
  });
});

describe('sonido configurado: intervalo y apagado', () => {
  beforeEach(() => {
    reiniciarSonidoParaPruebas();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete (window as unknown as { AudioContext?: unknown }).AudioContext;
  });

  function Prueba({ activo, intervaloMs }: { activo: boolean; intervaloMs?: number }) {
    useSonidoAvisos(activo, intervaloMs);
    return null;
  }

  it('con el intervalo configurado (30 s) suena al momento y vuelve a sonar a los 30 s, no a los 15', async () => {
    const { osciladores } = instalarAudioFalso();
    render(<Prueba activo intervaloMs={30000} />);
    expect(osciladores.length).toBe(2);
    await act(async () => {
      vi.advanceTimersByTime(CADA_SONIDO_MS);
    });
    expect(osciladores.length).toBe(2);
    await act(async () => {
      vi.advanceTimersByTime(CADA_SONIDO_MS);
    });
    expect(osciladores.length).toBe(4);
  });

  it('con el sonido apagado no suena nunca, aunque haya avisos sin leer', async () => {
    const { osciladores } = instalarAudioFalso();
    const sonidoActivo = false;
    const lista = [aviso({ prioridad: 'ALTA' })];
    render(<Prueba activo={sonidoActivo && hayQueSonar(lista, 'TODOS_NO_LEIDOS')} />);
    await act(async () => {
      vi.advanceTimersByTime(CADA_SONIDO_MS * 3);
    });
    expect(osciladores.length).toBe(0);
  });
});
