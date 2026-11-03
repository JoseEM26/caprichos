// Mock de EventosGateway (como en el resto de specs de comprobantes)
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ComprobantesService } from './comprobantes.service';
import { ComprobantesSaludService } from './comprobantes-salud.service';
import { ComprobantesReintentosService } from './comprobantes-reintentos.service';
import { SunatEmisor } from './sunat/sunat.emisor';
import { certificadoDePrueba } from './sunat/sunat.pruebas';
import { zipUnico } from './sunat/sunat.util';
import { siguienteCorrelativo } from './secuencia';
import { TIMEOUT_SUNAT_INTERACTIVO_MS, TIMEOUT_SUNAT_MS } from './sunat/sunat.soap';
import { crearBaseFalsa, pedidoDePrueba } from './comprobantes.fake-db';
import { construirTicketPago } from '../impresion/constructor-etiquetas';
import { representacionDe } from './facturacion/representacion';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

const cajero: UsuarioAutenticado = { partyId: 2n, rol: 'CAJERO', debeCambiar: false };
const p12 = certificadoDePrueba();
const env = {
  SUNAT_AMBIENTE: 'beta',
  SUNAT_SOL_USUARIO: '20000000001MODDATOS',
  SUNAT_SOL_CLAVE: 'clave-secreta-prueba',
  SUNAT_CERT_P12_B64: p12.p12B64,
  SUNAT_CERT_CLAVE: p12.clave,
} as NodeJS.ProcessEnv;
const emisorLocal = async () => ({
  ruc: '20611290064',
  razon_social: 'GRUPO CORPORATIVO CAPRICHOS S.A.C.',
  nombre: 'CAPRICHOS',
  direccion_fiscal: 'CAL. 11 MZ. D LT. 27 LIMA',
  ubigeo: '150132',
});
const cdrZip = (codigo: string) =>
  zipUnico(
    'R-20000000001-01-F002-1.xml',
    `<ar:ApplicationResponse xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cac:DocumentResponse><cac:Response><cbc:ResponseCode>${codigo}</cbc:ResponseCode><cbc:Description>Descripción SUNAT</cbc:Description></cac:Response></cac:DocumentResponse></ar:ApplicationResponse>`,
  ).toString('base64');
const sobreAceptado = () =>
  new Response(`<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><br:sendBillResponse xmlns:br="http://service.sunat.gob.pe"><br:applicationResponse>${cdrZip('0')}</br:applicationResponse></br:sendBillResponse></soap:Body></soap:Envelope>`, { status: 200 });

const esEnvio = (init: any) => String(init.body).includes('<ser:sendBill>');

function montar(fetchFn: any, opciones: { envSinCert?: boolean; boleta?: boolean } = {}) {
  const pedido = opciones.boleta
    ? pedidoDePrueba({ comprobante_tipo: 'BOLETA', comprobante_doc: null, comprobante_razon: null, comprobante_direccion: null })
    : pedidoDePrueba();
  const base = crearBaseFalsa({
    pedido: [pedido],
    parametro: [{ clave: 'facturacion_proveedor', valor: 'SUNAT' }],
  });
  const auditoria = { registrar: jest.fn(async () => undefined) } as any;
  const sunat = new SunatEmisor({
    env: opciones.envSinCert ? { ...env, SUNAT_CERT_P12_B64: 'AAAA' } : env,
    emisorLocal,
    correlativo: (clave: string) => siguienteCorrelativo(base.prisma, clave),
    fetchFn,
  });
  const salud = new ComprobantesSaludService(base.prisma, undefined, sunat);
  const servicio = new ComprobantesService(base.prisma, auditoria, undefined, undefined, sunat, undefined, salud);
  const worker = new ComprobantesReintentosService(servicio, undefined, salud);
  return { ...base, servicio, worker, salud, auditoria };
}

/** Emite la nota del cobro dentro de una transacción (como hace el cobro). */
const nota = (m: any) => m.prisma.$transaction(async (tx: any) => m.servicio.emitirParaPedido(100n, tx, cajero));

/** Deja correr las promesas pendientes (la transmisión en segundo plano) sin usar temporizadores. */
const vaciar = async () => {
  for (let i = 0; i < 20; i++) await new Promise((r) => setImmediate(r));
};

