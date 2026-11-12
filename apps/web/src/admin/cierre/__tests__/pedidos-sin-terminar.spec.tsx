import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { PedidosSinTerminarCierre } from '../PedidosSinTerminarCierre';
import { pedidosApi } from '../../pedidos/pedidosApi';
import type { PendienteCobro } from '../cierreApi';

const pedido = (id: number, o: Partial<PendienteCobro> = {}): PendienteCobro => ({
  id,
  codigo: `CP-${id}`,
  canal: 'WHATSAPP',
  modalidad: 'DELIVERY',
  estado: 'LISTO',
  total: 32,
  fecha: new Date().toISOString(),
  pagoEstado: 'PAGADO',
  clienteNombre: 'Cliente Prueba',
  ...o,
});

function montar(lista: PendienteCobro[], o: { esAdmin?: boolean; motivo?: string; alJustificar?: (m: string) => void; setPedidos?: (l: PendienteCobro[]) => void } = {}) {
  return render(<PedidosSinTerminarCierre pedidos={lista} setPedidos={o.setPedidos ?? (() => {})} alCambiar={() => {}} {...o} />);
}

describe('Cierre: pedidos sin terminar', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('lista el delivery pagado en Listo con su estado, pago y total, y enlaza a Repartos', () => {
    montar([pedido(1)]);
    expect(screen.getByText('CP-1')).toBeTruthy();
    expect(screen.getByText('Listo')).toBeTruthy();
    expect(screen.getByText('Pagado')).toBeTruthy();
    expect(screen.getByText('S/ 32.00')).toBeTruthy();
    expect(screen.getByText('Ir a Repartos').getAttribute('href')).toBe('/admin/repartos');
    expect(screen.getByText('Anular con motivo')).toBeTruthy();
  });

  it('sin pedidos no pinta nada', () => {
    const { container } = montar([]);
    expect(container.firstChild).toBeNull();
  });

  it('Entregar solo en En camino (delivery) y llama al estado ENTREGADO', async () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as never);
    const setPedidos = vi.fn();
    montar([pedido(1, { estado: 'LISTO' }), pedido(2, { estado: 'EN_CAMINO' })], { setPedidos });
    expect(screen.getAllByText('Entregar')).toHaveLength(1);
    fireEvent.click(screen.getByText('Entregar'));
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith(2, 'ENTREGADO'));
    expect(setPedidos).toHaveBeenCalled();
  });

  it('el cajero no ve la justificación; el ADMIN pide 10 letras', () => {
    montar([pedido(1)], { esAdmin: false, alJustificar: vi.fn() });
    expect(screen.queryByLabelText('Justificar pedidos sin terminar')).toBeNull();
    cleanup();
    const alJustificar = vi.fn();
    montar([pedido(1)], { esAdmin: true, alJustificar });
    const boton = screen.getByText('Justificar sin terminar y permitir el cierre') as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText(/Cerrar con estos pedidos sin terminar/), { target: { value: ' Cliente no contesta ' } });
    expect(boton.disabled).toBe(false);
    fireEvent.click(boton);
    expect(alJustificar).toHaveBeenCalledWith('Cliente no contesta');
  });
});
