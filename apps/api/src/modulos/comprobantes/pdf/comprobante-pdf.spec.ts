import { generarPdfComprobante, DatosPdfComprobante, LEYENDA_REPRESENTACION, MARCA_PRUEBA } from './comprobante-pdf';
import { armarDatosPdf } from './comprobante-datos';

const HASH = 'abc123HASHdePrueba=';
const QR = '20000000001|01|F002|1063238|16.00|176.00|02-11-2026|6|20100066603|';

const datosBase: DatosPdfComprobante = {
  tipo: 'FACTURA',
  numeroTexto: 'F002-000123',
  fecha: '02-11-2026',
  hora: '10:15:00',
  emisor: { razonSocial: 'GRUPO CORPORATIVO CAPRICHOS S.A.C.', nombreComercial: 'CAPRICHOS', ruc: '20611290064', direccion: 'CAL. 11 MZ. D LT. 27 LIMA' },
  cliente: { etiqueta: 'RUC', numero: '20100066603', denominacion: 'CLIENTE PRUEBA SAC', direccion: 'AV. PRUEBA 123' },
  items: [
    { cantidad: 2, descripcion: 'Frappe Oreo', precioUnit: 11.8, importe: 23.6 },
    { cantidad: 1, descripcion: 'Torta de chocolate', precioUnit: 10, importe: 10 },
  ],
  opGravada: 30.4,
  igv: 3.2,
  igvPct: 10.5,
  descuento: 0,
  total: 33.6,
  totalEnLetras: 'SON TREINTA Y TRES CON 60/100 SOLES',
  situacion: 'FIRMADO',
  titulo: 'Representación impresa de la Factura electrónica',
  hash: HASH,
  cadenaQr: QR,
  prueba: true,
};

/**
 * Texto del PDF sin comprimir: PDFKit escribe cada tramo de texto como cadena hex en un TJ.
 * Se decodifica cada cadena y se unen (los tramos parten las palabras por kerning; se unen sin separador).
 */
async function textoDelPdf(d: DatosPdfComprobante): Promise<string> {
  const crudo = (await generarPdfComprobante(d, { comprimir: false })).toString('latin1');
  const tramos = crudo.match(/<[0-9A-Fa-f]+>/g) ?? [];
  return tramos.map((h) => Buffer.from(h.slice(1, -1), 'hex').toString('latin1')).join('');
}

describe('representación impresa PDF de boleta y factura', () => {
  it('genera un PDF real (cabecera %PDF y fin %%EOF) y no vacío', async () => {
    const pdf = await generarPdfComprobante(datosBase);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
    expect(pdf.length).toBeGreaterThan(2000);
  });

  it('lleva las cadenas clave: número, total en letras, hash, leyenda y QR como imagen', async () => {
    const txt = await textoDelPdf(datosBase);
    expect(txt).toContain('F002-000123');
    expect(txt).toContain('SON TREINTA Y TRES CON 60/100 SOLES');
    expect(txt).toContain(HASH);
    expect(txt).toContain(LEYENDA_REPRESENTACION.replace('{tipo}', 'Factura'));
    // El QR es una imagen embebida (el PDF crudo, no el texto)
    const crudo = (await generarPdfComprobante(datosBase, { comprimir: false })).toString('latin1');
    expect(crudo).toContain('/Subtype /Image');
  });

  it('documento de prueba (beta o simulado): marca visible; en producción real no aparece', async () => {
    // El guion largo se codifica como WinAnsi (0x97): se comprueban las palabras de la marca
    const conPrueba = await textoDelPdf({ ...datosBase, prueba: true });
    expect(conPrueba).toContain('DOCUMENTO DE PRUEBA');
    expect(conPrueba).toContain('SIN VALOR TRIBUTARIO');
    expect(MARCA_PRUEBA).toContain('DOCUMENTO DE PRUEBA');
    const sinPrueba = await textoDelPdf({ ...datosBase, prueba: false });
    expect(sinPrueba).not.toContain('DOCUMENTO DE PRUEBA');
    expect(sinPrueba).not.toContain('SIN VALOR TRIBUTARIO');
  });

  it('rechazado: aviso PENDIENTE DE REGULARIZAR y sin hash válido', async () => {
    const txt = await textoDelPdf({ ...datosBase, situacion: 'REGULARIZAR', hash: null, cadenaQr: null, titulo: 'PENDIENTE DE REGULARIZAR: SUNAT no aceptó este comprobante' });
    expect(txt).toContain('PENDIENTE DE REGULARIZAR');
    expect(txt).not.toContain(HASH);
    expect((await generarPdfComprobante({ ...datosBase, situacion: 'REGULARIZAR', cadenaQr: null }, { comprimir: false })).toString('latin1')).not.toContain('/Subtype /Image');
  });

  it('boleta sin cliente identificado: «CLIENTE VARIOS» y su tipo en el título', async () => {
    const txt = await textoDelPdf({ ...datosBase, tipo: 'BOLETA', numeroTexto: 'B002-000007', cliente: { etiqueta: 'Documento', numero: '-', denominacion: 'CLIENTE VARIOS', direccion: null } });
    expect(txt).toContain('CLIENTE VARIOS');
    expect(txt).toContain('BOLETA DE VENTA ELECTR');
    expect(txt).toContain('B002-000007');
  });
});

