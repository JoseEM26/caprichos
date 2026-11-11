import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import * as sesionModulo from '../../../comun/sesion';
import { comprobantesApi } from '../comprobantesApi';
import { EnvioWhatsappFactura, etiquetaEnvio } from '../EnvioWhatsappFactura';
import { ElectronicosTab } from '../ElectronicosTab';
import { SeccionComprobantesPedido } from '../../pedidos/SeccionComprobantesPedido';

const factura = (extra: any = {}) => ({
  id: '10',
  pedido_id: '100',
  codigo_pedido: 'P-100',
  tipo: 'FACTURA',
  serie: 'F002',
  numero: 123,
  numero_texto: 'F002-000123',
  documento: '20601234567',
  razon_social: 'Inversiones de Prueba S.A.C.',
  total: 42,
  fecha_lima: '11/11/2026 10:00',
  emision: 'EMITIDO',
  facturacion_estado: 'EMITIDO_SUNAT',
  facturacion_intentos: 1,
  enlace_pdf: null,
  cadena_qr: null,
  hash: null,
  respuesta_sunat: null,
  simulado: false,
  baja_estado: null,
  baja_motivo: null,
  baja_en: null,
  emisor: 'SUNAT',
  envio_whatsapp: null,
  ...extra,
});
const envio = (estado: string, extra: any = {}) => ({ estado, via: null, enviado_en: null, intentos: 1, detalle: null, ...extra });

beforeEach(() => {
  vi.restoreAllMocks();
});

describe('etiquetaEnvio', () => {
  it('una etiqueta por estado', () => {
    expect(etiquetaEnvio(null)).toBeNull();
    expect(etiquetaEnvio(envio('ENVIADO', { enviado_en: '2026-11-11T19:05:00Z' }) as any)?.texto).toMatch(/^Enviada por WhatsApp · 11\/11, 14:05$|^Enviada por WhatsApp · 11\/11 14:05$/);
    expect(etiquetaEnvio(envio('SIN_CELULAR') as any)?.texto).toBe('Sin celular');
    expect(etiquetaEnvio(envio('SIN_VENTANA') as any)?.texto).toBe('Sin ventana de WhatsApp');
    expect(etiquetaEnvio(envio('ERROR') as any)?.texto).toBe('Error al enviar');
    expect(etiquetaEnvio(envio('APAGADO') as any)?.texto).toBe('Apagado');
  });
});

