import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FranjaAvisoCarta, formatearTextoOferta, obtenerDiaSemanaLima } from '../FranjaAvisoCarta';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';

const mockOferta2x1: OfertaItem = {
  id: '1',
  tipo: 'LLEVA_PAGA',
  nombre: '2x1 Café Americano',
  descripcion: 'Lleva 2 y paga 1',
  lleva: 2,
  paga: 1,
  alcanceProductoId: '10',
  productoNombre: 'Café Americano',
  alcanceCategoriaId: null,
  descuentoTipo: null,
  descuentoValor: null,
  compraMinima: null,
  dias: [1, 2, 3, 4, 5, 6, 7],
  horaDesde: null,
  horaHasta: null,
  fechaDesde: null,
  fechaHasta: null,
  canales: ['CARTA'],
  limiteUsos: null,
  usosActuales: 0,
  noSumaBeneficios: false,
  orden: 1,
  activo: true,
  creadoEn: '',
  vigenteAhora: true,
};

const mockOfertaDescuento: OfertaItem = {
  id: '2',
  tipo: 'DESCUENTO',
  nombre: '15% en Waffles',
  descripcion: '15% de descuento en Waffles',
  lleva: null,
  paga: null,
  alcanceProductoId: null,
  alcanceCategoriaId: '3',
  categoriaNombre: 'Waffles',
  descuentoTipo: 'PORCENTAJE',
  descuentoValor: 15,
  compraMinima: null,
  dias: [1, 2, 3, 4, 5, 6, 7],
  horaDesde: null,
  horaHasta: null,
  fechaDesde: null,
  fechaHasta: null,
  canales: ['CARTA'],
  limiteUsos: null,
  usosActuales: 0,
  noSumaBeneficios: false,
  orden: 2,
  activo: true,
  creadoEn: '',
  vigenteAhora: true,
};

describe('FranjaAvisoCarta', () => {
  const STORAGE_KEY = 'test_franja_cerrada';

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('1. No se muestra si no hay ofertas con vigenteAhora = true', () => {
    const ofertaNoVigente: OfertaItem = {
      ...mockOferta2x1,
      vigenteAhora: false,
    };

    const { container } = render(
      <FranjaAvisoCarta
        ofertas={[ofertaNoVigente]}
        onVerPromociones={vi.fn()}
        storageKey={STORAGE_KEY}
      />,
    );

    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId('franja-aviso-carta')).toBeNull();
  });

  it('2. Muestra la promoción de HOY con día de la semana y enlace accesible', () => {
    const onVerPromos = vi.fn();
    render(
      <FranjaAvisoCarta
        ofertas={[mockOferta2x1]}
        onVerPromociones={onVerPromos}
        storageKey={STORAGE_KEY}
      />,
    );

    const franja = screen.getByTestId('franja-aviso-carta');
    expect(franja).toBeInTheDocument();
    expect(franja).toHaveAttribute('role', 'status');
    expect(franja).toHaveAttribute('aria-live', 'polite');

    const dia = obtenerDiaSemanaLima();
    expect(franja.textContent).toContain(`Hoy ${dia}: 2x1 en Café Americano.`);

    const btnVer = screen.getByRole('button', { name: /ver promociones/i });
    expect(btnVer).toBeInTheDocument();
    fireEvent.click(btnVer);
    expect(onVerPromos).toHaveBeenCalledTimes(1);
  });

  it('3. Se puede cerrar con la X y recuerda el cierre en sessionStorage', () => {
    const { rerender } = render(
      <FranjaAvisoCarta
        ofertas={[mockOferta2x1]}
        onVerPromociones={vi.fn()}
        storageKey={STORAGE_KEY}
      />,
    );

    expect(screen.getByTestId('franja-aviso-carta')).toBeInTheDocument();

    const btnCerrar = screen.getByRole('button', { name: 'Cerrar aviso' });
    fireEvent.click(btnCerrar);

    expect(screen.queryByTestId('franja-aviso-carta')).toBeNull();
    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('true');

    // Al re-renderizar durante la misma visita, sigue cerrada
    rerender(
      <FranjaAvisoCarta
        ofertas={[mockOferta2x1]}
        onVerPromociones={vi.fn()}
        storageKey={STORAGE_KEY}
      />,
    );
    expect(screen.queryByTestId('franja-aviso-carta')).toBeNull();
  });

  it('4. Si hay varias ofertas, rota suavemente cada 6 s y se detiene al enfocar', () => {
    render(
      <FranjaAvisoCarta
        ofertas={[mockOferta2x1, mockOfertaDescuento]}
        onVerPromociones={vi.fn()}
        storageKey={STORAGE_KEY}
        intervaloMs={6000}
      />,
    );

    const franja = screen.getByTestId('franja-aviso-carta');
    // Inicialmente muestra la de mayor beneficio (2x1 es 50%, 15% es 15%)
    expect(franja.textContent).toContain('2x1 en Café Americano');

    // Avanza 6 segundos
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(franja.textContent).toContain('15 % de descuento en Waffles');

    // Avanza 6 segundos más para volver al inicio
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(franja.textContent).toContain('2x1 en Café Americano');

    // Al enfocar (o hover), la rotación se pausa
    fireEvent.focus(franja);
    act(() => {
      vi.advanceTimersByTime(12000);
    });
    // Sigue en la primera oferta porque estuvo pausado
    expect(franja.textContent).toContain('2x1 en Café Americano');

    // Al perder el foco (blur), se reanuda
    fireEvent.blur(franja);
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(franja.textContent).toContain('15 % de descuento en Waffles');
  });

  it('5. formatearTextoOferta formatea correctamente LLEVA_PAGA y DESCUENTO', () => {
    expect(formatearTextoOferta(mockOferta2x1)).toBe('2x1 en Café Americano');
    expect(formatearTextoOferta(mockOfertaDescuento)).toBe('15 % de descuento en Waffles');

    const ofertaLleva3Paga2: OfertaItem = {
      ...mockOferta2x1,
      lleva: 3,
      paga: 2,
      productoNombre: 'Donas',
    };
    expect(formatearTextoOferta(ofertaLleva3Paga2)).toBe('Lleva 3 paga 2 en Donas');

    const ofertaMonto: OfertaItem = {
      ...mockOfertaDescuento,
      descuentoTipo: 'MONTO',
      descuentoValor: 10,
      categoriaNombre: 'Frappes',
    };
    expect(formatearTextoOferta(ofertaMonto)).toBe('S/ 10 de descuento en Frappes');
  });
});
