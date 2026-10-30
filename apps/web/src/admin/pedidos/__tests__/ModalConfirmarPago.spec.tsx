import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModalConfirmarPago } from '../ModalConfirmarPago';
import { pedidosApi, Pedido } from '../pedidosApi';
import { vouchersApi } from '../../vouchers/vouchersApi';
import * as reducirModulo from '../../vouchers/reducirImagenVoucher';
import * as apiModulo from '../../../comun/api';

// Ventana «Confirmar CP-xxx» de caja: el medio del cliente aparece marcado, el comprobante
// digital se sube como voucher del pedido (misma API que el cobro) y la IA solo informa.

const pedidoCarta = (extra: Partial<Pedido> = {}): Pedido => ({
  id: '77',
  codigo: 'CP-077',
  canal: 'CARTA',
  modalidad: 'RECOGER',
  estado: 'NUEVO',
  pago_estado: 'PENDIENTE',
  // La carta guarda el medio elegido en MAYÚSCULAS
  pago_metodo: null,
  pago_preferido: 'YAPE',
  total: '35.00',
  subtotal: '35.00',
  descuento: '0',
  creado_en: '2026-10-27T18:00:00Z',
  ...extra,
});

const voucher = (semaforo: 'CONFIABLE' | 'ILEGIBLE', id = '21') => ({
  id,
  pedidoId: '77',
  archivoId: '900',
  origen: 'CARTA' as const,
  medio: 'YAPE' as const,
  semaforo,
  motivos: semaforo === 'CONFIABLE' ? [] : ['El monto no se distingue'],
  extraido: null,
  creadoEn: '2026-10-27T18:00:00Z',
});