describe('EnvioWhatsappFactura', () => {
  it('muestra la etiqueta y «Reenviar por WhatsApp» pide Sí/No antes de enviar', async () => {
    const reenviar = vi.spyOn(comprobantesApi, 'reenviarFacturaWhatsapp').mockResolvedValue({ estado: 'ENVIADO', via: 'DOCUMENTO' });
    const alCambiar = vi.fn();
    render(<EnvioWhatsappFactura comprobante={factura({ envio_whatsapp: envio('SIN_VENTANA') }) as any} puedeReenviar alCambiar={alCambiar} />);
    expect(screen.getByText('Sin ventana de WhatsApp')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Reenviar por WhatsApp F002-000123/ }));
    expect(reenviar).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'No' }));
    expect(reenviar).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Reenviar por WhatsApp F002-000123/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, reenviar' }));
    await waitFor(() => expect(reenviar).toHaveBeenCalledWith('10'));
    await waitFor(() => expect(alCambiar).toHaveBeenCalled());
  });

  it('sin permiso no hay botón (pero sí la etiqueta); boleta, simulada y anulada no muestran nada', () => {
    const { rerender, container } = render(<EnvioWhatsappFactura comprobante={factura({ envio_whatsapp: envio('ENVIADO') }) as any} puedeReenviar={false} />);
    expect(screen.queryByRole('button', { name: /Reenviar por WhatsApp/ })).toBeNull();
    expect(screen.getByText(/Enviada por WhatsApp/)).toBeTruthy();
    for (const extra of [{ tipo: 'BOLETA' }, { simulado: true }, { anulado_en: '2026-11-11' }, { facturacion_estado: 'RECHAZADO' }]) {
      rerender(<EnvioWhatsappFactura comprobante={factura(extra) as any} puedeReenviar />);
      expect(container.textContent).toBe('');
    }
  });

  it('un error al reenviar se muestra y no rompe la pantalla', async () => {
    vi.spyOn(comprobantesApi, 'reenviarFacturaWhatsapp').mockRejectedValue(new Error('El envío de facturas por WhatsApp está apagado en Configuración'));
    render(<EnvioWhatsappFactura comprobante={factura() as any} puedeReenviar />);
    fireEvent.click(screen.getByRole('button', { name: /Reenviar por WhatsApp/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, reenviar' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/apagado/);
  });
});

describe('Electrónicos SUNAT: factura por WhatsApp', () => {
  beforeEach(() => {
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { partyId: '1', nombres: 'Test', rol: 'ADMIN' }, permisos: [], tiene: vi.fn().mockReturnValue(true) } as any);
    vi.spyOn(comprobantesApi, 'obtenerFacturacion').mockResolvedValue({ igvPct: 10.5, serieBoleta: 'B002', serieFactura: 'F002', proveedor: 'SUNAT', proveedor_efectivo: 'SUNAT', sunat: { ambiente: 'beta', credenciales: true, vence_certificado: null } } as any);
    vi.spyOn(comprobantesApi, 'obtenerBoletaPorDefecto').mockResolvedValue({ activo: true, aplica: true, proveedor_efectivo: 'SUNAT' });
    vi.spyOn(comprobantesApi, 'saludFacturacion').mockResolvedValue(null as any);
    vi.spyOn(comprobantesApi, 'listarProblemasElectronicos').mockResolvedValue({ total: 0, pagina: 1, limite: 50, totalPaginas: 1, elementos: [] } as any);
    vi.spyOn(comprobantesApi, 'listarElectronicos').mockResolvedValue({
      total: 2,
      pagina: 1,
      limite: 20,
      totalPaginas: 1,
      elementos: [factura({ envio_whatsapp: envio('ENVIADO', { enviado_en: '2026-11-11T19:05:00Z' }) }), factura({ id: '11', tipo: 'BOLETA', numero_texto: 'B002-000009', facturacion_estado: 'PENDIENTE_RESUMEN' })],
    } as any);
  });

  it('la factura muestra su etiqueta y la boleta no', async () => {
    vi.spyOn(comprobantesApi, 'obtenerFacturaWhatsapp').mockResolvedValue({ activo: true, plantilla: '' });
    render(<ElectronicosTab />);
    const tarjeta = await screen.findByTestId('electronico-10');
    expect(within(tarjeta).getByText(/Enviada por WhatsApp/)).toBeTruthy();
    expect(within(tarjeta).getByRole('button', { name: /Reenviar por WhatsApp/ })).toBeTruthy();
    expect(within(screen.getByTestId('electronico-11')).queryByText(/WhatsApp/)).toBeNull();
  });

  it('el ADMIN apaga el envío con Sí/No y se guarda con confirmación', async () => {
    vi.spyOn(comprobantesApi, 'obtenerFacturaWhatsapp').mockResolvedValue({ activo: true, plantilla: 'caprichos_factura_electronica' });
    const guardar = vi.spyOn(comprobantesApi, 'guardarFacturaWhatsapp').mockResolvedValue({ activo: false, plantilla: 'caprichos_factura_electronica' });
    render(<ElectronicosTab />);
    const seccion = await screen.findByRole('region', { name: 'Factura por WhatsApp' });
    expect(within(seccion).getByRole('button', { name: 'Sí' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(within(seccion).getByRole('button', { name: 'No' }));
    expect(guardar).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, guardar' }));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith({ activo: false, plantilla: 'caprichos_factura_electronica' }));
  });
});

describe('Detalle del pedido: factura por WhatsApp', () => {
  it('la tarjeta de la factura muestra la etiqueta y el botón con permiso; sin permiso, solo la etiqueta', async () => {
    vi.spyOn(comprobantesApi, 'listarPorPedido').mockResolvedValue({
      elementos: [{ ...factura({ envio_whatsapp: envio('SIN_CELULAR') }), anulado_en: null, anulado_motivo: null, tiene_xml: true, tiene_cdr: true }],
    } as any);
    const tiene = vi.fn().mockReturnValue(true);
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { partyId: '1', nombres: 'Test', rol: 'CAJERO' }, permisos: [], tiene } as any);
    const { unmount } = render(<SeccionComprobantesPedido pedido={{ id: '100', pago_estado: 'PAGADO' }} />);
    const tarjeta = await screen.findByTestId('comprobante-F002-000123');
    expect(within(tarjeta).getByText('Sin celular')).toBeTruthy();
    expect(within(tarjeta).getByRole('button', { name: /Reenviar por WhatsApp/ })).toBeTruthy();
    unmount();

    tiene.mockImplementation((p: string) => p === 'comprobantes/ver');
    render(<SeccionComprobantesPedido pedido={{ id: '100', pago_estado: 'PAGADO' }} />);
    const sin = await screen.findByTestId('comprobante-F002-000123');
    expect(within(sin).getByText('Sin celular')).toBeTruthy();
    expect(within(sin).queryByRole('button', { name: /Reenviar por WhatsApp/ })).toBeNull();
  });
});
