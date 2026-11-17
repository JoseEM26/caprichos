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

describe('programado: la espera cuenta desde la hora pactada', () => {
  // Creado ayer 17:40 para hoy 17:00 (Lima): el reloj es la hora pactada, nunca «22 h»
  const ayer = '2026-11-08T12:40:00Z'; // hace ~26 h
  const pactada = (minDentro: number) => new Date(T0 + minDentro * 60000).toISOString();

  it('antes de la hora pactada: verde y «faltan 20 min»', () => {
    render(<PastillaEspera creadoEn={ayer} programadoPara={pactada(20)} cerrado={false} />);
    const p = screen.getByRole('timer');
    expect(p).toHaveTextContent('faltan 20 min');
    expect(p).toHaveAttribute('data-nivel', 'verde');
    expect(p).not.toHaveTextContent(/h/);
  });

  it('pasada la hora pactada +12 min: texto de retraso y nivel por umbral (verde < 35)', () => {
    render(<PastillaEspera creadoEn={ayer} programadoPara={pactada(-12)} cerrado={false} />);
    const p = screen.getByRole('timer');
    expect(p).toHaveTextContent('+12 min');
    expect(p).toHaveAttribute('data-nivel', 'verde');
  });

  it('+36 min de retraso: óxido «Atención»; +50 min: rojo «Tarde»', () => {
    const { unmount } = render(<PastillaEspera creadoEn={ayer} programadoPara={pactada(-36)} cerrado={false} />);
    expect(screen.getByRole('timer')).toHaveAttribute('data-nivel', 'oxido');
    unmount();
    render(<PastillaEspera creadoEn={ayer} programadoPara={pactada(-50)} cerrado={false} />);
    expect(screen.getByRole('timer')).toHaveAttribute('data-nivel', 'rojo');
    expect(screen.getByRole('timer')).toHaveTextContent('+50 min');
  });

  it('en vivo: pasa de «faltan» a «+» cuando llega la hora pactada', () => {
    render(<PastillaEspera creadoEn={ayer} programadoPara={pactada(1)} cerrado={false} />);
    expect(screen.getByRole('timer')).toHaveTextContent('faltan 1 min');
    act(() => { vi.advanceTimersByTime(2 * 60000); });
    expect(screen.getByRole('timer')).toHaveTextContent('+1 min');
  });

  it('sin programado_para sigue contando desde creado_en', () => {
    render(<PastillaEspera creadoEn={creado(40)} programadoPara={null} cerrado={false} />);
    expect(screen.getByRole('timer')).toHaveTextContent('40 min');
    expect(screen.getByRole('timer')).toHaveAttribute('data-nivel', 'oxido');
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
