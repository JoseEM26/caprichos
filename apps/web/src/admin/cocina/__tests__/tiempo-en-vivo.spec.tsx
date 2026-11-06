import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { TiempoEspera, NumeroDia } from '../TiempoEspera';
import { colorPorMinutos, formatearTranscurrido, registrarHoraServidor } from '../tiempoEnVivo';

const AHORA = new Date('2026-11-06T17:00:00.000Z').getTime(); // 12:00 en Lima

describe('tiempo en vivo de cocina', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    registrarHoraServidor(new Date(AHORA).toISOString());
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('colorPorMinutos respeta los umbrales (por defecto 35 y 50, o los del servidor)', () => {
    expect(colorPorMinutos(34)).toBe('VERDE');
    expect(colorPorMinutos(35)).toBe('NARANJA');
    expect(colorPorMinutos(49)).toBe('NARANJA');
    expect(colorPorMinutos(50)).toBe('ROJO');
    expect(colorPorMinutos(12, { naranjaMin: 10, rojoMin: 20 })).toBe('NARANJA');
    expect(colorPorMinutos(20, { naranjaMin: 10, rojoMin: 20 })).toBe('ROJO');
  });

  it('formatea mm:ss y h:mm:ss', () => {
    expect(formatearTranscurrido(0)).toBe('0:00');
    expect(formatearTranscurrido(65)).toBe('1:05');
    expect(formatearTranscurrido(3725)).toBe('1:02:05');
  });

  it('cuenta en vivo cada segundo sin recargar y cambia a Atención y Urgente con el umbral', () => {
    const desde = new Date(AHORA - 34 * 60000 - 58000).toISOString(); // 34:58
    render(<TiempoEspera desde={desde} />);
    const chip = screen.getByTestId('indicador-tiempo');
    expect(chip).toHaveTextContent('34:58 · En tiempo');
    expect(chip.getAttribute('data-color')).toBe('VERDE');

    act(() => {
      vi.advanceTimersByTime(2000); // 35:00
    });
    expect(chip).toHaveTextContent('35:00 · Atención');
    expect(chip.getAttribute('data-color')).toBe('NARANJA');

    act(() => {
      vi.advanceTimersByTime(15 * 60000); // 50:00
    });
    expect(chip).toHaveTextContent('50:00 · Urgente');
    expect(chip.getAttribute('data-color')).toBe('ROJO');
  });

  it('usa la hora del servidor aunque el reloj del navegador vaya atrasado', () => {
    // El servidor va 10 min por delante del navegador
    registrarHoraServidor(new Date(AHORA + 10 * 60000).toISOString());
    render(<TiempoEspera desde={new Date(AHORA).toISOString()} />);
    expect(screen.getByTestId('indicador-tiempo')).toHaveTextContent('10:00 · En tiempo');
  });

  it('sin hora de llegada usa los minutos que trajo el servidor', () => {
    render(<TiempoEspera desde={null} minutosRespaldo={40} />);
    expect(screen.getByTestId('indicador-tiempo').getAttribute('data-color')).toBe('NARANJA');
  });

  it('comparte un solo temporizador entre todas las tarjetas', () => {
    const spy = vi.spyOn(globalThis, 'setInterval');
    const desde = new Date(AHORA - 5 * 60000).toISOString();
    render(
      <>
        <TiempoEspera desde={desde} />
        <TiempoEspera desde={desde} />
        <TiempoEspera desde={desde} />
      </>,
    );
    const creados = spy.mock.calls.filter((c) => c[1] === 1000).length;
    expect(creados).toBeLessThanOrEqual(1);
    spy.mockRestore();
  });

  it('muestra el número del día como insignia y nada si no hay número', () => {
    const { rerender, container } = render(<NumeroDia numero={7} />);
    expect(screen.getByTestId('numero-dia')).toHaveTextContent('#7');
    rerender(<NumeroDia numero={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
