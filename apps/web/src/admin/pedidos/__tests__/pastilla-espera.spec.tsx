import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { PastillaEspera, textoMinutos } from '../PastillaEspera';
import { TarjetaPedidoCaja } from '../TarjetaPedidoCaja';
import type { Pedido } from '../pedidosApi';

const T0 = Date.parse('2026-11-08T15:00:00Z');
const creado = (minAtras: number, seg = 0) => new Date(T0 - minAtras * 60000 - seg * 1000).toISOString();

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(T0); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('PastillaEspera en vivo', () => {
  it('avanza sola cada 30 s (29 s no cambia) y el semáforo cambia a 35 y 50 min', () => {
    render(<PastillaEspera creadoEn={creado(34, 40)} cerrado={false} />);
    const p = () => screen.getByRole('timer');
    expect(p()).toHaveTextContent('34 min');
    expect(p()).toHaveAttribute('data-nivel', 'verde');
    expect(p()).toHaveAttribute('aria-label', 'Hace 34 minutos, en tiempo');
    act(() => { vi.advanceTimersByTime(29000); });
    expect(p()).toHaveTextContent('34 min');
    act(() => { vi.advanceTimersByTime(1000); }); // 30 s: 35 min 10 s
    expect(p()).toHaveTextContent('35 min');
    expect(p()).toHaveAttribute('data-nivel', 'oxido');
    expect(p()).toHaveTextContent('Atención');
    act(() => { vi.advanceTimersByTime(15 * 60000); });
    expect(p()).toHaveAttribute('data-nivel', 'rojo');
    expect(p()).toHaveTextContent('Tarde');
  });

  it('cerrado: neutro, con la hora y sin semáforo', () => {
    render(<PastillaEspera creadoEn={creado(90)} cerrado />);
    const p = screen.getByRole('timer');
    expect(p).toHaveAttribute('data-nivel', 'neutro');
    expect(p).not.toHaveTextContent(/Tarde|Atención|En tiempo/);
  });

  it('un solo intervalo para varias pastillas y se limpia al desmontar', () => {
    const set = vi.spyOn(globalThis, 'setInterval');
    const clear = vi.spyOn(globalThis, 'clearInterval');
    const { unmount } = render(
      <>
        <PastillaEspera creadoEn={creado(1)} cerrado={false} />
        <PastillaEspera creadoEn={creado(2)} cerrado={false} />
        <PastillaEspera creadoEn={creado(3)} cerrado={false} />
      </>,
    );
    expect(set).toHaveBeenCalledTimes(1);
    unmount();
    expect(clear).toHaveBeenCalledTimes(1);
  });

  it('formatos de texto', () => {
    expect(textoMinutos(12)).toBe('12 min');
    expect(textoMinutos(65)).toBe('1 h 05');
    expect(textoMinutos(1500)).toBe('ayer');
  });
});

describe('jerarquía de la tarjeta', () => {
  it('el nombre lleva cj2-nombre (22 px), el código cj2-codigo (12.5 px) y sigue presente', () => {
    render(
      <TarjetaPedidoCaja
        pedido={{ id: '1', codigo: 'CP-0001', canal: 'CARTA', modalidad: 'LLEVAR', estado: 'COLA', total: 5, cliente_nombre: 'Lucía', lineas: [], creado_en: creado(5) } as unknown as Pedido}
        seleccionado={false} resaltado={false} cajaCerradaEspera={false} cambioCobroPendiente={false} alSeleccionar={vi.fn()}
      />,
    );
    expect(screen.getByRole('heading')).toHaveClass('cj2-nombre');
    expect(screen.getByText('CP-0001')).toHaveClass('cj2-codigo');
  });
});
