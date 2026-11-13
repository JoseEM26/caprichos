// Mock de EventosGateway
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Logger } from '@nestjs/common';
import { ComprobantesService } from './comprobantes.service';
import { ComprobantesSunatService, horaMinutoLima } from './comprobantes-sunat.service';
import { SunatEmisor } from './sunat/sunat.emisor';
import { ErrorCredencialesEmisor, ErrorRedEmisor } from './emisor/emisor.tipos';
import { certificadoDePrueba, datosDePrueba } from './sunat/sunat.pruebas';
import { zipUnico } from './sunat/sunat.util';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

const cajero: UsuarioAutenticado = { partyId: 2n, rol: 'CAJERO', debeCambiar: false };
const p12 = certificadoDePrueba();
const CLAVE_SOL = 'moddatos-secreta-xyz';
const env = {
  SUNAT_AMBIENTE: 'beta',
  SUNAT_SOL_USUARIO: '20000000001MODDATOS',
  SUNAT_SOL_CLAVE: CLAVE_SOL,
  SUNAT_CERT_P12_B64: p12.p12B64,
  SUNAT_CERT_CLAVE: p12.clave,
} as NodeJS.ProcessEnv;

const emisorLocal = async () => ({
  ruc: '20611290064',
  razon_social: 'GRUPO CORPORATIVO CAPRICHOS S.A.C.',
  nombre: 'CAPRICHOS CAFETERÍA ARTESANAL',
  direccion_fiscal: 'CAL. 11 MZ. D LT. 27 URB. LOS GIRASOLES DE CAMPOY, SAN JUAN DE LURIGANCHO, LIMA',
  ubigeo: '150132',
});

const cdr = (codigo: string) =>
  zipUnico(
    'R-20000000001-01-F002-1.xml',
    `<ar:ApplicationResponse xmlns:ar="urn:oasis:names:specification:ubl:schema:xsd:ApplicationResponse-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2"><cac:DocumentResponse><cac:Response><cbc:ResponseCode>${codigo}</cbc:ResponseCode><cbc:Description>Descripción SUNAT</cbc:Description></cac:Response></cac:DocumentResponse></ar:ApplicationResponse>`,
  ).toString('base64');

const sobreOk = (zipB64: string) =>
  `<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><br:sendBillResponse xmlns:br="http://service.sunat.gob.pe"><br:applicationResponse>${zipB64}</br:applicationResponse></br:sendBillResponse></soap:Body></soap:Envelope>`;

const sobreFault = (codigo: string, msg: string) =>
  `<?xml version="1.0"?><soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/"><soap-env:Body><soap-env:Fault><faultcode>${codigo}</faultcode><faultstring>${msg}</faultstring></soap-env:Fault></soap-env:Body></soap-env:Envelope>`;

const comprobanteFactura = (numero = 1) => ({
  id: 50n,
  tipo: 'FACTURA' as const,
  serie: 'F002',
  numero,
  intentos: 0,
  datos: datosDePrueba({ numero }),
});

