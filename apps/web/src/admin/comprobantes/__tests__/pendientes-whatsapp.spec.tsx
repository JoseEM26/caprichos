import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import * as sesionModulo from '../../../comun/sesion';
import { comprobantesApi } from '../comprobantesApi';
import { ElectronicosTab } from '../ElectronicosTab';
import { urlWhatsappManual } from '../utilidades';

const fila = (extra: any = {}) => ({
  id: '10',
  pedido_id: '100',
  codigo_pedido: 'P-100',
  tipo: 'BOLETA',
  serie: 'B002',
  numero: 1,
  numero_texto: 'B002-000001',
  documento: null,
  razon_social: null,
  total: 42.5,
  fecha_lima: '14/11/2026 10:00',
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
  celular_wa: '51987654321',
  enlace_pdf_publico: 'https://caprichos.pe/carta/comprobante/10/abc',
  envio_whatsapp: null,
  ...extra,
});

const contadores = { todos: 5, faltan: 2, aceptados: 3, sin_whatsapp: 1, pendientes_resumen: 4 };

function sesion(usuario: any) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario, permisos: [], tiene: vi.fn().mockReturnValue(false) } as any);
}

describe('urlWhatsappManual', () => {
  it('arma wa.me con el celular normalizado, el total y el enlace al PDF', () => {
    const url = urlWhatsappManual('51987654321', { tipo: 'BOLETA', numero_texto: 'B002-000001', total: 42.5 }, 'https://caprichos.pe/carta/comprobante/10/abc')!;
    expect(url.startsWith('https://wa.me/51987654321?text=')).toBe(true);
    const texto = decodeURIComponent(url.split('text=')[1]);
    expect(texto).toContain('Gracias por tu compra en Caprichos 💛');
    expect(texto).toContain('boleta electrónica B002-000001');
    expect(texto).toContain('42.50');
    expect(texto).toContain('https://caprichos.pe/carta/comprobante/10/abc');
  });
  it('sin celular válido no hay enlace', () => {
    expect(urlWhatsappManual(null, { tipo: 'BOLETA', numero_texto: 'B', total: 1 }, null)).toBeNull();
    expect(urlWhatsappManual('12345', { tipo: 'BOLETA', numero_texto: 'B', total: 1 }, null)).toBeNull();
  });
});

