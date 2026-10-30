import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ModalAvisoEntrada, yaVistoHoyStorage, marcarVistoHoyStorage } from '../ModalAvisoEntrada';
import { EstadoLocalCarta } from '../tipos';
import { OfertaItem } from '../../admin/ofertas/ofertasApi';
import * as CarritoContext from '../CarritoContext';

const mockEstadoAbierto: EstadoLocalCarta = {
  abierta: true,
  motivo: 'OK',
  texto: 'Abierto',
  abre: '14:00',
  cierra: '22:00',
  pausaAltaDemanda: false,
  tiempoPrometidoMin: 30,
  altaDemandaMin: 0,
  cartaAvisoEntrada: true,
};

const mockOfertaPromo: OfertaItem = {
  id: 'of1',
  tipo: 'LLEVA_PAGA',
  nombre: '2x1 Latte Coffee',
  descripcion: 'Disfruta de nuestro mejor café',
  lleva: 2,
  paga: 1,
  alcanceProductoId: '10',
  productoNombre: 'Latte Coffee',
  alcanceCategoriaId: null,
  descuentoTipo: null,
  descuentoValor: null,
  compraMinima: null,
  dias: [],
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

describe('ModalAvisoEntrada (Ventana al entrar opcional y apagable)', () => {
  const TEST_STORAGE_KEY = 'test_aviso_entrada_fecha';

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(CarritoContext, 'useCarrito').mockReturnValue({
      checkoutAbierto: false,
    } as any);
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('1. APAGADA POR DEFECTO: no se muestra si cartaAvisoEntrada es false o undefined', () => {
    const estadoApagado: EstadoLocalCarta = {
      ...mockEstadoAbierto,
      cartaAvisoEntrada: false,
    };

    const { rerender } = render(
      <ModalAvisoEntrada
        ofertas={[mockOfertaPromo]}
        estadoLocal={estadoApagado}
        onVerPromocion={vi.fn()}
        storageKey={TEST_STORAGE_KEY}
      />,
    );

    expect(screen.queryByTestId('modal-aviso-entrada')).toBeNull();

    // Cuando cartaAvisoEntrada es undefined
    const estadoSinParametro: EstadoLocalCarta = {
      ...mockEstadoAbierto,
      cartaAvisoEntrada: undefined,
    };
    rerender(
      <ModalAvisoEntrada
        ofertas={[mockOfertaPromo]}
        estadoLocal={estadoSinParametro}
        onVerPromocion={vi.fn()}
        storageKey={TEST_STORAGE_KEY}
      />,
    );
    expect(screen.queryByTestId('modal-aviso-entrada')).toBeNull();
  });

  it('2. Se muestra cuando está activada, el local está abierto y hay promoción vigente', () => {
    const onVerPromo = vi.fn();
    render(
      <ModalAvisoEntrada
        ofertas={[mockOfertaPromo]}
        estadoLocal={mockEstadoAbierto}
        onVerPromocion={onVerPromo}
        storageKey={TEST_STORAGE_KEY}
      />,
    );

    const modal = screen.getByTestId('modal-aviso-entrada');
    expect(modal).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(modal.textContent).toContain('2x1 en Latte Coffee');
    expect(modal.textContent).toContain('Disfruta de nuestro mejor café');

    const btnVer = screen.getByRole('button', { name: 'Ver promoción' });
    fireEvent.click(btnVer);
    expect(onVerPromo).toHaveBeenCalledTimes(1);

    // Marca como visto hoy en localStorage
    expect(yaVistoHoyStorage(TEST_STORAGE_KEY)).toBe(true);
  });

  it('3. MÁXIMO UNA VEZ POR DÍA: no vuelve a aparecer si ya se vio hoy', () => {
    marcarVistoHoyStorage(TEST_STORAGE_KEY);
    expect(yaVistoHoyStorage(TEST_STORAGE_KEY)).toBe(true);

    render(
      <ModalAvisoEntrada
        ofertas={[mockOfertaPromo]}
        estadoLocal={mockEstadoAbierto}
        onVerPromocion={vi.fn()}
        storageKey={TEST_STORAGE_KEY}
      />,
    );

    expect(screen.queryByTestId('modal-aviso-entrada')).toBeNull();
  });

  it('4. JAMÁS se muestra si la carta está cerrada o en pausa por alta demanda', () => {
    // Local cerrado
    const estadoCerrado: EstadoLocalCarta = {
      ...mockEstadoAbierto,
      abierta: false,
    };

    const { rerender } = render(
      <ModalAvisoEntrada
        ofertas={[mockOfertaPromo]}
        estadoLocal={estadoCerrado}
        onVerPromocion={vi.fn()}
        storageKey={TEST_STORAGE_KEY}
      />,
    );
    expect(screen.queryByTestId('modal-aviso-entrada')).toBeNull();

    // Pausa por alta demanda
    const estadoPausa: EstadoLocalCarta = {
      ...mockEstadoAbierto,
      abierta: true,
      pausaAltaDemanda: true,
    };
    rerender(
      <ModalAvisoEntrada
        ofertas={[mockOfertaPromo]}
        estadoLocal={estadoPausa}
        onVerPromocion={vi.fn()}
        storageKey={TEST_STORAGE_KEY}
      />,
    );
    expect(screen.queryByTestId('modal-aviso-entrada')).toBeNull();
  });

  it('5. JAMÁS se muestra durante el checkout', () => {
    vi.spyOn(CarritoContext, 'useCarrito').mockReturnValue({
      checkoutAbierto: true,
    } as any);

    render(
      <ModalAvisoEntrada
        ofertas={[mockOfertaPromo]}
        estadoLocal={mockEstadoAbierto}
        onVerPromocion={vi.fn()}
        storageKey={TEST_STORAGE_KEY}
      />,
    );

    expect(screen.queryByTestId('modal-aviso-entrada')).toBeNull();
  });

  it('6. Tecla Escape cierra la ventana y marca visto hoy', () => {
    render(
      <ModalAvisoEntrada
        ofertas={[mockOfertaPromo]}
        estadoLocal={mockEstadoAbierto}
        onVerPromocion={vi.fn()}
        storageKey={TEST_STORAGE_KEY}
      />,
    );

    expect(screen.getByTestId('modal-aviso-entrada')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('modal-aviso-entrada')).toBeNull();
    expect(yaVistoHoyStorage(TEST_STORAGE_KEY)).toBe(true);
  });
});
