// Mock de EventosGateway (como en el resto de specs de comprobantes)
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ComprobantesService } from './comprobantes.service';
import { ComprobantesSaludService } from './comprobantes-salud.service';
import { ComprobantesReintentosService } from './comprobantes-reintentos.service';
import { SunatEmisor } from './sunat/sunat.emisor';
import { certificadoDePrueba } from './sunat/sunat.pruebas';
import { zipUnico } from './sunat/sunat.util';
import { siguienteCorrelativo } from './secuencia';
import { crearBaseFalsa, pedidoDePrueba } from './comprobantes.fake-db';
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
const sobreAceptado = (codigo = '0') =>
  new Response(`<?xml version="1.0"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><br:sendBillResponse xmlns:br="http://service.sunat.gob.pe"><br:applicationResponse>${cdrZip(codigo)}</br:applicationResponse></br:sendBillResponse></soap:Body></soap:Envelope>`, { status: 200 });
const sobreFault = (codigo: string) =>
  new Response(`<?xml version="1.0"?><soap-env:Envelope xmlns:soap-env="http://schemas.xmlsoap.org/soap/envelope/"><soap-env:Body><soap-env:Fault><faultcode>${codigo}</faultcode><faultstring>falla</faultstring></soap-env:Fault></soap-env:Body></soap-env:Envelope>`, { status: 500 });
const consultaSinComprobante = () => new Response(`<r><statusCode>127</statusCode></r>`, { status: 200 });
const consultaConCdr = (codigo = '0') => new Response(`<r><statusCode>0</statusCode><content>${cdrZip(codigo)}</content></r>`, { status: 200 });

/** Fetch falso según la operación del sobre (sendBill o getStatusCdr). */
function fetchSunat(respuestas: { sendBill?: () => Promise<Response>; getStatusCdr?: () => Promise<Response> }) {
  return jest.fn(async (_url: string, init: any) => {
    const cuerpo = String(init.body);
    if (cuerpo.includes('<ser:getStatusCdr>')) return (respuestas.getStatusCdr ?? (async () => consultaSinComprobante()))();
    return (respuestas.sendBill ?? (async () => sobreAceptado()))();
  });
}

function montar(datos: Record<string, any[]> = {}, fetchFn: any = fetchSunat({}), opciones: { sinCredenciales?: boolean } = {}) {
  const base = crearBaseFalsa({
    pedido: [pedidoDePrueba()],
    parametro: [{ clave: 'facturacion_proveedor', valor: 'SUNAT' }],
    ...datos,
  });
  const auditoria = { registrar: jest.fn(async () => undefined) } as any;
  const sunat = new SunatEmisor({
    env: opciones.sinCredenciales ? ({} as NodeJS.ProcessEnv) : env,
    emisorLocal,
    correlativo: (clave: string) => siguienteCorrelativo(base.prisma, clave),
    fetchFn,
  });
  const salud = new ComprobantesSaludService(base.prisma, undefined, sunat);
  const servicio = new ComprobantesService(base.prisma, auditoria, undefined, undefined, sunat, undefined, salud);
  const worker = new ComprobantesReintentosService(servicio, undefined, salud);
  return { ...base, servicio, salud, worker, sunat, fetchFn, auditoria };
}

const estadosDe = (db: any) => db.comprobante.map((c: any) => c.facturacion_estado);

