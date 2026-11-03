import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as sesionModulo from '../../../comun/sesion';
import { comprobantesApi } from '../comprobantesApi';
import { ElectronicosTab } from '../ElectronicosTab';
import type { ComprobanteElectronico } from '../tipos';

const base: ComprobanteElectronico = {
  id: '5',
  pedido_id: '9',
  codigo_pedido: 'CP-0009',
  tipo: 'BOLETA',
  serie: 'B002',
  numero: 1,
  numero_texto: 'B002-000001',
  documento: null,
  razon_social: null,
  total: 11.8,
  fecha_lima: '2026-11-02 10:00:00',
  emision: 'EMITIDO',
  facturacion_estado: 'EMITIDO_SUNAT',
  facturacion_intentos: 1,
  enlace_pdf: 'https://sunat.test/pdf/1',
  cadena_qr: 'QR',
  hash: 'HASH',
  respuesta_sunat: 'Aceptada',
  simulado: false,
  baja_estado: null,
  baja_motivo: null,
  baja_en: null,
};

const filas: ComprobanteElectronico[] = [
  base,
  { ...base, id: '6', numero: 2, numero_texto: 'F002-000002', tipo: 'FACTURA', facturacion_estado: 'RECHAZADO', enlace_pdf: null, respuesta_sunat: 'RUC inválido' },
  { ...base, id: '7', numero: 3, numero_texto: 'B002-000003', facturacion_estado: 'PENDIENTE_ENVIO', enlace_pdf: null, respuesta_sunat: null },
];

function conRol(rol: string) {
  vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({
    usuario: { partyId: '1', nombres: 'Test', rol },
    permisos: [],
    debeCambiar: false,
    cargando: false,
    autenticado: true,
    ingresar: vi.fn(),
    salir: vi.fn(),
    renovar: vi.fn(),
    refrescarYo: vi.fn(),
    marcarClaveCambiada: vi.fn(),
    tiene: vi.fn().mockReturnValue(true),
  } as any);
}

