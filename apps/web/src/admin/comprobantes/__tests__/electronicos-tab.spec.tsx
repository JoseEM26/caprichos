import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import * as sesionModulo from '../../../comun/sesion';
import { api } from '../../../comun/api';
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

  it('Emitir ahora pide Sí/No y las horas se guardan con la configuración', async () => {
    conRol('ADMIN');
    const emitir = vi.spyOn(comprobantesApi, 'emitirAhora').mockResolvedValue({ emitidos: 2, cambios: 0, descartados: 0, resumenes: 1, boletas: 1 });
    const guardar = vi.spyOn(comprobantesApi, 'guardarFacturacion').mockImplementation(async (c: any) => ({ igvPct: 10.5, serieBoleta: 'B002', serieFactura: 'F002', proveedor: 'SIMULADO', proveedor_efectivo: 'SIMULADO', sunat: { ambiente: 'beta', credenciales: false, vence_certificado: null }, envio_nocturno: 'si', hora_envio: c.horaEnvio, hora_resumen: c.horaResumen }));
    render(<ElectronicosTab />);
    expect((await screen.findByTestId('horas-envio')).textContent).toContain('23:00');

    fireEvent.click(screen.getByText('Emitir ahora'));
    expect(emitir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sí, emitir'));
    await waitFor(() => expect(emitir).toHaveBeenCalled());
    expect(await screen.findByText(/2 comprobante\(s\) emitido\(s\)/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText('Hora de boletas y facturas'), { target: { value: '22:45' } });
    fireEvent.change(screen.getByLabelText('Hora del resumen de boletas'), { target: { value: '23:15' } });
    fireEvent.click(screen.getByText('Guardar configuración'));
    fireEvent.click(screen.getByText('Sí, guardar'));
    await waitFor(() => expect(guardar).toHaveBeenCalledWith(expect.objectContaining({ envioNocturno: 'si', horaEnvio: '22:45', horaResumen: '23:15' })));
  });

  it('Emitir ahora avisa claro cuando hubo fallidos y no dice que no había nada', async () => {
    conRol('ADMIN');
    vi.spyOn(comprobantesApi, 'emitirAhora').mockResolvedValue({ emitidos: 0, cambios: 0, descartados: 0, fallidos: 2, resumenes: 0, boletas: 0 });
    render(<ElectronicosTab />);
    await screen.findByText('Emitido SUNAT');
    fireEvent.click(screen.getByText('Emitir ahora'));
    fireEvent.click(screen.getByText('Sí, emitir'));
    expect(await screen.findByText(/2 comprobante\(s\) no se pudieron emitir, revisa el detalle o inténtalo de nuevo/)).toBeTruthy();
    expect(screen.queryByText(/No había nada pendiente/)).toBeNull();
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

  it('anular una boleta ya aceptada avisa que SUNAT la recibe en el resumen diario, no al instante', async () => {
    conRol('ADMIN');
    vi.spyOn(comprobantesApi, 'anularElectronico').mockResolvedValue({ id: '5', baja_estado: 'PENDIENTE_RESUMEN' });
    render(<ElectronicosTab />);
    await screen.findByText('Emitido SUNAT');
    fireEvent.click(screen.getByRole('button', { name: 'Anular' }));
    await screen.findByRole('dialog', { name: 'Anular comprobante' });
    fireEvent.change(screen.getByRole('textbox', { name: /Motivo/ }), { target: { value: 'Cobro duplicado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Sí, anular' }));
    expect(await screen.findByText(/quedó anulada\. SUNAT la recibe en el resumen diario/)).toBeTruthy();
  });

  it('Emitir real: solo en filas Simulado, pide confirmación explícita y llama a la API', async () => {
    conRol('ADMIN');
    const simulado: ComprobanteElectronico = { ...base, id: '11', numero_texto: 'B002-000011', simulado: true, emisor: 'SIMULADO', enlace_pdf: null };
    vi.spyOn(comprobantesApi, 'listarElectronicos').mockResolvedValue({ total: 2, pagina: 1, limite: 20, totalPaginas: 1, elementos: [base, simulado] });
    const emitir = vi.spyOn(comprobantesApi, 'emitirReal').mockResolvedValue({ id: '12', numero_texto: 'B002-000012' });
    render(<ElectronicosTab />);
    await screen.findByText('Simulado');
    expect(screen.getAllByRole('button', { name: 'Emitir real' })).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Emitir real' }));
    expect(await screen.findByText(/Se anulará el simulado B002-000011 y se emitirá uno nuevo a SUNAT con la fecha de hoy; no se puede deshacer/)).toBeTruthy();
    expect(emitir).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sí, emitir real' }));
    await waitFor(() => expect(emitir).toHaveBeenCalledWith('11'));
  });

  it('Emitir real: muestra el error del servidor (proveedor no SUNAT) y el cajero no ve el botón', async () => {
    conRol('ADMIN');
    const simulado: ComprobanteElectronico = { ...base, id: '11', simulado: true, emisor: 'SIMULADO', enlace_pdf: null };
    vi.spyOn(comprobantesApi, 'listarElectronicos').mockResolvedValue({ total: 1, pagina: 1, limite: 20, totalPaginas: 1, elementos: [simulado] });
    vi.spyOn(comprobantesApi, 'emitirReal').mockRejectedValue(new Error('Cambia el proveedor a SUNAT en Facturación primero'));
    const { unmount } = render(<ElectronicosTab />);
    await screen.findByText('Simulado');
    fireEvent.click(screen.getByRole('button', { name: 'Emitir real' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Sí, emitir real' }));
    expect(await screen.findByText('Cambia el proveedor a SUNAT en Facturación primero')).toBeTruthy();
    unmount();

    conRol('CAJERO');
    render(<ElectronicosTab />);
    await screen.findByText('Simulado');
    expect(screen.queryByRole('button', { name: 'Emitir real' })).toBeNull();
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

  describe('Buscar por DNI o RUC en la corrección', () => {
    const abrir = async (doc: string) => {
      conRol('ADMIN');
      render(<ElectronicosTab />);
      await screen.findByText('Rechazado');
      fireEvent.click(screen.getAllByRole('button', { name: 'Reintentar' })[0]);
      fireEvent.change(await screen.findByRole('textbox', { name: /Documento/ }), { target: { value: doc } });
    };

    it('con RUC válido rellena razón social y dirección', async () => {
      const get = vi.spyOn(api, 'get').mockResolvedValue({ razon_social: 'EMPRESA DE PRUEBA SAC', direccion: 'Av. Prueba 1' } as any);
      await abrir('20123456786');
      fireEvent.click(screen.getByRole('button', { name: 'Buscar por DNI o RUC' }));
      await waitFor(() => expect((screen.getByRole('textbox', { name: /Razón social/ }) as HTMLInputElement).value).toBe('EMPRESA DE PRUEBA SAC'));
      expect((screen.getByRole('textbox', { name: /Dirección/ }) as HTMLInputElement).value).toBe('Av. Prueba 1');
      expect(get).toHaveBeenCalledWith('/admin/ruc/20123456786');
    });

    it('si el servicio falla muestra el aviso y deja escribir a mano', async () => {
      vi.spyOn(api, 'get').mockRejectedValue(new Error('x'));
      await abrir('20123456786');
      fireEvent.click(screen.getByRole('button', { name: 'Buscar por DNI o RUC' }));
      expect((await screen.findByRole('alert')).textContent).toContain('no está disponible');
      const razon = screen.getByRole('textbox', { name: /Razón social/ }) as HTMLInputElement;
      fireEvent.change(razon, { target: { value: 'A mano' } });
      expect(razon.value).toBe('A mano');
    });

    it('con DNI de 8 dígitos rellena el nombre', async () => {
      const get = vi.spyOn(api, 'get').mockResolvedValue({ nombre_completo: 'MARIA PRUEBA LOPEZ' } as any);
      await abrir('12345678');
      fireEvent.click(screen.getByRole('button', { name: 'Buscar por DNI o RUC' }));
      await waitFor(() => expect((screen.getByRole('textbox', { name: /Razón social/ }) as HTMLInputElement).value).toBe('MARIA PRUEBA LOPEZ'));
      expect(get).toHaveBeenCalledWith('/admin/dni/12345678');
    });

    it('con RUC inválido el botón está deshabilitado', async () => {
      await abrir('20123456780');
      expect((screen.getByRole('button', { name: 'Buscar por DNI o RUC' }) as HTMLButtonElement).disabled).toBe(true);
    });
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

  it('botón Emitir ahora por fila: solo en POR_EMITIR_NOCHE, Sí/No, una llamada y muestra el mensaje', async () => {
    conRol('ADMIN');
    const espera = { ...base, id: '8', numero: null, numero_texto: null as any, facturacion_estado: 'POR_EMITIR_NOCHE', enlace_pdf: null, codigo_pedido: 'CP-0042' } as any;
    vi.spyOn(comprobantesApi, 'listarElectronicos').mockResolvedValue({ total: 2, pagina: 1, limite: 20, totalPaginas: 1, elementos: [base, espera] });
    const uno = vi.spyOn(comprobantesApi, 'emitirUno').mockResolvedValue({ emitido: true, numero_texto: 'B002-000009', facturacion_estado: 'EMITIDO_SUNAT', mensaje: 'La boleta B002-000009 quedó numerada' });
    render(<ElectronicosTab />);
    await screen.findByText('Se emite esta noche');
    expect(screen.getAllByRole('button', { name: /Emitir ahora (boleta|factura) del pedido/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Emitir ahora boleta del pedido CP-0042' }));
    expect(uno).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Sí, emitir'));
    await waitFor(() => expect(uno).toHaveBeenCalledTimes(1));
    expect(uno).toHaveBeenCalledWith('8');
    expect(await screen.findByText('La boleta B002-000009 quedó numerada')).toBeTruthy();
  });

  it('sin permiso comprobantes/emitir no hay botón Emitir ahora por fila', async () => {
    conRol('CAJERO');
    vi.spyOn(sesionModulo, 'useSesion').mockReturnValue({ usuario: { partyId: '1', nombres: 'T', rol: 'CAJERO' }, permisos: [], tiene: () => false } as any);
    vi.spyOn(comprobantesApi, 'listarElectronicos').mockResolvedValue({ total: 1, pagina: 1, limite: 20, totalPaginas: 1, elementos: [{ ...base, facturacion_estado: 'POR_EMITIR_NOCHE' } as any] });
    render(<ElectronicosTab />);
    await screen.findByText('Se emite esta noche');
    expect(screen.queryByRole('button', { name: /Emitir ahora (boleta|factura) del pedido/ })).toBeNull();
  });
});