describe('ModalConfirmarPago', () => {
  let alConfirmarExitoso: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    alConfirmarExitoso = vi.fn();
    vi.spyOn(reducirModulo, 'reducirImagenVoucher').mockImplementation(async (archivo) => archivo);
    vi.spyOn(apiModulo, 'obtenerBlobAutenticado').mockResolvedValue('blob:foto');
    vi.spyOn(pedidosApi, 'registrarPago').mockResolvedValue({} as Pedido);
    vi.spyOn(pedidosApi, 'cambiarEstado').mockResolvedValue({} as Pedido);
    vi.spyOn(vouchersApi, 'listarVouchers').mockResolvedValue([]);
  });

  const abrir = (pedido: Pedido) =>
    render(
      <ModalConfirmarPago pedido={pedido} alCerrar={vi.fn()} alConfirmarExitoso={alConfirmarExitoso} />,
    );

  const marcarContacto = () =>
    fireEvent.click(screen.getByRole('checkbox', { name: /Ya hablé con el cliente/ }));

  const confirmar = async () => {
    marcarContacto();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, confirmar' }));
  };

  it('preselecciona el medio que eligió el cliente aunque llegue en mayúsculas (YAPE)', async () => {
    abrir(pedidoCarta());

    // Yape marcado: el botón lleva el fondo navy y se pide la foto de Yape
    expect(screen.getByRole('button', { name: 'Yape' }).style.background).toContain('var(--cp-navy');
    expect(screen.getByRole('button', { name: 'Plin' }).style.background).not.toContain('var(--cp-navy');
    expect(await screen.findByText('Foto del voucher (YAPE)')).toBeDefined();
  });

  it('digital sin voucher bloquea la confirmación y no registra el pago', async () => {
    abrir(pedidoCarta());
    marcarContacto();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }));

    expect(screen.getByRole('alert').textContent).toMatch(/Sube el comprobante del pago/);
    expect(screen.queryByRole('button', { name: 'Sí, confirmar' })).toBeNull();
    expect(pedidosApi.registrarPago).not.toHaveBeenCalled();
  });

  it('la foto se sube por la API de vouchers (pedido y medio) y luego muestra el semáforo', async () => {
    const subir = vi.spyOn(vouchersApi, 'subirVoucher').mockResolvedValue({
      id: '21',
      legible: true,
      semaforo: 'OBSERVADO',
      motivos: ['El destino no coincide'],
      extraido: {
        legible: true,
        monto: 35,
        operacion: '123',
        fecha: null,
        hora: null,
        titular: null,
        destinoNumero: null,
        medioDetectado: 'YAPE',
        confianza: 0.9,
      },
    } as any);
    // Antes de subir no hay vouchers; tras subir, el listado ya trae la foto con su semáforo
    vi.mocked(vouchersApi.listarVouchers)
      .mockResolvedValueOnce([])
      .mockResolvedValue([voucher('CONFIABLE')]);

    abrir(pedidoCarta());
    const input = await screen.findByTestId('input-voucher-archivo');
    fireEvent.change(input, { target: { files: [new File(['foto'], 'yape.jpg', { type: 'image/jpeg' })] } });

    await waitFor(() => expect(screen.getByTestId('tarjeta-lectura-voucher')).toBeDefined());
    expect(subir).toHaveBeenCalledWith(expect.anything(), '77', 'YAPE');
    expect(screen.getByTestId('badge-semaforo-voucher').textContent).toMatch(/Confiable/);
    expect(screen.getByTestId('voucher-listo-confirmar')).toBeDefined();
  });

  it('un voucher previo del pedido (carta o WhatsApp) evita pedir otra foto y se puede confirmar', async () => {
    vi.mocked(vouchersApi.listarVouchers).mockResolvedValue([voucher('CONFIABLE')]);
    abrir(pedidoCarta());

    expect(await screen.findByTestId('seccion-vouchers-pedido')).toBeDefined();
    expect(screen.getByTestId('tarjeta-lectura-voucher')).toBeDefined();
    expect(screen.queryByTestId('input-voucher-archivo')).toBeNull();

    await confirmar();
    await waitFor(() => expect(alConfirmarExitoso).toHaveBeenCalled());
    expect(pedidosApi.registrarPago).toHaveBeenCalledWith('77', 'YAPE', 'PAGADO', undefined);
    expect(pedidosApi.cambiarEstado).toHaveBeenCalledWith('77', 'COLA', expect.any(String));
  });

  it('un voucher solo ILEGIBLE no cuenta como comprobante: vuelve a pedir la foto', async () => {
    vi.mocked(vouchersApi.listarVouchers).mockResolvedValue([voucher('ILEGIBLE')]);
    abrir(pedidoCarta());

    expect(await screen.findByTestId('input-voucher-archivo')).toBeDefined();
    expect(screen.queryByTestId('voucher-listo-confirmar')).toBeNull();
  });

  describe('confirmar sin comprobante (excepción con supervisor)', () => {
    const abrirSinComprobante = async () => {
      abrir(pedidoCarta());
      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar sin comprobante' }));
      marcarContacto();
    };

    it('motivo corto bloquea la confirmación y no registra el pago', async () => {
      await abrirSinComprobante();
      fireEvent.change(screen.getByTestId('motivo-sin-voucher'), { target: { value: 'nop' } });
      fireEvent.change(screen.getByTestId('input-codigo-supervisor'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }));

      expect(screen.getByRole('alert').textContent).toMatch(/al menos 5 caracteres/);
      expect(screen.queryByRole('button', { name: 'Sí, confirmar' })).toBeNull();
      expect(pedidosApi.registrarPago).not.toHaveBeenCalled();
    });

    it('código de supervisor vacío bloquea la confirmación y no registra el pago', async () => {
      await abrirSinComprobante();
      fireEvent.change(screen.getByTestId('motivo-sin-voucher'), { target: { value: 'El cliente no tenía señal' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }));

      expect(screen.getByRole('alert').textContent).toMatch(/6 dígitos/);
      expect(pedidosApi.registrarPago).not.toHaveBeenCalled();
    });

    it('motivo y código válidos llaman a registrarPago con sinVoucher', async () => {
      await abrirSinComprobante();
      fireEvent.change(screen.getByTestId('motivo-sin-voucher'), { target: { value: 'El cliente no tenía señal' } });
      fireEvent.change(screen.getByTestId('input-codigo-supervisor'), { target: { value: '123456' } });
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Sí, confirmar' }));

      await waitFor(() => expect(alConfirmarExitoso).toHaveBeenCalled());
      expect(pedidosApi.registrarPago).toHaveBeenCalledWith('77', 'YAPE', 'PAGADO', {
        motivo: 'El cliente no tenía señal',
        pinSupervisor: '123456',
      });
    });
  });

  it('efectivo no pide comprobante y confirma directo', async () => {
    abrir(pedidoCarta({ pago_preferido: 'EFECTIVO' }));

    expect(screen.queryByTestId('input-voucher-archivo')).toBeNull();
    await confirmar();
    await waitFor(() => expect(alConfirmarExitoso).toHaveBeenCalled());
    expect(pedidosApi.registrarPago).toHaveBeenCalledWith('77', 'EFECTIVO', 'COORDINADO', undefined);
  });
});
