import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalCoordinarPago } from '../ModalCoordinarPago';
import { PedidoPorCobrar, pedidosApi } from '../pedidosApi';
import { vouchersApi } from '../../vouchers/vouchersApi';
import * as reducirModulo from '../../vouchers/reducirImagenVoucher';

// Pago coordinado de Caja: un medio digital exige la foto legible o la excepción con supervisor.

const pedidoYape: PedidoPorCobrar = {
  id: '20',
  codigo: 'CP-W020',
  canal: 'CARTA',
  modalidad: 'LLEVAR',
  estado: 'COLA',
  pago_estado: 'PENDIENTE',
  pago_preferido: 'YAPE',
  pago_metodo: null,
  total: 42,
  cliente_nombre: 'Lucia',
  cliente_telefono: null,
  comprobante_tipo: 'BOLETA',
  comprobante_doc: null,
  comprobante_razon: null,
  creado_en: '2026-10-27T18:00:00Z',
  minutosEspera: 5,
};

const lecturaLegible = {
  id: '31',
  legible: true,
  semaforo: 'CONFIABLE' as const,
  motivos: [],
  extraido: {
    legible: true,
    monto: 42,
    operacion: 'OP1',
    fecha: null,
    hora: null,
    titular: null,
    destinoNumero: null,
    medioDetectado: 'YAPE' as const,
    confianza: 0.95,
  },
};

const lecturaIlegible = { ...lecturaLegible, id: '32', legible: false, semaforo: 'ILEGIBLE' as const };

describe('ModalCoordinarPago', () => {
  let marcar: ReturnType<typeof vi.fn>;
  const alCoordinado = vi.fn();
  const alCerrar = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    alCoordinado.mockReset();
    alCerrar.mockReset();
    marcar = vi.fn().mockResolvedValue({ id: '20', pago_estado: 'COORDINADO' });
    vi.spyOn(pedidosApi, 'marcarPagoCoordinado').mockImplementation(marcar);
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (archivo) => archivo);
  });

  const subirFoto = () =>
    fireEvent.change(screen.getByTestId('input-voucher-archivo'), {
      target: { files: [new File(['foto'], 'yape.jpg', { type: 'image/jpeg' })] },
    });

  const confirmar = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Marcar coordinado' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, marcar' }));
  };

  it('medio digital sin foto: no deja marcar coordinado', () => {
    render(<ModalCoordinarPago pedido={pedidoYape} alCerrar={alCerrar} alCoordinado={alCoordinado} />);

    expect(screen.getByTestId('seccion-coordinar-comprobante').textContent).toMatch(/Comprobante del pago digital \(YAPE\)/);
    expect(screen.getByRole('button', { name: 'Marcar coordinado' })).toBeDisabled();
    expect(marcar).not.toHaveBeenCalled();
  });

  it('con foto legible: marca coordinado sin excepción', async () => {
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue(lecturaLegible as any);
    render(<ModalCoordinarPago pedido={pedidoYape} alCerrar={alCerrar} alCoordinado={alCoordinado} />);

    subirFoto();
    await screen.findByText('Foto guardada y enlazada al pedido.');
    expect(screen.getByRole('button', { name: 'Marcar coordinado' })).not.toBeDisabled();

    await confirmar();
    await waitFor(() => expect(alCoordinado).toHaveBeenCalled());
    expect(marcar).toHaveBeenCalledWith('20', undefined);
  });

  it('foto ILEGIBLE: no cuenta, pide otra foto o la excepción y no deja marcar', async () => {
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue(lecturaIlegible as any);
    render(<ModalCoordinarPago pedido={pedidoYape} alCerrar={alCerrar} alCoordinado={alCoordinado} />);

    subirFoto();
    expect(
      await screen.findByText('No se lee: sube otra foto o confirma sin comprobante con código del supervisor.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Marcar coordinado' })).toBeDisabled();
    expect(marcar).not.toHaveBeenCalled();
  });

  it('foto ILEGIBLE seguida de la excepción con motivo y supervisor: marca con sinVoucher', async () => {
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue(lecturaIlegible as any);
    render(<ModalCoordinarPago pedido={pedidoYape} alCerrar={alCerrar} alCoordinado={alCoordinado} />);

    subirFoto();
    await screen.findByText(/No se lee: sube otra foto/);

    fireEvent.click(screen.getByTestId('btn-coordinar-sin-voucher'));
    fireEvent.change(screen.getByLabelText(/Motivo/), { target: { value: 'El cliente no tiene la captura' } });
    const pin = document.querySelector('#codigo-supervisor-input') as HTMLInputElement;
    fireEvent.change(pin, { target: { value: '123456' } });
    expect(screen.getByRole('button', { name: 'Marcar coordinado' })).not.toBeDisabled();

    await confirmar();
    await waitFor(() => expect(alCoordinado).toHaveBeenCalled());
    expect(marcar).toHaveBeenCalledWith('20', {
      motivo: 'El cliente no tiene la captura',
      pinSupervisor: '123456',
    });
  });

  it('efectivo no pide comprobante y marca coordinado directo tras confirmar', async () => {
    render(
      <ModalCoordinarPago
        pedido={{ ...pedidoYape, pago_preferido: 'EFECTIVO' }}
        alCerrar={alCerrar}
        alCoordinado={alCoordinado}
      />,
    );

    expect(screen.queryByTestId('seccion-coordinar-comprobante')).toBeNull();
    expect(screen.getByRole('button', { name: 'Marcar coordinado' })).not.toBeDisabled();

    await confirmar();
    await waitFor(() => expect(alCoordinado).toHaveBeenCalled());
    expect(marcar).toHaveBeenCalledWith('20', undefined);
  });
});
