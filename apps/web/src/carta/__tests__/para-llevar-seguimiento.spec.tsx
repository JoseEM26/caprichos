import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { PantallaConfirmacion } from '../PantallaConfirmacion';

let estado: any = null;
vi.mock('../CarritoContext', () => ({
  useCarrito: () => ({
    pedidoConfirmado: { codigo: 'CP-9', seguimientoToken: 't', modalidad: 'COMER_LOCAL', clienteNombre: 'Rosa' },
    setPedidoConfirmado: vi.fn(),
    seguimientoAbierto: null,
    setSeguimientoAbierto: vi.fn(),
  }),
}));
vi.mock('../seguimiento', () => ({
  leerPedidosGuardados: () => [],
  useSeguimientoPedido: () => ({ estado, error: false }),
}));
vi.mock('../../pwa/BannerInstalarApp', () => ({ BannerInstalarApp: () => null }));

const base = { codigo: 'CP-9', estado: 'COLA', estadoEtiqueta: 'En cola', modalidad: 'COMER_LOCAL', total: 30, terminado: false, anulado: false, pasos: [] };

describe('Seguimiento: productos para llevar', () => {
  it('cada producto para llevar lleva su chip y, si hay mezcla, el resumen', () => {
    estado = {
      ...base,
      detalle: {
        subtotal: 30,
        descuento: 0,
        envio: null,
        puntosCanjeados: 0,
        nota: null,
        lineas: [
          { nombre: 'Frappé', cantidad: 2, nota: null, paraLlevar: true },
          { nombre: 'Torta', cantidad: 1, nota: null, paraLlevar: false },
        ],
      },
    };
    render(<PantallaConfirmacion />);
    fireEvent.click(screen.getByRole('tab', { name: /Mi pedido/ }));
    const productos = screen.getAllByTestId('producto-seguimiento');
    expect(within(productos[0]).getByTestId('chip-para-llevar')).toHaveTextContent('Para llevar');
    expect(within(productos[1]).queryByTestId('chip-para-llevar')).not.toBeInTheDocument();
    expect(screen.getByTestId('resumen-para-llevar')).toHaveTextContent('2 para llevar · 1 aquí');
  });

  it('un pedido repartido (2 frappés: 1 para llevar y 1 aquí) llega como dos líneas con su chip y el resumen', () => {
    estado = {
      ...base,
      detalle: {
        subtotal: 29,
        descuento: 0,
        envio: null,
        puntosCanjeados: 0,
        nota: null,
        lineas: [
          { nombre: 'Frappé', cantidad: 1, nota: null, paraLlevar: false },
          { nombre: 'Frappé', cantidad: 1, nota: null, paraLlevar: true },
        ],
      },
    };
    render(<PantallaConfirmacion />);
    fireEvent.click(screen.getByRole('tab', { name: /Mi pedido/ }));
    const productos = screen.getAllByTestId('producto-seguimiento');
    expect(productos).toHaveLength(2);
    expect(within(productos[0]).queryByTestId('chip-para-llevar')).not.toBeInTheDocument();
    expect(within(productos[1]).getByTestId('chip-para-llevar')).toBeInTheDocument();
    expect(screen.getByTestId('resumen-para-llevar')).toHaveTextContent('1 para llevar · 1 aquí');
  });

  it('sin ninguna marca no hay chip ni resumen', () => {
    estado = {
      ...base,
      detalle: { subtotal: 14.5, descuento: 0, envio: null, puntosCanjeados: 0, nota: null, lineas: [{ nombre: 'Torta', cantidad: 1, nota: null, paraLlevar: false }] },
    };
    render(<PantallaConfirmacion />);
    expect(screen.queryByTestId('chip-para-llevar')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resumen-para-llevar')).not.toBeInTheDocument();
  });
});
