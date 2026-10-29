import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMantenerPresionado } from '../useMantenerPresionado';
import { instalarPointerEvent } from './PolyfillPointer';

instalarPointerEvent();

const evento = (x = 10, y = 10, button = 0) =>
  ({ clientX: x, clientY: y, button, stopPropagation: vi.fn(), preventDefault: vi.fn() }) as any;

describe('useMantenerPresionado', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('dispara a los 3 s con el valor de la mesa, no antes', () => {
    const alCompletar = vi.fn();
    const { result } = renderHook(() => useMantenerPresionado<string>(alCompletar));

    act(() => result.current.manejadores('mesa-1').onPointerDown(evento()));
    act(() => vi.advanceTimersByTime(2950));
    expect(alCompletar).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(100));
    expect(alCompletar).toHaveBeenCalledTimes(1);
    expect(alCompletar).toHaveBeenCalledWith('mesa-1');
  });

  it('la duracion es configurable', () => {
    const alCompletar = vi.fn();
    const { result } = renderHook(() => useMantenerPresionado<string>(alCompletar, 1000));

    act(() => result.current.manejadores('x').onPointerDown(evento()));
    act(() => vi.advanceTimersByTime(1000));
    expect(alCompletar).toHaveBeenCalledWith('x');
  });

  it('expone el progreso de 0 a 1 mientras se mantiene', () => {
    const { result } = renderHook(() => useMantenerPresionado<string>(vi.fn()));

    act(() => result.current.manejadores('x').onPointerDown(evento()));
    expect(result.current.objetivo).toBe('x');
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.progreso).toBeCloseTo(0.5, 1);
    act(() => vi.advanceTimersByTime(1500));
    expect(result.current.progreso).toBe(0);
    expect(result.current.activo).toBe(false);
  });

  it('se cancela si se suelta antes de los 3 s', () => {
    const alCompletar = vi.fn();
    const { result } = renderHook(() => useMantenerPresionado<string>(alCompletar));

    act(() => result.current.manejadores('x').onPointerDown(evento()));
    act(() => vi.advanceTimersByTime(1000));
    act(() => result.current.manejadores('x').onPointerUp());
    act(() => vi.advanceTimersByTime(5000));

    expect(alCompletar).not.toHaveBeenCalled();
    expect(result.current.progreso).toBe(0);
  });

  it('se cancela si el puntero sale del elemento o se cancela el gesto', () => {
    const alCompletar = vi.fn();
    const { result } = renderHook(() => useMantenerPresionado<string>(alCompletar));

    act(() => result.current.manejadores('x').onPointerDown(evento()));
    act(() => result.current.manejadores('x').onPointerLeave());
    act(() => vi.advanceTimersByTime(4000));
    expect(alCompletar).not.toHaveBeenCalled();

    act(() => result.current.manejadores('x').onPointerDown(evento()));
    act(() => result.current.manejadores('x').onPointerCancel());
    act(() => vi.advanceTimersByTime(4000));
    expect(alCompletar).not.toHaveBeenCalled();
  });

  it('se cancela si el dedo se mueve mas de 10 px, pero no con un movimiento pequeno', () => {
    const alCompletar = vi.fn();
    const { result } = renderHook(() => useMantenerPresionado<string>(alCompletar));

    act(() => result.current.manejadores('x').onPointerDown(evento(10, 10)));
    act(() => result.current.manejadores('x').onPointerMove(evento(16, 14)));
    act(() => vi.advanceTimersByTime(3100));
    expect(alCompletar).toHaveBeenCalledTimes(1);

    alCompletar.mockClear();
    act(() => result.current.manejadores('x').onPointerDown(evento(10, 10)));
    act(() => result.current.manejadores('x').onPointerMove(evento(25, 10)));
    act(() => vi.advanceTimersByTime(3100));
    expect(alCompletar).not.toHaveBeenCalled();
  });

  it('ignora el clic derecho', () => {
    const alCompletar = vi.fn();
    const { result } = renderHook(() => useMantenerPresionado<string>(alCompletar));

    act(() => result.current.manejadores('x').onPointerDown(evento(10, 10, 2)));
    act(() => vi.advanceTimersByTime(4000));
    expect(alCompletar).not.toHaveBeenCalled();
  });

  it('el clic que sigue a una pulsacion completada no llega al elemento; un toque normal si', () => {
    const { result } = renderHook(() => useMantenerPresionado<string>(vi.fn()));

    act(() => result.current.manejadores('x').onPointerDown(evento()));
    act(() => vi.advanceTimersByTime(3000));
    const clicTrasPulsacion = evento();
    result.current.manejadores('x').onClickCapture(clicTrasPulsacion);
    expect(clicTrasPulsacion.stopPropagation).toHaveBeenCalled();

    const toqueNormal = evento();
    result.current.manejadores('x').onClickCapture(toqueNormal);
    expect(toqueNormal.stopPropagation).not.toHaveBeenCalled();
  });
});