describe('ElectronicosTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(comprobantesApi, 'listarElectronicos').mockResolvedValue({ total: 3, pagina: 1, limite: 20, totalPaginas: 1, elementos: filas });
    vi.spyOn(comprobantesApi, 'obtenerFacturacion').mockResolvedValue({
      igvPct: 10.5,
      serieBoleta: 'B002',
      serieFactura: 'F002',
      proveedor: 'SIMULADO',
      proveedor_efectivo: 'SIMULADO',
      sunat: { ambiente: 'beta', credenciales: false, vence_certificado: null },
    });
  });

  it('muestra el estado de cada comprobante y el modo simulado sin valores de conexión', async () => {
    conRol('ADMIN');
    render(<ElectronicosTab />);

    expect(await screen.findByText('Emitido SUNAT')).toBeTruthy();
    expect(screen.getByText('Rechazado')).toBeTruthy();
    expect(screen.getByText('Pendiente de envío')).toBeTruthy();
    expect(screen.getByText('Modo simulado (sin SUNAT)')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Ver PDF' }).getAttribute('href')).toBe('https://sunat.test/pdf/1');
  });

  it('anular pide motivo y confirmación Sí/No antes de llamar a la API', async () => {
    conRol('ADMIN');
    const anular = vi.spyOn(comprobantesApi, 'anularElectronico').mockResolvedValue({ id: '5', baja_estado: 'ACEPTADA' });
    render(<ElectronicosTab />);
    await screen.findByText('Emitido SUNAT');

    fireEvent.click(screen.getByRole('button', { name: 'Anular' }));
    const dialogo = await screen.findByRole('dialog', { name: 'Anular comprobante' });
    expect(dialogo).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Sí, anular' }));
    expect(anular).not.toHaveBeenCalled();
    expect(await screen.findByRole('alert')).toBeTruthy();

    fireEvent.change(screen.getByRole('textbox', { name: /Motivo/ }), { target: { value: 'Cobro duplicado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, anular' }));
    await waitFor(() => expect(anular).toHaveBeenCalledWith('5', 'Cobro duplicado'));
  });

  it('el cajero no ve Anular ni Reintentar', async () => {
    conRol('CAJERO');
    render(<ElectronicosTab />);
    await screen.findByText('Emitido SUNAT');
    expect(screen.queryByRole('button', { name: 'Anular' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('reintentar una boleta rechazada envía la corrección solo con los campos escritos', async () => {
    conRol('ADMIN');
    const reintentar = vi.spyOn(comprobantesApi, 'reintentarElectronico').mockResolvedValue({ id: '6', facturacion_estado: 'EMITIDO_SUNAT' });
    render(<ElectronicosTab />);
    await screen.findByText('Rechazado');

    fireEvent.click(screen.getAllByRole('button', { name: 'Reintentar' })[0]);
    fireEvent.change(await screen.findByRole('textbox', { name: /Dirección/ }), { target: { value: 'Av. Lima 123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, reintentar' }));

    await waitFor(() => expect(reintentar).toHaveBeenCalledWith('6', { direccion: 'Av. Lima 123' }));
  });

  it('SUNAT directo: muestra ambiente, credenciales (sin valores), el resumen pendiente y descarga el XML y el CDR', async () => {
    conRol('ADMIN');
    const boleta: ComprobanteElectronico = { ...base, id: '8', facturacion_estado: 'PENDIENTE_RESUMEN', enlace_pdf: null, emisor: 'SUNAT', simulado: false, respuesta_sunat: null };
    const emitidaSunat: ComprobanteElectronico = { ...base, id: '9', numero: 4, numero_texto: 'F002-000004', tipo: 'FACTURA', emisor: 'SUNAT', simulado: false, enlace_pdf: null };
    vi.spyOn(comprobantesApi, 'listarElectronicos').mockResolvedValue({ total: 2, pagina: 1, limite: 20, totalPaginas: 1, elementos: [boleta, emitidaSunat] });
    vi.spyOn(comprobantesApi, 'obtenerFacturacion').mockResolvedValue({
      igvPct: 10.5,
      serieBoleta: 'B002',
      serieFactura: 'F002',
      proveedor: 'SUNAT',
      proveedor_efectivo: 'SUNAT',
      sunat: { ambiente: 'beta', credenciales: true, vence_certificado: '2027-10-07' },
    });
    const descargar = vi.spyOn(comprobantesApi, 'urlArchivoElectronico').mockResolvedValue('blob:xml');

    render(<ElectronicosTab />);

    expect(await screen.findByText('SUNAT directo · beta (pruebas)')).toBeTruthy();
    expect(screen.getByText('configuradas')).toBeTruthy();
    expect(screen.getByText('07/10/2027')).toBeTruthy();
    expect(screen.getByText('Pendiente de resumen diario')).toBeTruthy();
    expect(screen.getByText('Emitido SUNAT')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'XML firmado' })[1]);
    await waitFor(() => expect(descargar).toHaveBeenCalledWith('9', 'XML'));
    // La boleta en cola tiene su XML firmado y se puede anular (SUNAT aún no la recibió)
    expect(screen.getByTestId('electronico-8').textContent).toContain('XML firmado');
    expect(screen.getByTestId('electronico-8').textContent).toContain('Anular');
  });

  it('Ver PDF: cada comprobante electrónico abre su PDF en una pestaña nueva', async () => {
    conRol('ADMIN');
    const urlPdf = vi.spyOn(comprobantesApi, 'urlPdfElectronico').mockResolvedValue('blob:pdf-1');
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(<ElectronicosTab />);

    const botones = await screen.findAllByRole('button', { name: 'Ver PDF' });
    expect(botones.length).toBeGreaterThanOrEqual(filas.length);
    expect(botones[0].style.minHeight).toBe('44px');
    fireEvent.click(botones[0]);
    await waitFor(() => expect(urlPdf).toHaveBeenCalledWith('5'));
    expect(abrir).toHaveBeenCalledWith('blob:pdf-1', '_blank', 'noopener,noreferrer');
    abrir.mockRestore();
  });

  it('panel «Con problemas»: contador arriba y corrección para una factura en revisión manual', async () => {
    conRol('ADMIN');
    const enRevision: ComprobanteElectronico = { ...base, id: '11', tipo: 'FACTURA', numero: 7, numero_texto: 'F002-000007', facturacion_estado: 'REVISION_MANUAL', enlace_pdf: null, revision_motivo: 'Rechazo permanente 2335: RUC inválido' };
    vi.spyOn(comprobantesApi, 'listarProblemasElectronicos').mockResolvedValue({ total: 1, pagina: 1, limite: 50, totalPaginas: 1, elementos: [enRevision] });
    vi.spyOn(comprobantesApi, 'saludFacturacion').mockResolvedValue({
      pendientes: 2, con_problemas: 1, revision_manual: 1, rechazados: 0, pendientes_mas_15_min: 0, edad_pendiente_min: null,
      boletas_por_reportar: 0, resumenes_sin_respuesta: 0, certificado_vence_en_dias: 300, circuito_abierto: false, credenciales_invalidas: false, generado_en: '2026-11-02T10:00:00Z',
    });
    render(<ElectronicosTab />);

    expect(await screen.findByTestId('contador-facturacion')).toBeTruthy();
    expect(screen.getByText('Pendientes: 2')).toBeTruthy();
    const panel = await screen.findByRole('region', { name: 'Comprobantes con problemas' });
    expect(panel.textContent).toContain('Rechazo permanente 2335');
    expect(screen.getByRole('button', { name: 'Corregir y reintentar' })).toBeTruthy();
  });
});