describe('SunatEmisor (sin red real: fetch simulado)', () => {
  let logs: string[];
  beforeEach(() => {
    logs = [];
    jest.spyOn(Logger.prototype, 'error').mockImplementation((...a: any[]) => { logs.push(a.map(String).join(' ')); });
    jest.spyOn(Logger.prototype, 'warn').mockImplementation((...a: any[]) => { logs.push(a.map(String).join(' ')); });
  });
  afterEach(() => jest.restoreAllMocks());

  const crear = (fetchFn?: any, extra: Partial<ConstructorParameters<typeof SunatEmisor>[0]> = {}) =>
    new SunatEmisor({ env, emisorLocal, correlativo: async () => 1, fetchFn, ...extra });

  it('sin credenciales no está disponible; con ellas sí', () => {
    expect(new SunatEmisor({ env: {}, emisorLocal, correlativo: async () => 1 }).disponible()).toBe(false);
    expect(crear().disponible()).toBe(true);
  });

  it('boleta: firmada y lista, sin llamar a SUNAT; QR y hash con el formato de SUNAT', async () => {
    const fetchFn = jest.fn();
    const datos = datosDePrueba({ tipo: 'BOLETA', serie: 'B002', numero: 4, documento: '12345678', razon: 'ANA', fecha: new Date('2026-11-02T15:00:00Z') });
    const guardados: any[] = [];
    const r = await crear(fetchFn).generar({ id: 9n, tipo: 'BOLETA', serie: 'B002', numero: 4, intentos: 0, datos, alPreparar: async (a) => { guardados.push(...a); } });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(r.estado).toBe('PENDIENTE_RESUMEN');
    // XML y ZIP se guardan ANTES de cualquier envío (alPreparar), no en el resultado
    expect(guardados.map((a) => a.tipo)).toEqual(['XML', 'ZIP']);
    expect(guardados[0].nombre).toBe('20000000001-03-B002-4.xml');
    expect(r.hash).toMatch(/^[A-Za-z0-9+/]{43}=$/);
    // RUC|TIPO|SERIE|NUMERO|IGV|TOTAL|FECHA|TIPODOC|NUMDOC|
    expect(r.cadenaQr).toMatch(/^20000000001\|03\|B002\|4\|\d+\.\d{2}\|\d+\.\d{2}\|2026-11-02\|1\|12345678\|$/);
  });

  it('factura aceptada: sendBill con WS-Security, CDR guardada y EMITIDO_SUNAT; la clave SOL nunca se registra', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response(sobreOk(cdr('0')), { status: 200 }));
    const guardados: any[] = [];
    const r = await crear(fetchFn).generar({ ...comprobanteFactura(), alPreparar: async (a) => { guardados.push(...a); } });
    expect(r.estado).toBe('EMITIDO_SUNAT');
    expect(guardados.map((a) => a.tipo)).toEqual(['XML', 'ZIP']);
    expect(r.archivos?.map((a) => a.tipo)).toEqual(['CDR']);
    expect(r.archivos?.[0].nombre).toBe('R-20000000001-01-F002-1.xml');
    const cuerpo = String(fetchFn.mock.calls[0][1].body);
    expect(cuerpo).toContain('<wsse:Username>20000000001MODDATOS</wsse:Username>');
    expect(cuerpo).toContain('<fileName>20000000001-01-F002-1.zip</fileName>');
    expect(fetchFn.mock.calls[0][0]).toBe('https://e-beta.sunat.gob.pe/ol-ti-itcpfegem-beta/billService');
    expect(JSON.stringify(r)).not.toContain(CLAVE_SOL);
    expect(logs.join('\n')).not.toContain(CLAVE_SOL);
    expect(logs.join('\n')).not.toContain(p12.p12B64.slice(0, 40));
  });

  it('CDR con código de error: RECHAZADO con el código y la descripción', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response(sobreOk(cdr('2324')), { status: 200 }));
    const r = await crear(fetchFn).generar(comprobanteFactura());
    expect(r.estado).toBe('RECHAZADO');
    expect(r.respuesta).toContain('2324');
  });

  it('fault del cliente (credenciales) rechaza; sin respuesta queda PENDIENTE_ENVIO y el reintento reenvía el mismo ZIP', async () => {
    // Credenciales inválidas (0109): no es un rechazo del comprobante, sino una pausa de envíos (ErrorCredencialesEmisor)
    const fallo = jest.fn().mockResolvedValue(new Response(sobreFault('soap-env:Client.0109', 'Usuario o clave incorrectos'), { status: 500 }));
    await expect(crear(fallo).generar(comprobanteFactura())).rejects.toBeInstanceOf(ErrorCredencialesEmisor);
    // Un fault de cliente que no es de credenciales sí es rechazo, con su código
    const rechazoDatos = jest.fn().mockResolvedValue(new Response(sobreFault('soap-env:Client.2335', 'Dato inválido'), { status: 500 }));
    const rechazada = await crear(rechazoDatos).generar(comprobanteFactura());
    expect(rechazada.estado).toBe('RECHAZADO');
    expect(rechazada.codigoRechazo).toBe('2335');

    const caida = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
    const guardados: any[] = [];
    const pendiente = await crear(caida).generar({ ...comprobanteFactura(), alPreparar: async (a) => { guardados.push(...a); } });
    expect(pendiente.estado).toBe('PENDIENTE_ENVIO');
    const zipOriginal = guardados.find((a) => a.tipo === 'ZIP')!.contenido;

    // Antes de reenviar, SUNAT dice que no tiene la factura (statusCode 127); luego se envía el mismo ZIP
    const ok = jest
      .fn()
      .mockResolvedValueOnce(new Response(`<r><statusCode>127</statusCode></r>`, { status: 200 }))
      .mockResolvedValueOnce(new Response(sobreOk(cdr('0')), { status: 200 }));
    const reintento = await crear(ok).generar({ ...comprobanteFactura(), intentos: 1, zipPrevio: zipOriginal });
    expect(reintento.estado).toBe('EMITIDO_SUNAT');
    expect(reintento.archivos?.map((a) => a.tipo)).toEqual(['CDR']);
    expect(String(ok.mock.calls[0][1].body)).toContain('<ser:getStatusCdr>');
    expect(String(ok.mock.calls[1][1].body)).toContain(zipOriginal.toString('base64'));
  });

  it('sin ubigeo del local no se firma ni se envía: RECHAZADO con el motivo', async () => {
    const fetchFn = jest.fn();
    const sinUbigeo = crear(fetchFn, { emisorLocal: async () => ({ ...(await emisorLocal()), ubigeo: '' }) });
    const r = await sinUbigeo.generar(comprobanteFactura());
    expect(r).toMatchObject({ estado: 'RECHAZADO' });
    expect(r.respuesta).toMatch(/ubigeo/);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('consulta de ticket: 98 en proceso; 0 con CDR aceptada', async () => {
    const enProceso = jest.fn().mockResolvedValue(new Response(`<r><statusCode>98</statusCode></r>`, { status: 200 }));
    expect((await crear(enProceso).consultarTicket('123')).estado).toBe('EN_PROCESO');
    const aceptado = jest.fn().mockResolvedValue(new Response(`<r><statusCode>0</statusCode><content>${cdr('0')}</content></r>`, { status: 200 }));
    expect((await crear(aceptado).consultarTicket('123')).estado).toBe('ACEPTADO');
  });

  it('anulación: factura genera RA firmada con correlativo; boleta queda para el resumen diario', async () => {
    const emisor = crear(jest.fn(), { correlativo: async () => 3 });
    const ra = await emisor.anular(comprobanteFactura(5), 'Cobro duplicado');
    expect(ra.estado).toBe('SOLICITADA');
    expect(ra.resumen?.nombre).toBe('20000000001-RA-' + ra.resumen!.nombre.split('-')[2] + '-3');
    expect(ra.resumen?.xml.toString('utf8')).toContain('<sac:DocumentSerialID>F002</sac:DocumentSerialID>');
    const boleta = await emisor.anular({ ...comprobanteFactura(6), tipo: 'BOLETA', serie: 'B002' }, 'Error de caja');
    expect(boleta.estado).toBe('PENDIENTE_RESUMEN');
    expect(boleta.resumen).toBeUndefined();
  });

  it('0133 (fallo interno de SUNAT) no es rechazo: factura queda PENDIENTE_ENVIO; ticket y resumen sin respuesta (ErrorRedEmisor)', async () => {
    const f0133 = () => jest.fn().mockResolvedValue(new Response(sobreFault('soap-env:Client.0133', 'El sistema no puede responder su solicitud. (No se pudo grabar la entrada del log)'), { status: 500 }));
    expect((await crear(f0133()).generar(comprobanteFactura())).estado).toBe('PENDIENTE_ENVIO');
    await expect(crear(f0133()).consultarTicket('123')).rejects.toBeInstanceOf(ErrorRedEmisor);
    await expect(crear(f0133()).enviarResumen('x', zipUnico('x.xml', '<x/>'))).rejects.toBeInstanceOf(ErrorRedEmisor);
    const f2335 = jest.fn().mockResolvedValue(new Response(sobreFault('soap-env:Client.2335', 'Dato inválido'), { status: 500 }));
    expect(await crear(f2335).consultarTicket('123')).toMatchObject({ estado: 'RECHAZADO' });
  });

  it('resumen o baja enviados: sendSummary devuelve el ticket; fault del cliente devuelve el rechazo', async () => {
    const ok = jest.fn().mockResolvedValue(new Response(`<r><ticket>1700000000001</ticket></r>`, { status: 200 }));
    expect(await crear(ok).enviarResumen('20000000001-RC-20261102-1', zipUnico('x.xml', '<x/>'))).toEqual({ ticket: '1700000000001' });
    expect(String(ok.mock.calls[0][1].body)).toContain('<ser:sendSummary>');
    const fallo = jest.fn().mockResolvedValue(new Response(sobreFault('soap-env:Client.1032', 'Ya existe el resumen'), { status: 500 }));
    expect(await crear(fallo).enviarResumen('x', zipUnico('x.xml', '<x/>'))).toMatchObject({ rechazo: expect.stringContaining('1032') });
  });
});