describe('Que no se pierda nada: outbox, reintentos, DLQ, circuito y barrido', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('la transacción del cobro hace rollback: no queda comprobante ni número consumido', async () => {
    const { prisma, db, servicio } = montar();
    await expect(
      prisma.$transaction(async (tx: any) => {
        await servicio.emitirParaPedido(100n, tx, cajero);
        throw new Error('el cobro falla después de emitir');
      }),
    ).rejects.toThrow('el cobro falla después de emitir');
    expect(db.comprobante).toHaveLength(0);
    expect(db.secuencia.F002).toBeUndefined();
  });

  it('con el cobro confirmado, la fila queda PENDIENTE_ENVIO sin red; el worker la envía una sola vez', async () => {
    const fetchFn = fetchSunat({});
    const { prisma, db, servicio, worker } = montar({}, fetchFn);
    await prisma.$transaction(async (tx: any) => servicio.emitirParaPedido(100n, tx, cajero));
    expect(fetchFn).not.toHaveBeenCalled();
    expect(estadosDe(db)).toEqual(['PENDIENTE_ENVIO']);

    // El proceso "muere" antes de enviar: el worker lo recoge después
    await worker.ejecutar();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(estadosDe(db)).toEqual(['EMITIDO_SUNAT']);

    await worker.ejecutar();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('dos caminos a la vez (envío post-commit y worker) no mandan el mismo comprobante dos veces', async () => {
    const fetchFn = fetchSunat({});
    const { prisma, db, servicio } = montar({}, fetchFn);
    await prisma.$transaction(async (tx: any) => servicio.emitirParaPedido(100n, tx, cajero));
    const id = db.comprobante[0].id;
    await Promise.all([
      servicio.enviarElectronico(id, { automatico: true }),
      servicio.enviarElectronico(id, { automatico: true }),
      servicio.reintentarPendientes(),
    ]);
    expect(fetchFn.mock.calls.filter(([, i]: any) => String(i.body).includes('<ser:sendBill>'))).toHaveLength(1);
    expect(estadosDe(db)).toEqual(['EMITIDO_SUNAT']);
  });

  it('timeout: queda PENDIENTE_ENVIO, guarda el ZIP antes de enviar y el reintento reenvía el MISMO ZIP', async () => {
    let zipEnElPrimerEnvio: string | null = null;
    const fetchFn = fetchSunat({ sendBill: async () => sobreAceptado(), getStatusCdr: async () => consultaSinComprobante() });
    const { prisma, db, servicio, fetchFn: f } = montar({}, fetchFn);
    await prisma.$transaction(async (tx: any) => servicio.emitirParaPedido(100n, tx, cajero));
    const id = db.comprobante[0].id;

    // Primer envío (la red corta): el ZIP ya está guardado en comprobanteArchivo
    fetchFn.mockImplementationOnce(async (_u: string, init: any) => {
      zipEnElPrimerEnvio = String(init.body).match(/<contentFile>([^<]+)<\/contentFile>/)![1];
      expect(db.comprobanteArchivo.some((a: any) => a.tipo === 'ZIP')).toBe(true);
      throw new Error('ETIMEDOUT');
    });
    await servicio.enviarElectronico(id, { automatico: true });
    expect(estadosDe(db)).toEqual(['PENDIENTE_ENVIO']);
    expect(db.comprobante[0].proximo_intento_en).toBeInstanceOf(Date);

    // Reintento: consulta a SUNAT (no la tiene) y reenvía el mismo ZIP
    await servicio.enviarElectronico(id, { automatico: true, usuario: cajero });
    const envios = f.mock.calls.filter(([, i]: any) => String(i.body).includes('<ser:sendBill>'));
    expect(envios.length).toBe(2);
    expect(String(envios[1][1].body)).toContain(zipEnElPrimerEnvio!);
    expect(estadosDe(db)).toEqual(['EMITIDO_SUNAT']);
  });

  it('timeout y luego SUNAT sí la tiene: el reintento NO reenvía y guarda el CDR', async () => {
    const fetchFn = fetchSunat({
      sendBill: async () => {
        throw new Error('ETIMEDOUT');
      },
      getStatusCdr: async () => consultaConCdr('0'),
    });
    const { prisma, db, servicio } = montar({}, fetchFn);
    await prisma.$transaction(async (tx: any) => servicio.emitirParaPedido(100n, tx, cajero));
    const id = db.comprobante[0].id;
    await servicio.enviarElectronico(id, { automatico: true }); // primer intento: sin respuesta
    fetchFn.mockClear();
    fetchFn.mockImplementation(async (_u: string, init: any) => {
      if (String(init.body).includes('<ser:getStatusCdr>')) return consultaConCdr('0');
      throw new Error('no debería enviarse otra vez');
    });
    await servicio.enviarElectronico(id, { automatico: true });
    expect(fetchFn.mock.calls.every(([, i]: any) => !String(i.body).includes('<ser:sendBill>'))).toBe(true);
    expect(estadosDe(db)).toEqual(['EMITIDO_SUNAT']);
    expect(db.comprobanteArchivo.some((a: any) => a.tipo === 'CDR')).toBe(true);
  });

  it('rechazo permanente (2335) pasa a REVISION_MANUAL con motivo y avisa al ADMIN', async () => {
    const fetchFn = fetchSunat({ sendBill: async () => sobreAceptado('2335') });
    const { prisma, db, servicio } = montar({}, fetchFn);
    await prisma.$transaction(async (tx: any) => servicio.emitirParaPedido(100n, tx, cajero));
    await servicio.enviarElectronico(db.comprobante[0].id, { automatico: true });
    expect(estadosDe(db)).toEqual(['REVISION_MANUAL']);
    expect(db.comprobante[0].revision_motivo).toContain('2335');
    expect(db.comprobante[0].revision_en).toBeInstanceOf(Date);
    const avisos = db.notificacion.filter((n: any) => String(n.tipo).startsWith('FACTURACION:comprobante:'));
    expect(avisos).toHaveLength(1);
    expect(avisos[0].rol_destino).toBe('ADMIN');
  });

  it('error transitorio repetido hasta agotar intentos pasa a REVISION_MANUAL', async () => {
    const fetchFn = fetchSunat({ sendBill: async () => Promise.reject(new Error('ECONNRESET')) });
    const { prisma, db, servicio } = montar({ parametro: [{ clave: 'facturacion_proveedor', valor: 'SUNAT' }, { clave: 'facturacion_max_intentos', valor: 3 }] }, fetchFn);
    await prisma.$transaction(async (tx: any) => servicio.emitirParaPedido(100n, tx, cajero));
    const id = db.comprobante[0].id;
    for (let i = 0; i < 2; i++) await servicio.enviarElectronico(id, { automatico: true });
    expect(estadosDe(db)).toEqual(['PENDIENTE_ENVIO']);
    await servicio.enviarElectronico(id, { automatico: true });
    expect(estadosDe(db)).toEqual(['REVISION_MANUAL']);
    expect(db.comprobante[0].facturacion_intentos).toBe(3);
  });

  it('credenciales inválidas: pausan los envíos, dejan PENDIENTE_ENVIO y avisan una sola vez', async () => {
    const fetchFn = fetchSunat({ sendBill: async () => sobreFault('soap-env:Client.0102') });
    const { prisma, db, servicio, salud, worker } = montar({}, fetchFn);
    await prisma.$transaction(async (tx: any) => servicio.emitirParaPedido(100n, tx, cajero));
    await servicio.enviarElectronico(db.comprobante[0].id, { automatico: true });
    expect(estadosDe(db)).toEqual(['PENDIENTE_ENVIO']);
    expect(await salud.circuitoAbierto()).toBe(true);
    const n = fetchFn.mock.calls.length;
    await worker.ejecutar();
    expect(fetchFn.mock.calls.length).toBe(n); // pausado: no martillea
    await servicio.enviarElectronico(db.comprobante[0].id, { automatico: true });
    expect(db.notificacion.filter((x: any) => String(x.tipo).includes('credenciales'))).toHaveLength(1);
  });

  it('circuito: N fallos seguidos pausan el envío y avisan una vez; un éxito lo cierra', async () => {
    const fetchFn = fetchSunat({ sendBill: async () => Promise.reject(new Error('ECONNRESET')) });
    const { prisma, db, servicio, salud } = montar({ parametro: [{ clave: 'facturacion_proveedor', valor: 'SUNAT' }, { clave: 'facturacion_circuito_fallos', valor: 2 }] }, fetchFn);
    await prisma.$transaction(async (tx: any) => servicio.emitirParaPedido(100n, tx, cajero));
    const id = db.comprobante[0].id;
    await servicio.enviarElectronico(id, { automatico: true });
    await servicio.enviarElectronico(id, { automatico: true });
    expect(await salud.circuitoAbierto()).toBe(true);
    const r = await servicio.reintentarPendientes();
    expect(r.motivo).toBe('CIRCUITO_ABIERTO');
    expect(db.notificacion.filter((n: any) => String(n.tipo).includes('circuito'))).toHaveLength(1);
    // Pasada la pausa, la prueba sale bien y el circuito se cierra
    expect(await salud.circuitoAbierto(new Date(Date.now() + 6 * 60_000))).toBe(false);
    await salud.registrarExito(); // una respuesta de SUNAT cierra el circuito
    expect(await salud.circuitoAbierto()).toBe(false);
  });

  it('barrido: sin fecha de corte no hace nada; pedido anterior al corte NO se emite; posterior sin comprobante se crea UNA vez', async () => {
    const haceDias = (d: number) => new Date(Date.now() - d * 86_400_000);
    const pedidos = [
      pedidoDePrueba({ id: 1n, codigo: 'VIEJO' }),
      pedidoDePrueba({ id: 2n, codigo: 'NUEVO' }),
    ];
    const cobros = [
      { id: 1n, pedido_id: 1n, en: haceDias(5), anulado_en: null },
      { id: 2n, pedido_id: 2n, en: new Date(Date.now() - 3600_000), anulado_en: null },
    ];
    const datos = { pedido: pedidos, cobro: cobros };
    const { servicio, db } = montar({
      ...datos,
      parametro: [{ clave: 'facturacion_proveedor', valor: 'SUNAT' }],
    });
    expect(await servicio.barrerPedidosSinComprobante()).toMatchObject({ creados: 0, motivo: 'SIN_FECHA_DE_CORTE' });
    expect(db.comprobante).toHaveLength(0);

    // Corte hace 2 días: el pedido de hace 5 días queda fuera; el de hace 1 hora entra
    db.parametro.push({ clave: 'facturacion_desde', valor: haceDias(2).toISOString() });
    const primera = await servicio.barrerPedidosSinComprobante();
    expect(primera.creados).toBe(1);
    expect(db.comprobante.map((c: any) => c.pedido_id)).toEqual([2n]);
    // Segunda pasada: ya tiene comprobante, no crea otro
    const segunda = await servicio.barrerPedidosSinComprobante();
    expect(segunda.creados).toBe(0);
    expect(db.comprobante).toHaveLength(1);
  });

  it('barrido en SIMULADO solo registra: no crea filas aunque haya pedidos candidatos', async () => {
    const { servicio, db } = montar(
      {
        pedido: [pedidoDePrueba({ id: 2n })],
        cobro: [{ id: 1n, pedido_id: 2n, en: new Date(Date.now() - 3600_000), anulado_en: null }],
        parametro: [{ clave: 'facturacion_proveedor', valor: 'SUNAT' }, { clave: 'facturacion_desde', valor: new Date(Date.now() - 86_400_000).toISOString() }],
      },
      fetchSunat({}),
      { sinCredenciales: true },
    );
    const r = await servicio.barrerPedidosSinComprobante();
    expect(r).toMatchObject({ creados: 0, encontrados: 1, motivo: 'SIMULADO' });
    expect(db.comprobante).toHaveLength(0);
  });
});
