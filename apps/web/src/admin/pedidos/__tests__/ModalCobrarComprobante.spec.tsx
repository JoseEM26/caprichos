import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalCobrar } from '../ModalCobrar';
import { Pedido } from '../pedidosApi';
import { vouchersApi } from '../../vouchers/vouchersApi';
import * as reducirModulo from '../../vouchers/reducirImagenVoucher';

// Caja: el cobro digital (Yape, Plin, transferencia) exige la foto del comprobante.
// La IA solo informa; la excepción «sin voucher» pide motivo y código del supervisor.

const pedido: Pedido = {
  id: '77',
  codigo: 'CP-077',
  canal: 'CARTA',
  modalidad: 'DELIVERY',
  estado: 'COLA',
  pago_estado: 'PENDIENTE',
  total: '35.00',
  subtotal: '35.00',
  descuento: '0',
  creado_en: '2026-10-27T18:00:00Z',
};

// El servidor marca legible=false cuando el semáforo es ILEGIBLE (un ILEGIBLE no cuenta como comprobante)
const lecturaIlegible = {
  id: '9',
  legible: false,
  semaforo: 'ILEGIBLE' as const,
  motivos: ['El monto no se distingue'],
  extraido: {
    legible: true,
    monto: null,
    operacion: null,
    fecha: null,
    hora: null,
    titular: null,
    destinoNumero: null,
    medioDetectado: 'YAPE' as const,
    confianza: 0.4,
  },
};