describe('Electrónicos: faltan emitir, WhatsApp a mano y Emitir ahora', () => {
  let listar: any;
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(comprobantesApi, 'obtenerFacturacion').mockResolvedValue({ igvPct: 10.5, serieBoleta: 'B002', serieFactura: 'F002', proveedor: 'SUNAT', proveedor_efectivo: 'SUNAT', sunat: { ambiente: 'beta', credenciales: true, vence_certificado: null } } as any);
    vi.spyOn(comprobantesApi, 'obtenerBoletaPorDefecto').mockResolvedValue({ activo: true, aplica: true, proveedor_efectivo: 'SUNAT' });
    vi.spyOn(comprobantesApi, 'obtenerFacturaWhatsapp').mockResolvedValue({ activo: true, plantilla: '' });
    vi.spyOn(comprobantesApi, 'saludFacturacion').mockResolvedValue(null as any);
    vi.spyOn(comprobantesApi, 'listarProblemasElectronicos').mockResolvedValue({ total: 0, pagina: 1, limite: 50, totalPaginas: 1, elementos: [] } as any);
    listar = vi.spyOn(comprobantesApi, 'listarElectronicos').mockResolvedValue({
      total: 3, pagina: 1, limite: 20, totalPaginas: 1, contadores,
      elementos: [
        fila({ envio_whatsapp: { estado: 'SIN_VENTANA', via: null, enviado_en: null, intentos: 1, detalle: 'SIN_VENTANA' } }),
        fila({ id: '11', numero_texto: 'B002-000002', celular_wa: null }),
        fila({ id: '12', numero_texto: 'B002-000003', envio_whatsapp: { estado: 'OMITIDO', via: null, enviado_en: null, intentos: 1, detalle: 'ENVIADO_A_MANO' } }),
      ],
    } as any);
  });

  it('los chips traen su contador y al elegir uno el servidor recibe el filtro', async () => {
    sesion({ partyId: '1', nombres: 'Ana', rol: 'CAJERO' });
    render(<ElectronicosTab />);
    const grupo = await screen.findByRole('group', { name: 'Filtrar comprobantes' });
    expect(await within(grupo).findByRole('button', { name: 'Faltan emitir (2)' })).toBeTruthy();
    expect(within(grupo).getByRole('button', { name: 'Todos (5)' })).toBeTruthy();
    expect(within(grupo).getByRole('button', { name: 'Aceptados (3)' })).toBeTruthy();
    fireEvent.click(within(grupo).getByRole('button', { name: 'Faltan emitir (2)' }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(1, 20, 'faltan'));
    fireEvent.click(within(grupo).getByRole('button', { name: 'Sin enviar por WhatsApp (1)' }));
    await waitFor(() => expect(listar).toHaveBeenLastCalledWith(1, 20, 'sin_whatsapp'));
  });

  it('botón «Enviar por WhatsApp»: abre wa.me, se destaca sin ventana, marca a mano y «Sin celular» no tiene botón', async () => {
    sesion({ partyId: '1', nombres: 'Ana', rol: 'CAJERO' });
    const marcar = vi.spyOn(comprobantesApi, 'marcarEnviadoWhatsappManual').mockResolvedValue({ ok: true });
    render(<ElectronicosTab />);
    const tarjeta = await screen.findByTestId('electronico-10');
    const enlace = within(tarjeta).getByRole('link', { name: /Enviar por WhatsApp/ });
    expect(enlace.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/51987654321\?text=/);
    expect(enlace.getAttribute('target')).toBe('_blank');
    expect((enlace as HTMLElement).style.background).toMatch(/37, 211, 102|#25d366/i); // verde WhatsApp
    fireEvent.click(enlace);
    await waitFor(() => expect(marcar).toHaveBeenCalledWith('10'));

    const sinCel = screen.getByTestId('electronico-11');
    expect(within(sinCel).queryByRole('link', { name: /Enviar por WhatsApp/ })).toBeNull();
    expect(within(sinCel).getByText('Sin celular')).toBeTruthy();

    const aMano = screen.getByTestId('electronico-12');
    expect(within(aMano).getByText('Enviado a mano')).toBeTruthy();
    expect((within(aMano).getByRole('link', { name: /Enviar por WhatsApp/ }) as HTMLElement).style.background).not.toMatch(/37, 211, 102/);
  });

  it('un fallo al marcar «a mano» no impide abrir el enlace ni rompe la pantalla', async () => {
    sesion({ partyId: '1', nombres: 'Ana', rol: 'CAJERO' });
    vi.spyOn(comprobantesApi, 'marcarEnviadoWhatsappManual').mockRejectedValue(new Error('caído'));
    render(<ElectronicosTab />);
    const enlace = within(await screen.findByTestId('electronico-10')).getByRole('link', { name: /Enviar por WhatsApp/ });
    fireEvent.click(enlace);
    expect(await screen.findByTestId('electronico-10')).toBeTruthy();
  });

  it('un ADMIN con otro rol principal (varios roles) ve «Emitir ahora (N pendientes)» y lo ejecuta', async () => {
    sesion({ partyId: '1', nombres: 'Dueño', rol: 'CAJERO', roles: ['CAJERO', 'ADMIN'] });
    const emitir = vi.spyOn(comprobantesApi, 'emitirAhora').mockResolvedValue({ emitidos: 1, cambios: 0, descartados: 0, resumenes: 1, boletas: 4, reintentados: 2 });
    render(<ElectronicosTab />);
    const boton = await screen.findByRole('button', { name: 'Emitir ahora (4 pendientes)' });
    fireEvent.click(boton);
    expect(emitir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sí, emitir'));
    await waitFor(() => expect(emitir).toHaveBeenCalled());
    expect(await screen.findByText(/4 boleta\(s\) en el resumen/)).toBeTruthy();
    // y las secciones de admin también salen
    expect(screen.getByRole('region', { name: 'Factura por WhatsApp' })).toBeTruthy();
  });

  it('sin permiso de emitir ni ADMIN no sale «Emitir ahora»', async () => {
    sesion({ partyId: '1', nombres: 'Ana', rol: 'MOZO', roles: ['MOZO'] });
    render(<ElectronicosTab />);
    await screen.findByTestId('electronico-10');
    expect(screen.queryByRole('button', { name: /^Emitir ahora/ })).toBeNull();
  });
});