describe('armarDatosPdf: enmascarado por rol y situación', () => {
  const local = { nombre: 'CAPRICHOS', razon_social: 'GRUPO CORPORATIVO CAPRICHOS S.A.C.', ruc: '20611290064', direccion_fiscal: 'CAL. 11 LIMA' };
  const pedido = {
    total: 33.6,
    subtotal: 33.6,
    descuento: 0,
    envio: 0,
    comprobante_direccion: 'AV. PRUEBA 123',
    comprobante_razon: 'CLIENTE PRUEBA SAC',
    lineas: [{ nombre: 'Frappe Oreo', cantidad: 2, precio_unit: 11.8, subtotal: 23.6 }, { nombre: 'Torta', cantidad: 1, precio_unit: 10, subtotal: 10 }],
  };
  const fila = (extra: any = {}) => ({
    id: 1n,
    tipo: 'FACTURA',
    serie: 'F002',
    numero: 123,
    numero_texto: 'F002-000123',
    documento: '20100066603',
    razon_social: 'CLIENTE PRUEBA SAC',
    creado_en: new Date('2026-11-02T15:15:00.000Z'),
    facturacion_estado: 'EMITIDO_SUNAT',
    facturacion_hash: HASH,
    facturacion_cadena_qr: QR,
    sunat_total_cents: 3360,
    sunat_igv_cents: 320,
    simulado: false,
    ...extra,
  });

  it('ADMIN ve el RUC completo; otros roles ven el RUC enmascarado', () => {
    expect(armarDatosPdf(fila(), pedido, local, { esAdmin: true, ambiente: 'prod' }).cliente.numero).toBe('20100066603');
    const otro = armarDatosPdf(fila(), pedido, local, { esAdmin: false, ambiente: 'prod' }).cliente;
    expect(otro.numero).toBe('20****03');
    expect(otro.etiqueta).toBe('RUC');
  });

  it('el IGV sale con su porcentaje real (10,5) y el desglose cuadra con el total guardado', () => {
    const d = armarDatosPdf(fila(), pedido, local, { esAdmin: true, ambiente: 'prod' });
    expect(d.igvPct).toBe(10.5);
    expect(d.total).toBe(33.6);
    expect(Math.round((d.opGravada + d.igv) * 100)).toBe(3360);
    expect(d.totalEnLetras).toBe('SON TREINTA Y TRES CON 60/100 SOLES');
  });

  it('ambiente beta marca el documento de prueba aunque el comprobante no sea simulado', () => {
    expect(armarDatosPdf(fila(), pedido, local, { esAdmin: true, ambiente: 'beta' }).prueba).toBe(true);
    expect(armarDatosPdf(fila(), pedido, local, { esAdmin: true, ambiente: 'prod' }).prueba).toBe(false);
  });

  it('firmada pero rechazada por SUNAT: REGULARIZAR y sin hash ni QR en el documento', () => {
    const d = armarDatosPdf(fila({ facturacion_estado: 'RECHAZADO' }), pedido, local, { esAdmin: true, ambiente: 'prod' });
    expect(d.situacion).toBe('REGULARIZAR');
    expect(d.hash).toBeNull();
    expect(d.cadenaQr).toBeNull();
  });

  it('boleta firmada (pendiente de resumen) ya lleva hash y QR', () => {
    const d = armarDatosPdf(fila({ tipo: 'BOLETA', facturacion_estado: 'PENDIENTE_RESUMEN', documento: null, razon_social: null }), pedido, local, { esAdmin: false, ambiente: 'prod' });
    expect(d.situacion).toBe('FIRMADO');
    expect(d.hash).toBe(HASH);
    expect(d.cadenaQr).toBe(QR);
    expect(d.cliente.denominacion).toBe('CLIENTE VARIOS');
    expect(d.cliente.etiqueta).toBe('Documento');
  });
});