describe('proveedor elegido y resumen diario de boletas (sin red)', () => {
  const pedidoBase = (extra: Record<string, unknown> = {}) => ({
    id: 100n,
    comprobante_tipo: 'BOLETA',
    comprobante_doc: null,
    comprobante_razon: null,
    comprobante_direccion: null,
    cliente_nombre: 'Ana',
    subtotal: 11.8,
    descuento: 0,
    envio: 0,
    total: 11.8,
    lineas: [{ nombre: 'Frappe', cantidad: 1, precio_unit: 11.8, subtotal: 11.8 }],
    ...extra,
  });

  it('con proveedor SUNAT y credenciales, la boleta queda PENDIENTE_RESUMEN con emisor SUNAT; sin credenciales cae a SIMULADO', async () => {
    const prismaMock: any = {
      $queryRaw: jest.fn(async () => [{ ultimo_numero: 1 }]),
      comprobante: {
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(async () => ({
          id: 50n,
          pedido_id: 100n,
          tipo: 'BOLETA',
          serie: 'B002',
          numero: 1,
          numero_texto: 'B002-000001',
          documento: null,
          razon_social: null,
          creado_en: new Date('2026-11-02T15:00:00Z'),
          facturacion_estado: 'PENDIENTE_ENVIO',
          facturacion_intentos: 0,
          emisor: 'SUNAT',
          simulado: false,
          pedido: pedidoBase(),
        })),
        create: jest.fn(async (a: any) => ({ id: 50n, pedido_id: 100n, creado_en: new Date('2026-11-02T15:00:00Z'), copias_impresas: 0, facturacion_intentos: 0, ...a.data, pedido: pedidoBase() })),
        update: jest.fn(async (a: any) => ({ id: 50n, pedido_id: 100n, tipo: 'BOLETA', serie: 'B002', numero: 1, emisor: 'SUNAT', creado_en: new Date('2026-11-02T15:00:00Z'), ...a.data })),
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      pedido: { findUnique: jest.fn().mockResolvedValue(pedidoBase()) },
      parametro: { findUnique: jest.fn(async ({ where }: any) => (where.clave === 'facturacion_proveedor' ? { valor: 'SUNAT' } : where.clave === 'facturacion_envio_nocturno' ? { valor: 'no' } : null)), upsert: jest.fn() },
      comprobanteArchivo: { create: jest.fn(), findFirst: jest.fn() },
    };
    const auditoria: any = { registrar: jest.fn() };
    const sunat = new SunatEmisor({ env, emisorLocal, correlativo: async () => 1, fetchFn: jest.fn() as any });
    const service = new ComprobantesService(prismaMock, auditoria, undefined, undefined, sunat);
    const fila = await service.emitirParaPedido(100n, undefined, cajero);
    expect(fila.emisor).toBe('SUNAT');
    expect(fila.facturacion_estado).toBe('PENDIENTE_RESUMEN');
    expect(prismaMock.comprobanteArchivo.create).toHaveBeenCalledTimes(2);

    const sinCred = new ComprobantesService(prismaMock, auditoria, undefined, undefined, new SunatEmisor({ env: {}, emisorLocal, correlativo: async () => 1 }));
    expect(sinCred.proveedorEfectivo('SUNAT')).toBe('SIMULADO');
    expect(service.proveedorEfectivo('SUNAT')).toBe('SUNAT');
    expect(service.proveedorEfectivo('ANTIGUO')).toBe('SIMULADO');
  });

  it('resumen diario: boletas de dos fechas dan dos RC; las anuladas van como estado 3; máximo 500 por resumen', async () => {
    const boletas = [
      { id: 1n, serie: 'B002', numero: 1, documento: null, creado_en: new Date('2026-11-01T15:00:00Z'), facturacion_estado: 'PENDIENTE_RESUMEN', baja_estado: null, sunat_total_cents: 1180, sunat_igv_cents: 112 },
      { id: 2n, serie: 'B002', numero: 2, documento: '12345678', creado_en: new Date('2026-11-01T16:00:00Z'), facturacion_estado: 'EMITIDO_SUNAT', baja_estado: 'PENDIENTE_RESUMEN', sunat_total_cents: 2000, sunat_igv_cents: 190 },
      { id: 3n, serie: 'B002', numero: 3, documento: null, creado_en: new Date('2026-11-02T15:00:00Z'), facturacion_estado: 'PENDIENTE_RESUMEN', baja_estado: null, sunat_total_cents: 500, sunat_igv_cents: 48 },
    ];
    const resumenes: any[] = [];
    let correlativo = 0;
    const prisma: any = {
      comprobante: {
        findMany: jest.fn().mockResolvedValue(boletas),
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      sunatResumen: {
        create: jest.fn(async ({ data }: any) => {
          const fila = { id: BigInt(resumenes.length + 1), ...data };
          resumenes.push(fila);
          return fila;
        }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(async ({ where }: any) => resumenes.find((r) => r.id === where.id)),
        findMany: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn(async () => [{ ultimo_numero: ++correlativo }]),
      parametro: { findMany: jest.fn().mockResolvedValue([{ clave: 'facturacion_igv_pct', valor: 10.5 }]) },
    };
    const fetchFn = jest.fn().mockResolvedValue(new Response(`<r><ticket>T1</ticket></r>`, { status: 200 }));
    const sunat = new SunatEmisor({ env, emisorLocal, correlativo: async () => 1, fetchFn });
    const job = new ComprobantesSunatService(prisma, sunat);
    const r = await job.resumenDiario(new Date('2026-11-02T03:35:00Z'));
    expect(r).toEqual({ resumenes: 2, boletas: 3 });
    expect(resumenes.map((x) => x.tipo)).toEqual(['RC', 'RC']);
    // 03:35 UTC del 2 de noviembre es 22:35 del 1 en Lima: la fecha de emisión del resumen es 20261101
    expect(resumenes[0].nombre).toMatch(/^20000000001-RC-20261101-1$/);
    expect(resumenes[0].fecha_referencia.toISOString()).toBe(new Date('2026-11-01T05:00:00Z').toISOString());
    expect(resumenes[1].nombre).toMatch(/-RC-20261101-2$/);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    // Boleta 1 pasa a ENVIADA_RESUMEN y la 2 pide baja en su resumen
    const updates = prisma.comprobante.update.mock.calls.map((c: any) => c[0].data);
    expect(updates[0]).toMatchObject({ facturacion_estado: 'ENVIADA_RESUMEN' });
    expect(updates[1]).toMatchObject({ baja_estado: 'SOLICITADA' });
    expect(prisma.sunatResumen.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ estado: 'ENVIADO', ticket: 'T1' }) }));
  });

  it('la tarea solo corre el resumen en la ventana de 23:30 a 23:39 (Lima)', () => {
    expect(horaMinutoLima(new Date('2026-11-02T03:30:00Z'))).toEqual({ h: 22, m: 30 });
    expect(horaMinutoLima(new Date('2026-11-02T14:00:00Z'))).toEqual({ h: 9, m: 0 });
  });
});
