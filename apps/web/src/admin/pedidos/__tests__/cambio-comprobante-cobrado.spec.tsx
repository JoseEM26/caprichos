import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { SeccionComprobantesPedido, estadoComprobante } from '../SeccionComprobantesPedido';
import { comprobantesApi } from '../../comprobantes/comprobantesApi';
import * as sesionModulo from '../../../comun/sesion';

let permisos: string[] = [];
beforeEach(() => {
  vi.restoreAllMocks();
  permisos = ['comprobantes/ver', 'comprobantes/anular'];
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ tiene: (p: string) => permisos.includes(p) } as any);
});

const fila = (extra: any = {}) => ({
  id: '7', pedido_id: '9', codigo_pedido: 'CP-9', tipo: 'BOLETA', serie: null, numero: null, numero_texto: null,
  documento: '12345678', razon_social: null, total: 30, fecha_lima: '12/11/2026 15:00', emision: 'POR_EMITIR',
  facturacion_estado: 'POR_EMITIR_NOCHE', anulado_en: null, anulado_motivo: null, tiene_xml: false, tiene_cdr: false,
  simulado: false, baja_estado: null, envio_whatsapp: null, ...extra,
});
const pedido = { id: '9', codigo: 'CP-9', pago_estado: 'PAGADO', comprobante_tipo: 'BOLETA' };

describe('Cambiar comprobante de un pedido cobrado', () => {
  it('muestra «Se emite esta noche» y el botón Cambiar comprobante', async () => {
    vi.spyOn(comprobantesApi, 'listarPorPedido').mockResolvedValue({ elementos: [fila()] as any, cambio_pendiente: null });
    render(<SeccionComprobantesPedido pedido={pedido} />);
    expect(await screen.findByText('Se emite esta noche')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cambiar comprobante' })).toBeTruthy();
    expect(estadoComprobante(fila() as any).texto).toBe('Se emite esta noche');
  });

  it('sin permiso de anular no hay botón', async () => {
    permisos = ['comprobantes/ver'];
    vi.spyOn(comprobantesApi, 'listarPorPedido').mockResolvedValue({ elementos: [fila()] as any, cambio_pendiente: null });
    render(<SeccionComprobantesPedido pedido={pedido} />);
    await screen.findByText('Se emite esta noche');
    expect(screen.queryByRole('button', { name: 'Cambiar comprobante' })).toBeNull();
  });

  it('pide el cambio con motivo tras confirmar con Sí y no emite en el momento', async () => {
    vi.spyOn(comprobantesApi, 'listarPorPedido').mockResolvedValue({ elementos: [fila()] as any, cambio_pendiente: null });
    const cambiar = vi.spyOn(comprobantesApi, 'cambiarComprobanteCobrado').mockResolvedValue(null);
    render(<SeccionComprobantesPedido pedido={pedido} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Cambiar comprobante' }));
    const dialogo = screen.getByRole('dialog', { name: 'Cambiar comprobante' });
    fireEvent.click(within(dialogo).getByTestId('comprobante-FACTURA'));
    fireEvent.change(within(dialogo).getByLabelText('DNI o RUC'), { target: { value: '20123456789' } });
    fireEvent.change(within(dialogo).getByLabelText('Razón social'), { target: { value: 'Empresa de Prueba SAC' } });
    const si = within(dialogo).getByRole('button', { name: 'Sí, cambiar' });
    expect((si as HTMLButtonElement).disabled).toBe(true); // falta el motivo
    fireEvent.change(within(dialogo).getByLabelText('Motivo del cambio'), { target: { value: 'Pidió factura' } });
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Sí, cambiar' }));
    await waitFor(() => expect(cambiar).toHaveBeenCalledWith('9', expect.objectContaining({ tipo: 'FACTURA', doc: '20123456789', motivo: 'Pidió factura' })));
  });

  it('con un cambio pendiente lo muestra y permite deshacerlo', async () => {
    vi.spyOn(comprobantesApi, 'listarPorPedido').mockResolvedValue({
      elementos: [fila()] as any,
      cambio_pendiente: { tipo: 'FACTURA', documento: '20123456789', razon_social: 'Empresa de Prueba SAC', motivo: 'Pidió factura', solicitado_en: '2026-11-12T20:00:00Z' },
    });
    const deshacer = vi.spyOn(comprobantesApi, 'deshacerCambioComprobante').mockResolvedValue({ ok: true });
    render(<SeccionComprobantesPedido pedido={pedido} />);
    expect((await screen.findByTestId('cambio-pendiente')).textContent).toContain('Cambiará a Factura RUC 20123456789 esta noche');
    fireEvent.click(screen.getByRole('button', { name: 'Deshacer cambio' }));
    await waitFor(() => expect(deshacer).toHaveBeenCalledWith('9'));
  });

  it('Aplicar ahora: Sí/No, llama a la API una vez y muestra el mensaje; sin permiso no aparece', async () => {
    const cambio = { tipo: 'FACTURA', documento: '20123456789', razon_social: 'X SAC', motivo: 'Pidió factura', solicitado_en: '2026-11-12' };
    vi.spyOn(comprobantesApi, 'listarPorPedido').mockResolvedValue({ elementos: [fila()] as any, cambio_pendiente: cambio as any });
    const ahora = vi.spyOn(comprobantesApi, 'aplicarCambioAhora').mockResolvedValue({ aplicado: true, baja: true, nuevo: { numero_texto: 'F002-000001', facturacion_estado: 'EMITIDO_SUNAT' }, mensaje: 'Listo: la boleta B002-000001 se dio de baja' });
    const { unmount } = render(<SeccionComprobantesPedido pedido={pedido} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Aplicar ahora' }));
    expect(ahora).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, aplicar' }));
    await waitFor(() => expect(ahora).toHaveBeenCalledTimes(1));
    expect(ahora).toHaveBeenCalledWith('9');
    expect(await screen.findByText(/se dio de baja/)).toBeTruthy();
    unmount();
    permisos = ['comprobantes/ver'];
    render(<SeccionComprobantesPedido pedido={pedido} />);
    await screen.findByText(/Cambiará a/);
    expect(screen.queryByRole('button', { name: 'Aplicar ahora' })).toBeNull();
  });
});