describe('ModalCobrar: comprobante del pago digital', () => {
  let cobrar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    cobrar = vi.fn().mockResolvedValue({});
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (archivo) => archivo);
  });

  const abrirYape = () => {
    render(<ModalCobrar pedido={pedido} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={cobrar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Yape' }));
  };

  const confirmarCobro = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Registrar cobro' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Cobrar$/ }));
  };

  it('efectivo no pide foto y se puede cobrar', () => {
    render(<ModalCobrar pedido={pedido} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={cobrar} />);
    expect(screen.queryByTestId('seccion-comprobante-cobro')).toBeNull();
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).not.toBeDisabled();
  });

  it('Yape sin foto: pide la foto y no deja registrar el cobro', () => {
    abrirYape();

    expect(screen.getByTestId('seccion-comprobante-cobro').textContent).toMatch(/Comprobante del pago digital \(YAPE\)/);
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeDisabled();
    expect(cobrar).not.toHaveBeenCalled();
  });

  it('con foto legible: la guarda, muestra la lectura y cobra con voucherId', async () => {
    const legible = { ...lecturaIlegible, legible: true, semaforo: 'CONFIABLE' as const, motivos: [] };
    const subir = vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue(legible as any);
    abrirYape();

    const input = screen.getByTestId('input-voucher-archivo');
    fireEvent.change(input, { target: { files: [new File(['foto'], 'yape.jpg', { type: 'image/jpeg' })] } });

    await waitFor(() => {
      expect(screen.getByTestId('voucher-guardado')).toBeDefined();
    });
    expect(subir).toHaveBeenCalledWith(expect.anything(), '77', 'YAPE');
    expect(screen.getByTestId('tarjeta-lectura-voucher')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).not.toBeDisabled();

    await confirmarCobro();
    await waitFor(() => {
      expect(cobrar).toHaveBeenCalledWith(expect.objectContaining({ pedidoId: '77', voucherId: '9' }));
    });
    expect(cobrar.mock.calls[0][0]).not.toHaveProperty('sinVoucher');
  });

  it('la foto que ya subió el mozo: Caja la ve y cobra con ese voucher, sin subir otra', async () => {
    const yaSubido = {
      id: '55',
      pedidoId: '77',
      archivoId: '901',
      origen: 'MOZO',
      medio: 'YAPE',
      semaforo: 'CONFIABLE',
      motivos: [],
      extraido: lecturaIlegible.extraido,
      creadoEn: '2026-10-28T12:00:00.000Z',
    };
    const listar = vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([yaSubido] as any);
    const subir = vi.spyOn(vouchersApi, 'subirVoucher');
    render(<ModalCobrar pedido={pedido} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={cobrar} />);

    await waitFor(() => {
      expect(listar).toHaveBeenCalledWith({ pedidoId: '77', estado: 'todos' });
    });
    fireEvent.click(screen.getByRole('button', { name: 'Yape' }));

    expect(screen.getByTestId('voucher-guardado')).toBeDefined();
    expect(screen.getByTestId('tarjeta-lectura-voucher')).toBeDefined();
    expect(screen.queryByTestId('seccion-subir-voucher-mozo')).toBeNull();
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).not.toBeDisabled();

    await confirmarCobro();
    await waitFor(() => {
      expect(cobrar).toHaveBeenCalledWith(expect.objectContaining({ pedidoId: '77', voucherId: '55' }));
    });
    expect(subir).not.toHaveBeenCalled();
  });

  it('solo hay una foto ilegible del mozo: no se usa como comprobante y Caja debe subir otra', async () => {
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([
      {
        id: '56',
        archivoId: '902',
        medio: 'YAPE',
        semaforo: 'ILEGIBLE',
        motivos: [],
        extraido: lecturaIlegible.extraido,
        creadoEn: '2026-10-28T12:00:00.000Z',
      },
    ] as any);
    render(<ModalCobrar pedido={pedido} alCerrar={vi.fn()} alCobrarExitoso={vi.fn()} cobrar={cobrar} />);
    await waitFor(() => expect(vouchersApi.listarVouchers).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: 'Yape' }));

    expect(screen.queryByTestId('voucher-guardado')).toBeNull();
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeDisabled();
  });

  it('con foto ILEGIBLE: no cuenta como comprobante, pide otra foto o la excepción y no deja cobrar', async () => {
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue(lecturaIlegible as any);
    abrirYape();

    const input = screen.getByTestId('input-voucher-archivo');
    fireEvent.change(input, { target: { files: [new File(['foto'], 'yape.jpg', { type: 'image/jpeg' })] } });

    expect(
      await screen.findByText('No se lee o no hay foto: sube otra foto o pide el código al supervisor.'),
    ).toBeDefined();
    expect(screen.queryByTestId('voucher-guardado')).toBeNull();
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeDisabled();
    expect(cobrar).not.toHaveBeenCalled();
  });

  it('con foto ILEGIBLE y luego la excepción con supervisor: cobra con sinVoucher y sin voucherId', async () => {
    vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue(lecturaIlegible as any);
    abrirYape();

    fireEvent.change(screen.getByTestId('input-voucher-archivo'), {
      target: { files: [new File(['foto'], 'yape.jpg', { type: 'image/jpeg' })] },
    });
    await screen.findByText(/No se lee o no hay foto: sube otra foto/);

    fireEvent.click(screen.getByTestId('btn-sin-voucher'));
    fireEvent.change(screen.getByTestId('motivo-sin-voucher'), { target: { value: 'La foto salió borrosa' } });
    const pin = document.querySelector('#codigo-supervisor-input') as HTMLInputElement;
    fireEvent.change(pin, { target: { value: '123456' } });
    await confirmarCobro();

    await waitFor(() => {
      expect(cobrar).toHaveBeenCalledWith({
        pedidoId: '77',
        pagos: [{ medio: 'YAPE', monto: 35 }],
        sinVoucher: { motivo: 'La foto salió borrosa', pinSupervisor: '123456' },
      });
    });
    expect(cobrar.mock.calls[0][0]).not.toHaveProperty('voucherId');
  });

  it('sin foto con motivo y código del supervisor: cobra con sinVoucher y sin voucherId', async () => {
    abrirYape();

    fireEvent.click(screen.getByTestId('btn-sin-voucher'));
    fireEvent.change(screen.getByTestId('motivo-sin-voucher'), {
      target: { value: 'El POS del local no funcionaba' },
    });
    const pin = document.querySelector('#codigo-supervisor-input') as HTMLInputElement;
    fireEvent.change(pin, { target: { value: '123456' } });

    expect(screen.getByRole('button', { name: 'Registrar cobro' })).not.toBeDisabled();
    await confirmarCobro();

    await waitFor(() => {
      expect(cobrar).toHaveBeenCalledWith({
        pedidoId: '77',
        pagos: [{ medio: 'YAPE', monto: 35 }],
        sinVoucher: { motivo: 'El POS del local no funcionaba', pinSupervisor: '123456' },
      });
    });
    expect(cobrar.mock.calls[0][0]).not.toHaveProperty('voucherId');
  });

  it('motivo demasiado corto o PIN incompleto no habilitan el cobro sin foto', () => {
    abrirYape();
    fireEvent.click(screen.getByTestId('btn-sin-voucher'));

    fireEvent.change(screen.getByTestId('motivo-sin-voucher'), { target: { value: 'abc' } });
    const pin = document.querySelector('#codigo-supervisor-input') as HTMLInputElement;
    fireEvent.change(pin, { target: { value: '123456' } });
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeDisabled();

    fireEvent.change(screen.getByTestId('motivo-sin-voucher'), { target: { value: 'Motivo suficiente' } });
    fireEvent.change(pin, { target: { value: '12345' } });
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeDisabled();
  });

  it('código de supervisor incorrecto: el servidor rechaza y Caja ve el motivo, sin cobrar', async () => {
    cobrar.mockRejectedValueOnce(new Error('Código de supervisor inválido o no proporcionado'));
    abrirYape();

    fireEvent.click(screen.getByTestId('btn-sin-voucher'));
    fireEvent.change(screen.getByTestId('motivo-sin-voucher'), { target: { value: 'Motivo suficiente' } });
    const pin = document.querySelector('#codigo-supervisor-input') as HTMLInputElement;
    fireEvent.change(pin, { target: { value: '000000' } });
    await confirmarCobro();

    expect(await screen.findByRole('alert')).toHaveTextContent('Código de supervisor inválido');
  });

  it('volver a pedir la foto oculta la excepción y vuelve a exigir el comprobante', () => {
    abrirYape();
    fireEvent.click(screen.getByTestId('btn-sin-voucher'));
    fireEvent.click(screen.getByRole('button', { name: 'Volver a pedir la foto' }));

    expect(screen.getByTestId('input-voucher-archivo')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Registrar cobro' })).toBeDisabled();
  });
});
