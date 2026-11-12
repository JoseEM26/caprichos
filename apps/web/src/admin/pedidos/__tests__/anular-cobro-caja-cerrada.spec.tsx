import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalAnular } from '../ModalAnular';
import { pedidosApi } from '../pedidosApi';
import { ErrorApi } from '../../../comun/api';

const abrir = (esAdmin: boolean) =>
  render(<ModalAnular pedidoId="10" codigoPedido="CP-010" esCobro cobroId="7" esAdmin={esAdmin} alCerrar={vi.fn()} alAnularExitoso={vi.fn()} />);

async function chocarConCajaCerrada() {
  fireEvent.change(screen.getByLabelText(/Motivo detallado/i), { target: { value: 'Error al digitar' } });
  fireEvent.click(screen.getByRole('button', { name: /Confirmar anulación/i }));
  fireEvent.click(screen.getByRole('button', { name: /Sí, anular/i }));
  await screen.findByRole('alert');
}

describe('Anular cobro de una caja cerrada', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(pedidosApi, 'anularCobro').mockRejectedValue(new ErrorApi('CAJA_CERRADA', 'Caja cerrada', 409));
  });

  it('ADMIN: ofrece anular de todos modos, pide 10 caracteres y usa el endpoint de caja cerrada', async () => {
    const cerrada = vi.spyOn(pedidosApi, 'anularCobroCajaCerrada').mockResolvedValue({} as any);
    abrir(true);
    await chocarConCajaCerrada();
    expect(screen.getByTestId('aviso-caja-cerrada')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Motivo detallado/i), { target: { value: 'corto' } });
    const boton = screen.getByRole('button', { name: /Anular de todos modos \(caja cerrada\)/i });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo detallado/i), { target: { value: 'Cobro mal registrado ayer' } });
    fireEvent.click(boton);
    fireEvent.click(screen.getByRole('button', { name: /Sí, anular/i }));
    await waitFor(() => expect(cerrada).toHaveBeenCalledWith('7', 'Cobro mal registrado ayer'));
  });

  it('no ADMIN: solo ve que pida al administrador y no puede forzar', async () => {
    const cerrada = vi.spyOn(pedidosApi, 'anularCobroCajaCerrada').mockResolvedValue({} as any);
    abrir(false);
    await chocarConCajaCerrada();
    expect(screen.getByRole('alert')).toHaveTextContent(/Pide al administrador/);
    expect(screen.queryByTestId('aviso-caja-cerrada')).toBeNull();
    expect(screen.getByRole('button', { name: /Anular de todos modos/i })).toBeDisabled();
    expect(cerrada).not.toHaveBeenCalled();
  });
});
