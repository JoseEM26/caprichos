import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ComandaTarjeta } from '../ComandaTarjeta';
import { ModalAnular } from '../../pedidos/ModalAnular';
import { pedidosApi } from '../../pedidos/pedidosApi';
import * as sesionModulo from '../../../comun/sesion';
import { limpiarAutorizacionSupervisor } from '../../../comun/autorizacionSupervisor';
import type { Comanda } from '../cocinaTipos';

const comanda: Comanda = {
  id: '301-1',
  pedidoId: '301',
  areaId: '1',
  areaNombre: 'Bebidas',
  ticket: 'CP-301',
  codigo: 'CP-301',
  canal: 'WEB',
  modalidad: 'RECOGER',
  minutos: 5,
  color: 'VERDE',
  creado_en: new Date().toISOString(),
  lineas: [{ id: 'l1', nombre: 'Americano', cantidad: 1, opciones: [], personas: [], nota: null }],
  despejada: false,
};

const comoRol = (rol: string) =>
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { partyId: '3', nombres: 'X', rol }, tiene: () => true } as any);

describe('Anular el pedido completo desde la comanda de cocina', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    limpiarAutorizacionSupervisor();
  });

  it('el botón «Anular pedido» solo sale si la vista da el permiso (alAnular)', () => {
    const { rerender } = render(<ComandaTarjeta comanda={comanda} onDespejar={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Anular pedido' })).toBeNull();

    const alAnular = vi.fn();
    rerender(<ComandaTarjeta comanda={comanda} onDespejar={() => {}} alAnular={alAnular} />);
    const boton = screen.getByRole('button', { name: 'Anular pedido' });
    expect(boton.style.minHeight).toBe('44px');
    fireEvent.click(boton);
    expect(alAnular).toHaveBeenCalledWith(comanda);
  });

  it('ADMIN: avisa que es el pedido completo, confirma Sí/No y no pide código', async () => {
    comoRol('ADMIN');
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    const exito = vi.fn();
    render(<ModalAnular pedidoId="301" codigoPedido="CP-301" completo alCerrar={vi.fn()} alAnularExitoso={exito} />);

    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
    expect(screen.getByText(/pedido COMPLETO, con todas sus áreas/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Motivo detallado/), { target: { value: 'Cliente se fue' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar anulación/ }));
    expect(screen.getByText(/Se anula el pedido COMPLETO, todas las áreas/)).toBeInTheDocument();
    expect(cambiar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Sí, anular/ }));
    await waitFor(() => expect(exito).toHaveBeenCalled());
    expect(cambiar).toHaveBeenCalledWith('301', 'ANULADO', 'Cliente se fue', '');
  });

  it('COCINA: anula sin código de supervisor, avisa que es el pedido completo y confirma Sí/No', async () => {
    comoRol('COCINA');
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    render(<ModalAnular pedidoId="301" codigoPedido="CP-301" completo alCerrar={vi.fn()} alAnularExitoso={vi.fn()} />);

    expect(screen.queryByTestId('input-codigo-supervisor')).toBeNull();
    expect(screen.getByText(/Se anula el pedido COMPLETO/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Motivo detallado/), { target: { value: 'Cliente se fue' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirmar anulación/ }));
    expect(cambiar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Sí, anular/ }));

    await waitFor(() => expect(cambiar).toHaveBeenCalledWith('301', 'ANULADO', 'Cliente se fue', ''));
  });
});
