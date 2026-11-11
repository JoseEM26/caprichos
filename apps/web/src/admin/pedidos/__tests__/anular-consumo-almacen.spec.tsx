import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalAnular } from '../ModalAnular';
import { pedidosApi } from '../pedidosApi';

const pedido = (extra: object = {}): any => ({ id: '10', codigo: 'CP-010', estado: 'PREPARANDO', modalidad: 'MESA', total: 20, lineas: [], ...extra });

async function anular(p: any) {
  render(<ModalAnular pedidoId="10" codigoPedido="CP-010" pedido={p} alCerrar={vi.fn()} alAnularExitoso={vi.fn()} />);
  fireEvent.change(screen.getByLabelText(/Motivo detallado/i), { target: { value: 'Cliente desistió' } });
  fireEvent.click(screen.getByRole('button', { name: /Confirmar anulación/i }));
  fireEvent.click(screen.getByRole('button', { name: /Sí, anular/i }));
}

describe('Anular un pedido con consumo de almacén', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('con almacén apagado (el API no manda tieneConsumoAlmacen) no aparece nada nuevo ni se envía el campo', async () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    await anular(pedido());
    expect(screen.queryByText('¿Se llegó a preparar?')).toBeNull();
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith('10', 'ANULADO', 'Cliente desistió'));
  });

  it('con consumo registrado pregunta y por defecto queda como merma', async () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    render(<ModalAnular pedidoId="10" codigoPedido="CP-010" pedido={pedido({ tieneConsumoAlmacen: true })} alCerrar={vi.fn()} alAnularExitoso={vi.fn()} />);
    expect(screen.getByText('¿Se llegó a preparar?')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Motivo detallado/i), { target: { value: 'Cliente desistió' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar anulación/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, anular/i }));
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith('10', 'ANULADO', 'Cliente desistió', undefined, 'MERMA'));
  });

  it('«nunca se preparó» envía DEVOLVER', async () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    render(<ModalAnular pedidoId="10" codigoPedido="CP-010" pedido={pedido({ tieneConsumoAlmacen: true })} alCerrar={vi.fn()} alAnularExitoso={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/nunca se preparó/i));
    fireEvent.change(screen.getByLabelText(/Motivo detallado/i), { target: { value: 'Cliente desistió' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar anulación/i }));
    fireEvent.click(screen.getByRole('button', { name: /Sí, anular/i }));
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith('10', 'ANULADO', 'Cliente desistió', undefined, 'DEVOLVER'));
  });
});