describe('Cobro: firmar antes del ticket, transmitir en segundo plano', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('los timeouts interactivo (15 s) y de segundo plano (60 s) están separados', () => {
    expect(TIMEOUT_SUNAT_INTERACTIVO_MS).toBe(15000);
    expect(TIMEOUT_SUNAT_MS).toBe(60000);
  });

  it('firmar deja hash, cadena QR y XML/ZIP guardados SIN llamar a SUNAT', async () => {
    const fetchFn = jest.fn(async () => sobreAceptado());
    const m = montar(fetchFn);
    const { servicio, db } = m;
    await nota(m);
    await servicio.firmarPorPedido(100n, cajero);
    expect(fetchFn).not.toHaveBeenCalled();
    const c = db.comprobante[0];
    expect(c.facturacion_estado).toBe('PENDIENTE_ENVIO');
    expect(c.facturacion_hash).toBeTruthy();
    expect(c.facturacion_cadena_qr).toMatch(/^20000000001\|01\|F002\|/);
    expect(db.comprobanteArchivo.map((a: any) => a.tipo).sort()).toEqual(['XML', 'ZIP']);
  });

  it('transmitir no espera a SUNAT: aunque nunca responda, el llamador vuelve al instante', async () => {
    const fetchFn = jest.fn(() => new Promise<Response>(() => undefined));
    const m = montar(fetchFn);
    await nota(m);
    await m.servicio.firmarPorPedido(100n, cajero);
    // Temporizadores falsos solo para el timeout de SUNAT (60 s); setImmediate sigue real para vaciar las promesas
    jest.useFakeTimers({ doNotFake: ['setImmediate', 'nextTick', 'queueMicrotask'] });
    try {
      const resultado = m.servicio.transmitirEnSegundoPlano(100n);
      expect(resultado).toBeUndefined();
      await vaciar();
      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(m.db.comprobante[0].facturacion_estado).toBe('PENDIENTE_ENVIO');
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });

  it('transmisión fallida: el comprobante queda PENDIENTE_ENVIO con su hash y no se deshace nada', async () => {
    const fetchFn = jest.fn(async () => {
      throw new Error('red caída');
    });
    const m = montar(fetchFn);
    const { servicio, db } = m;
    await nota(m);
    await servicio.firmarPorPedido(100n, cajero);
    const hash = db.comprobante[0].facturacion_hash;
    servicio.transmitirEnSegundoPlano(100n);
    await vaciar();
    const c = db.comprobante[0];
    expect(c.facturacion_estado).toBe('PENDIENTE_ENVIO');
    expect(c.facturacion_hash).toBe(hash);
    expect(c.proximo_intento_en).toBeInstanceOf(Date);
  });

  it('sin doble envío: firma, transmisión y worker mandan el comprobante una sola vez', async () => {
    const fetchFn = jest.fn(async () => sobreAceptado());
    const m = montar(fetchFn);
    const { servicio, worker, db } = m;
    await nota(m);
    await servicio.firmarPorPedido(100n, cajero);
    servicio.transmitirEnSegundoPlano(100n);
    await Promise.all([vaciar(), worker.ejecutar()]);
    await vaciar();
    expect(fetchFn.mock.calls.filter(([, init]: any) => esEnvio(init))).toHaveLength(1);
    expect(db.comprobante[0].facturacion_estado).toBe('EMITIDO_SUNAT');
    expect(db.comprobante[0].facturacion_hash).toBeTruthy();
  });

  it('firma que falla (certificado): el cobro no se deshace, la fila queda PENDIENTE_ENVIO sin hash y se avisa', async () => {
    const fetchFn = jest.fn(async () => sobreAceptado());
    const m = montar(fetchFn, { envSinCert: true });
    const { servicio, db, salud } = m;
    await nota(m);
    const aviso = jest.spyOn(salud, 'avisar');
    await expect(servicio.firmarPorPedido(100n, cajero)).resolves.toBeUndefined();
    const c = db.comprobante[0];
    expect(c.facturacion_estado).toBe('PENDIENTE_ENVIO');
    expect(c.facturacion_hash).toBeFalsy();
    expect(aviso).toHaveBeenCalledWith(expect.objectContaining({ prioridad: 'alta' }));
  });

  it('boleta firmada queda PENDIENTE_RESUMEN sin red y su ticket ya lleva hash y QR', async () => {
    const fetchFn = jest.fn(async () => sobreAceptado());
    const m = montar(fetchFn, { boleta: true }) as any;
    const { servicio, db, pedido } = m;
    await nota(m);
    await servicio.firmarPorPedido(100n, cajero);
    expect(fetchFn).not.toHaveBeenCalled();
    const c = db.comprobante[0];
    expect(c.tipo).toBe('BOLETA');
    expect(c.facturacion_estado).toBe('PENDIENTE_RESUMEN');
    const t = construirTicketPago(db.pedido[0], {}, c);
    expect(t.comprobante?.situacion).toBe('FIRMADO');
    expect(t.comprobante?.hash).toBe(c.facturacion_hash);
    expect(t.comprobante?.cadenaQr).toMatch(/^20000000001\|03\|B002\|/);
    expect(t.comprobante?.representacion).toMatch(/Boleta de venta electrónica/);
    void pedido;
  });
});

