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

const voucher = (semaforo: 'CONFIABLE' | 'ILEGIBLE', id = '21', operacion: string | null = '4455') => ({
  id,
  pedidoId: '77',
  archivoId: '900',
  origen: 'CARTA' as const,
  medio: 'YAPE' as const,
  semaforo,
  motivos: semaforo === 'CONFIABLE' ? [] : ['El monto no se distingue'],
  operacion,
  extraido: operacion ? { legible: true, monto: 35, operacion, fecha: null, hora: null, titular: null, destinoNumero: null, medioDetectado: 'YAPE' as const, confianza: 0.9 } : null,
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

  const siguiente = () => fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
  /** Paso 1 → 2 (Pago y comprobante) tras marcar que se habló con el cliente. */
  const irAlPaso2 = () => {
    marcarContacto();
    siguiente();
  };
  /** Paso 1 → 3 (Revisar y confirmar). */
  const irAlPaso3 = () => {
    irAlPaso2();
    siguiente();
  };

  /** Escribe el código de operación en el paso 3 (el campo vive ahí). */
  const escribirCodigo = (medio: string, valor: string) =>
    fireEvent.change(screen.getByTestId(`input-codigo-operacion-${medio}`), { target: { value: valor } });

  const confirmar = async () => {
    irAlPaso3();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, confirmar' }));
  };

  it('preselecciona el medio que eligió el cliente aunque llegue en mayúsculas (YAPE)', async () => {
    abrir(pedidoCarta());
    irAlPaso2();

    // Yape marcado: el botón lleva el fondo navy y se pide la foto de Yape
    expect(screen.getByRole('button', { name: 'Yape' }).style.background).toContain('var(--cp-navy');
    expect(screen.getByRole('button', { name: 'Plin' }).style.background).not.toContain('var(--cp-navy');
    expect(await screen.findByText('Foto del voucher (YAPE)')).toBeDefined();
  });

  it('digital sin voucher bloquea la confirmación y no registra el pago', async () => {
    abrir(pedidoCarta());
    irAlPaso3();
    escribirCodigo('YAPE', '123456');
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
    expect(pedidosApi.registrarPago).toHaveBeenCalledWith('77', 'YAPE', 'PAGADO', undefined, [
      { medio: 'YAPE', codigo: '4455' },
    ]);
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
      irAlPaso2();
      fireEvent.click(await screen.findByRole('button', { name: 'Confirmar sin comprobante' }));
    };
    /** Con la excepción llena en el paso 2, se pasa al 3 y se pulsa Confirmar. */
    const confirmarDesdePaso3 = () => {
      siguiente();
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }));
    };

    it('motivo corto bloquea la confirmación y no registra el pago', async () => {
      await abrirSinComprobante();
      fireEvent.change(screen.getByTestId('motivo-sin-voucher'), { target: { value: 'nop' } });
      fireEvent.change(screen.getByTestId('input-codigo-supervisor'), { target: { value: '123456' } });
      confirmarDesdePaso3();

      expect(screen.getByRole('alert').textContent).toMatch(/al menos 5 caracteres/);
      expect(screen.queryByRole('button', { name: 'Sí, confirmar' })).toBeNull();
      expect(pedidosApi.registrarPago).not.toHaveBeenCalled();
    });

    it('código de supervisor vacío bloquea la confirmación y no registra el pago', async () => {
      await abrirSinComprobante();
      fireEvent.change(screen.getByTestId('motivo-sin-voucher'), { target: { value: 'El cliente no tenía señal' } });
      confirmarDesdePaso3();

      expect(screen.getByRole('alert').textContent).toMatch(/6 dígitos/);
      expect(pedidosApi.registrarPago).not.toHaveBeenCalled();
    });

    it('motivo y código válidos llaman a registrarPago con sinVoucher', async () => {
      await abrirSinComprobante();
      fireEvent.change(screen.getByTestId('motivo-sin-voucher'), { target: { value: 'El cliente no tenía señal' } });
      fireEvent.change(screen.getByTestId('input-codigo-supervisor'), { target: { value: '123456' } });
      confirmarDesdePaso3();
      fireEvent.click(await screen.findByRole('button', { name: 'Sí, confirmar' }));

      await waitFor(() => expect(alConfirmarExitoso).toHaveBeenCalled());
      expect(pedidosApi.registrarPago).toHaveBeenCalledWith(
        '77',
        'YAPE',
        'PAGADO',
        { motivo: 'El cliente no tenía señal', pinSupervisor: '123456' },
        undefined, // en la excepción sin comprobante no hay código de operación
      );
    });
  });

  it('tiene tres pasos: Siguiente exige haber hablado con el cliente y Atrás conserva lo hecho', async () => {
    abrir(pedidoCarta());
    const pasos = screen.getByTestId('pasos-confirmar');
    expect(pasos.textContent).toMatch(/Cliente/);
    expect(pasos.textContent).toMatch(/Pago y comprobante/);
    expect(pasos.textContent).toMatch(/Revisar y confirmar/);

    siguiente();
    expect(screen.getByRole('alert').textContent).toMatch(/hablaste con el cliente/);
    expect(screen.queryByRole('button', { name: 'Confirmar y enviar a cocina' })).toBeNull();

    irAlPaso3();
    expect(screen.getByRole('button', { name: 'Confirmar y enviar a cocina' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByRole('button', { name: 'Yape' })).toBeDefined();
  });

  it('las capturas anteriores van plegadas en su propio apartado y la actual queda arriba', async () => {
    vi.mocked(vouchersApi.listarVouchers).mockResolvedValue([
      { ...voucher('CONFIABLE', '30'), creadoEn: '2026-10-28T10:00:00Z' },
      { ...voucher('ILEGIBLE', '29'), creadoEn: '2026-10-27T10:00:00Z' },
    ]);
    abrir(pedidoCarta());
    irAlPaso2();

    expect(await screen.findByText('Comprobantes del pedido (2)')).toBeDefined();
    const anteriores = screen.getByTestId('capturas-anteriores');
    expect(anteriores.textContent).toMatch(/Capturas anteriores \(1\)/);
    expect(anteriores.hasAttribute('open')).toBe(false);
  });

  it('efectivo no pide comprobante y confirma directo', async () => {
    abrir(pedidoCarta({ pago_preferido: 'EFECTIVO' }));

    expect(screen.queryByTestId('input-voucher-archivo')).toBeNull();
    await confirmar();
    await waitFor(() => expect(alConfirmarExitoso).toHaveBeenCalled());
    expect(pedidosApi.registrarPago).toHaveBeenCalledWith('77', 'EFECTIVO', 'COORDINADO', undefined, undefined);
  });

  describe('código de operación', () => {
    it('llega prellenado con la lectura de la IA, con la etiqueta y sin «(opcional)»', async () => {
      vi.mocked(vouchersApi.listarVouchers).mockResolvedValue([voucher('CONFIABLE', '21', '98765')]);
      abrir(pedidoCarta());
      irAlPaso3();

      const campo = await screen.findByTestId('input-codigo-operacion-YAPE');
      await waitFor(() => expect((campo as HTMLInputElement).value).toBe('98765'));
      expect(screen.getByTestId('codigo-leido-YAPE').textContent).toMatch(/Leído del voucher por la IA/);
      expect(screen.queryByText(/opcional/)).toBeNull();
    });

    it('sin lectura de la IA el campo va vacío, bloquea Confirmar y pide escribirlo', async () => {
      vi.mocked(vouchersApi.listarVouchers).mockResolvedValue([voucher('ILEGIBLE', '21', null)]);
      abrir(pedidoCarta());
      irAlPaso3();

      expect((await screen.findByTestId('input-codigo-operacion-YAPE') as HTMLInputElement).value).toBe('');
      expect(screen.getByText('Escribe el código de operación que ves en el voucher')).toBeDefined();
      const boton = screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }) as HTMLButtonElement;
      expect(boton.disabled).toBe(true);
      fireEvent.click(boton);
      expect(pedidosApi.registrarPago).not.toHaveBeenCalled();

      escribirCodigo('YAPE', '555111');
      expect((screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('si Caja corrige lo leído, queda la nota «Corregido manualmente» y se envía lo corregido', async () => {
      vi.mocked(vouchersApi.listarVouchers).mockResolvedValue([voucher('CONFIABLE', '21', '98765')]);
      abrir(pedidoCarta());
      irAlPaso3();
      await waitFor(() => expect((screen.getByTestId('input-codigo-operacion-YAPE') as HTMLInputElement).value).toBe('98765'));

      escribirCodigo('YAPE', '98766');
      expect(screen.getByTestId('codigo-corregido-YAPE').textContent).toMatch(/Corregido manualmente/);
      fireEvent.click(screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }));
      fireEvent.click(await screen.findByRole('button', { name: 'Sí, confirmar' }));
      await waitFor(() => expect(alConfirmarExitoso).toHaveBeenCalled());
      expect(pedidosApi.registrarPago).toHaveBeenCalledWith('77', 'YAPE', 'PAGADO', undefined, [
        { medio: 'YAPE', codigo: '98766' },
      ]);
    });

    it('efectivo no muestra el campo ni lo pide', async () => {
      abrir(pedidoCarta({ pago_preferido: 'EFECTIVO' }));
      irAlPaso3();

      expect(screen.queryByTestId('codigos-operacion')).toBeNull();
      expect(screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }).hasAttribute('disabled')).toBe(false);
    });

    it('tarjeta no pide código de operación (no lleva voucher en esta pantalla)', async () => {
      abrir(pedidoCarta({ pago_preferido: 'TARJETA' }));
      irAlPaso3();

      expect(screen.queryByTestId('input-codigo-operacion-TARJETA')).toBeNull();
      expect((screen.getByRole('button', { name: 'Confirmar y enviar a cocina' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('plan efectivo + Yape pide solo el código de Yape', async () => {
      abrir(
        pedidoCarta({
          pago_preferido: 'EFECTIVO',
          planPago: [
            { medio: 'EFECTIVO', monto: 10 },
            { medio: 'YAPE', monto: 25 },
          ],
        } as Partial<Pedido>),
      );
      irAlPaso3();

      expect(screen.getByTestId('input-codigo-operacion-YAPE')).toBeDefined();
      expect(screen.queryByTestId('input-codigo-operacion-EFECTIVO')).toBeNull();
      expect(screen.getAllByTestId(/^input-codigo-operacion-/)).toHaveLength(1);
    });
  });
});
