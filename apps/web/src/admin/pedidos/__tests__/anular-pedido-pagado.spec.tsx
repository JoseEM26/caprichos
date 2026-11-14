import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalAnular } from '../ModalAnular';
import { ModalRevertirAnulacion } from '../ModalRevertirAnulacion';
import { pedidosApi } from '../pedidosApi';
import { ErrorApi } from '../../../comun/api';

const pedido = (extra: object = {}): any => ({
  id: '10', codigo: 'CP-010', estado: 'LISTO', modalidad: 'DELIVERY', total: 40, pago_estado: 'PAGADO', cobro_vigente_id: null, lineas: [], ...extra,
});

function abrir(p: any, alExito = vi.fn()) {
  render(<ModalAnular pedidoId="10" codigoPedido="CP-010" pedido={p} alCerrar={vi.fn()} alAnularExitoso={alExito} />);
  fireEvent.change(screen.getByLabelText(/Motivo detallado/i), { target: { value: 'Cliente no recibió' } });
}
const confirmar = () => {
  fireEvent.click(screen.getByRole('button', { name: /Confirmar anulación/i }));
  fireEvent.click(screen.getByRole('button', { name: /Sí, anular/i }));
};

describe('Anular un pedido pagado: elegir qué pasa con el dinero', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('pagado: aparece la pregunta y no se puede confirmar sin elegir', () => {
    abrir(pedido());
    expect(screen.getByText('¿Qué pasa con el dinero?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirmar anulación/i })).toBeDisabled();
  });

  it('no pagado: sin pregunta y se anula como siempre', async () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    abrir(pedido({ pago_estado: 'PENDIENTE' }));
    expect(screen.queryByText('¿Qué pasa con el dinero?')).toBeNull();
    confirmar();
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith('10', 'ANULADO', 'Cliente no recibió'));
  });

  it('«Se devuelve al cliente» en efectivo: envía medio y monto (sin código)', async () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    abrir(pedido());
    fireEvent.click(screen.getByLabelText(/Se devuelve al cliente/i));
    expect(screen.getByRole('button', { name: /Confirmar anulación/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Medio de la devolución/i), { target: { value: 'EFECTIVO' } });
    expect(screen.queryByLabelText(/Código de operación/i)).toBeNull();
    confirmar();
    await waitFor(() =>
      expect(cambiar).toHaveBeenCalledWith('10', 'ANULADO', 'Cliente no recibió', undefined, undefined, undefined, {
        destinoDinero: 'DEVOLVER', devolucionMedio: 'EFECTIVO', devolucionMonto: 40,
      }),
    );
  });

  it('devolución por Yape exige el código de operación', async () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    abrir(pedido());
    fireEvent.click(screen.getByLabelText(/Se devuelve al cliente/i));
    fireEvent.change(screen.getByLabelText(/Medio de la devolución/i), { target: { value: 'YAPE' } });
    expect(screen.getByRole('button', { name: /Confirmar anulación/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Código de operación/i), { target: { value: 'OP-77' } });
    confirmar();
    await waitFor(() =>
      expect(cambiar).toHaveBeenCalledWith('10', 'ANULADO', 'Cliente no recibió', undefined, undefined, undefined, {
        destinoDinero: 'DEVOLVER', devolucionMedio: 'YAPE', devolucionMonto: 40, devolucionCodigo: 'OP-77',
      }),
    );
  });

  it('«Se reprograma el pedido» envía REPROGRAMAR y el aviso dice que no se anula', async () => {
    const cambiar = vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as any);
    abrir(pedido());
    fireEvent.click(screen.getByLabelText(/Se reprograma el pedido/i));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar anulación/i }));
    expect(screen.getByText(/¿Reprogramar el pedido CP-010\? \(no se anula\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Sí, anular/i }));
    await waitFor(() =>
      expect(cambiar).toHaveBeenCalledWith('10', 'ANULADO', 'Cliente no recibió', undefined, undefined, undefined, { destinoDinero: 'REPROGRAMAR' }),
    );
  });

  it('un pedido que no es delivery no ofrece reprogramar', () => {
    abrir(pedido({ modalidad: 'MESA' }));
    expect(screen.queryByLabelText(/Se reprograma el pedido/i)).toBeNull();
  });

  it('si el modal no sabía que estaba pagado y el servidor lo pide (400), muestra la pregunta', async () => {
    vi.spyOn(pedidosApi, 'cambiarEstado').mockRejectedValue(new ErrorApi('DESTINO_DINERO_REQUERIDO', 'elige', 400));
    abrir(pedido({ pago_estado: 'PENDIENTE' }));
    confirmar();
    expect(await screen.findByText('¿Qué pasa con el dinero?')).toBeInTheDocument();
  });
});

describe('Revertir un pedido anulado', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('exige motivo y avisa el resultado (cobro a registrar de nuevo)', async () => {
    const revertir = vi.spyOn(pedidosApi, 'revertirAnulacion').mockResolvedValue({ id: '10', codigo: 'CP-010', estado: 'LISTO', cobroReactivado: false, avisoCobro: 'La caja del cobro ya cerró: registra el cobro de nuevo.', pendientes: [] });
    const alExito = vi.fn();
    render(<ModalRevertirAnulacion pedido={pedido({ estado: 'ANULADO' })} alCerrar={vi.fn()} alExito={alExito} />);
    const boton = screen.getByRole('button', { name: /Sí, revertir/i });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: 'Sí se entregó' } });
    fireEvent.click(boton);
    await waitFor(() => expect(revertir).toHaveBeenCalledWith('10', 'Sí se entregó'));
    expect(alExito).toHaveBeenCalledWith(expect.objectContaining({ estado: 'LISTO', cobroReactivado: false }));
  });

  it('muestra el error del servidor (403 para quien no es ADMIN ni SUPERVISOR)', async () => {
    vi.spyOn(pedidosApi, 'revertirAnulacion').mockRejectedValue(new ErrorApi('SIN_PERMISO', 'Solo el administrador o el supervisor pueden revertir una anulación', 403));
    render(<ModalRevertirAnulacion pedido={pedido({ estado: 'ANULADO' })} alCerrar={vi.fn()} alExito={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Motivo/i), { target: { value: 'Sí se entregó' } });
    fireEvent.click(screen.getByRole('button', { name: /Sí, revertir/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/supervisor/);
  });
});