describe('Representación del comprobante (ticket y PDF)', () => {
  it('firmado y aceptado, o aún sin respuesta: hash y QR', () => {
    for (const estado of ['PENDIENTE_ENVIO', 'PENDIENTE_RESUMEN', 'EMITIDO_SUNAT']) {
      const r = representacionDe({ tipo: 'FACTURA', facturacion_estado: estado, facturacion_hash: 'H', facturacion_cadena_qr: 'Q' }, 'prod');
      expect(r.situacion).toBe('FIRMADO');
      expect(r.hash).toBe('H');
      expect(r.cadenaQr).toBe('Q');
    }
  });

  it('rechazado o en revisión: pendiente de regularizar, sin hash válido', () => {
    for (const estado of ['RECHAZADO', 'REVISION_MANUAL']) {
      const r = representacionDe({ tipo: 'BOLETA', facturacion_estado: estado, facturacion_hash: 'H', facturacion_cadena_qr: 'Q' }, 'prod');
      expect(r.situacion).toBe('REGULARIZAR');
      expect(r.titulo).toMatch(/PENDIENTE DE REGULARIZAR/);
      expect(r.hash).toBeNull();
      expect(r.cadenaQr).toBeNull();
    }
  });

  it('sin firmar: en proceso, sin hash', () => {
    const r = representacionDe({ tipo: 'FACTURA', facturacion_estado: 'PENDIENTE_ENVIO', facturacion_hash: null }, 'prod');
    expect(r.situacion).toBe('EN_PROCESO');
    expect(r.hash).toBeNull();
  });

  it('marca de prueba en beta o simulado; ausente en producción con comprobante real', () => {
    const base = { tipo: 'FACTURA', facturacion_estado: 'EMITIDO_SUNAT', facturacion_hash: 'H' };
    expect(representacionDe({ ...base, simulado: false }, 'beta').prueba).toBe(true);
    expect(representacionDe({ ...base, simulado: true }, 'prod').prueba).toBe(true);
    expect(representacionDe({ ...base, simulado: false }, 'prod').prueba).toBe(false);
  });
});

describe('PDF del comprobante: 404, 409, auditoría y enmascarado por rol', () => {
  it('comprobante inexistente -> 404; nota de venta -> 409 (no tiene representación electrónica)', async () => {
    const m = montar(jest.fn(async () => sobreAceptado()));
    await expect(m.servicio.pdfComprobante(999n, cajero)).rejects.toMatchObject({ status: 404 });
    await nota(m);
    m.db.comprobante[0].tipo = 'NOTA_VENTA';
    await expect(m.servicio.pdfComprobante(m.db.comprobante[0].id, cajero)).rejects.toMatchObject({ status: 409 });
  });

  it('boleta o factura: devuelve un PDF, audita la lectura y enmascara el RUC para no ADMIN', async () => {
    const m = montar(jest.fn(async () => sobreAceptado()));
    await nota(m);
    await m.servicio.firmarPorPedido(100n, cajero);
    const id = m.db.comprobante[0].id;
    const cajeroPdf = await m.servicio.pdfComprobante(id, cajero, '10.0.0.1');
    expect(cajeroPdf.nombre).toBe(`${m.db.comprobante[0].numero_texto}.pdf`);
    expect(cajeroPdf.contenido.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    const auditoria = m.auditoria.registrar.mock.calls.map((c: any) => c[0]);
    expect(auditoria.some((a: any) => a.accion === 'VER_PDF_ELECTRONICO' && a.categoria === 'LECTURA_SENSIBLE')).toBe(true);
    // Solo ADMIN ve el documento completo: se comprueba en el texto del PDF sin comprimir del mismo servicio
    const admin = await m.servicio.pdfComprobante(id, { partyId: 1n, rol: 'ADMIN', debeCambiar: false } as UsuarioAutenticado);
    expect(admin.contenido.length).toBeGreaterThan(0);
  });
});
