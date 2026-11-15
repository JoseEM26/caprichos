import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePulsacionLarga } from '../usePulsacionLarga';

// jsdom puede no traer PointerEvent con coordenadas.
if (typeof window.PointerEvent === 'undefined') {
  (window as any).PointerEvent = class extends MouseEvent {
    pointerType: string;
    constructor(tipo: string, init: any = {}) {
      super(tipo, init);
      this.pointerType = init.pointerType ?? 'touch';
    }
  };
}

function Caja({ alPulsar, alToque }: { alPulsar: () => void; alToque: () => void }) {
  const lp = usePulsacionLarga(alPulsar);
  return <button {...lp} onClick={alToque}>caja</button>;
}

describe('usePulsacionLarga', () => {
  const alPulsar = vi.fn();
  const alToque = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    alPulsar.mockReset();
    alToque.mockReset();
    render(<Caja alPulsar={alPulsar} alToque={alToque} />);
  });
  afterEach(() => vi.useRealTimers());
  const caja = () => screen.getByText('caja');
  const down = (x = 0, y = 0) => fireEvent.pointerDown(caja(), { clientX: x, clientY: y, pointerType: 'touch', button: 0 });

  it('dispara tras mantener, vibra y no deja pasar el toque corto', () => {
    const vibrar = vi.fn();
    (navigator as any).vibrate = vibrar;
    down();
    expect(caja().getAttribute('data-presionando')).toBe('true');
    act(() => { vi.advanceTimersByTime(700); });
    expect(alPulsar).toHaveBeenCalledTimes(1);
    expect(vibrar).toHaveBeenCalledWith(10);
    fireEvent.pointerUp(caja());
    fireEvent.click(caja());
    expect(alToque).not.toHaveBeenCalled();
    // el siguiente toque sí cuenta
    fireEvent.click(caja());
    expect(alToque).toHaveBeenCalledTimes(1);
  });

  it('un toque corto no dispara la pulsación larga', () => {
    down();
    act(() => { vi.advanceTimersByTime(200); });
    fireEvent.pointerUp(caja());
    fireEvent.click(caja());
    act(() => { vi.advanceTimersByTime(1000); });
    expect(alPulsar).not.toHaveBeenCalled();
    expect(alToque).toHaveBeenCalledTimes(1);
  });

  it('mover el dedo más de 10 px cancela', () => {
    down(0, 0);
    fireEvent.pointerMove(caja(), { clientX: 0, clientY: 30 });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(alPulsar).not.toHaveBeenCalled();
  });

  it('el menú contextual (clic derecho) abre lo mismo, una sola vez', () => {
    const noCancelado = fireEvent.contextMenu(caja());
    expect(noCancelado).toBe(false); // preventDefault
    expect(alPulsar).toHaveBeenCalledTimes(1);
  });
});
