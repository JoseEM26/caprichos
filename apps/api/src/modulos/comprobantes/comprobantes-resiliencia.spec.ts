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

  it('0133 de SUNAT: queda PENDIENTE_ENVIO (no RECHAZADO) y un RECHAZADO por 0133 se reintenta con el mismo ZIP', async () => {
    const fetchFn = fetchSunat({ sendBill: async () => sobreFault('soap-env:Client.0133') });
    const { prisma, db, servicio, fetchFn: f } = montar({}, fetchFn);
    await prisma.$transaction(async (tx: any) => servicio.emitirParaPedido(100n, tx, cajero));
    const id = db.comprobante[0].id;
    await servicio.enviarElectronico(id, { automatico: true });
    expect(estadosDe(db)).toEqual(['PENDIENTE_ENVIO']);

    // Caso ya existente en producción: quedó RECHAZADO con 0133; Reintentar reenvía el mismo ZIP
    db.comprobante[0].facturacion_estado = 'RECHAZADO';
    db.comprobante[0].facturacion_respuesta = '0133: El sistema no puede responder su solicitud';
    fetchFn.mockImplementation(async (_u: string, init: any) =>
      String(init.body).includes('<ser:getStatusCdr>') ? consultaSinComprobante() : sobreAceptado());
    await servicio.reintentarElectronico(id, {}, cajero);
    const envios = f.mock.calls.filter(([, i]: any) => String(i.body).includes('<ser:sendBill>'));
    const zip = (n: number) => String(envios[n][1].body).match(/<contentFile>([^<]+)<\/contentFile>/)![1];
    expect(zip(1)).toBe(zip(0));
    expect(estadosDe(db)).toEqual(['EMITIDO_SUNAT']);
  });

  it('error inesperado al reintentar: HttpException con codigo y mensaje legibles, y se registra', async () => {
    const { prisma, servicio } = montar();
    jest.spyOn(prisma.comprobante, 'findUnique').mockRejectedValue(new Error('conexión perdida\ndetalle'));
    await expect(servicio.reintentarElectronico(1n, {}, cajero)).rejects.toMatchObject({
      response: { codigo: 'REENVIO_FALLIDO', mensaje: expect.stringContaining('No pudimos reenviar a SUNAT: conexión perdida') },
    });
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

describe('Reenvío seguro: consulta rota, ya registrada (1033) y recuperación de la constancia', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  /** Auditoría que sí escribe en la base falsa, para comprobar que CONSULTA_CDR_FALLO sale una sola vez. */
  function auditoriaEnBase(m: ReturnType<typeof montar>) {
    m.auditoria.registrar.mockImplementation(async (a: any) => {
      m.db.auditoria.push({ accion: a.accion, entidad: a.entidad, entidad_id: a.entidadId });
    });
    return m;
  }
  const accionesAuditadas = (db: any, accion: string) => db.auditoria.filter((a: any) => a.accion === accion).length;

  it('consulta que falla (fault): reenvía el MISMO ZIP una sola vez y audita CONSULTA_CDR_FALLO una vez', async () => {
    const fetchFn = fetchSunat({
      sendBill: async () => sobreAceptado(),
      getStatusCdr: async () => sobreFault('soap-env:Server.internal'),
    });
    const m = auditoriaEnBase(montar({}, fetchFn));
    const { prisma, db, servicio, f } = { ...m, f: m.fetchFn };
    await prisma.$transaction(async (tx: any) => servicio.emitirParaPedido(100n, tx, cajero));
    const id = db.comprobante[0].id;
    const numeroAntes = db.comprobante[0].numero_texto;

    // Primer envío sin respuesta: el ZIP queda guardado
    fetchFn.mockImplementationOnce(async () => {
      throw new Error('ETIMEDOUT');
    });
    await servicio.enviarElectronico(id, { automatico: true });
    const hashAntes = db.comprobante[0].facturacion_hash;
    expect(estadosDe(db)).toEqual(['PENDIENTE_ENVIO']);

    // Reintento: la consulta falla, se reenvía el mismo ZIP y se acepta
    await servicio.enviarElectronico(id, { automatico: true });
    const envios = f.mock.calls.filter(([, i]: any) => String(i.body).includes('<ser:sendBill>'));
    expect(envios).toHaveLength(2);
    expect(String(envios[1][1].body)).toContain(String(envios[0][1].body).match(/<contentFile>([^<]+)<\/contentFile>/)![1]);
    expect(estadosDe(db)).toEqual(['EMITIDO_SUNAT']);
    expect(db.comprobante[0].facturacion_hash).toBe(hashAntes);
    expect(db.comprobante[0].numero_texto).toBe(numeroAntes);
    expect(accionesAuditadas(db, 'CONSULTA_CDR_FALLO')).toBe(1);
  });

  it('consulta que falla en cada intento: se audita una sola vez por comprobante', async () => {
    const fetchFn = fetchSunat({
      sendBill: async () => {
        throw new Error('ETIMEDOUT');
      },
      getStatusCdr: async () => {
        throw new Error('ECONNRESET');
      },
    });
    const m = auditoriaEnBase(montar({ parametro: [{ clave: 'facturacion_proveedor', valor: 'SUNAT' }, { clave: 'facturacion_max_intentos', valor: 12 }] }, fetchFn));
    const { prisma, db, servicio } = m;
    await prisma.$transaction(async (tx: any) => servicio.emitirParaPedido(100n, tx, cajero));
    const id = db.comprobante[0].id;
    for (let i = 0; i < 3; i++) await servicio.enviarElectronico(id, { automatico: true });
    expect(db.comprobante[0].facturacion_intentos).toBe(3);
    expect(estadosDe(db)).toEqual(['PENDIENTE_ENVIO']);
    expect(accionesAuditadas(db, 'CONSULTA_CDR_FALLO')).toBe(1);
  });

  it('1033 (ya registrada): EMITIDO_SUNAT sin reenviar, aviso de prioridad media y la constancia se recupera en la siguiente pasada', async () => {
    const fetchFn = fetchSunat({
      sendBill: async () => sobreFault('soap-env:Client.1033'),
      getStatusCdr: async () => consultaSinComprobante(),
    });
    const { prisma, db, servicio, worker } = montar({}, fetchFn);
    await prisma.$transaction(async (tx: any) => servicio.emitirParaPedido(100n, tx, cajero));
    const id = db.comprobante[0].id;
    await servicio.enviarElectronico(id, { automatico: true });
    expect(estadosDe(db)).toEqual(['EMITIDO_SUNAT']);
    expect(db.comprobante[0].facturacion_respuesta).toBe('Registrada previamente en SUNAT; constancia (CDR) no recuperada');
    expect(db.comprobante[0].facturacion_hash).toBeTruthy();
    const alerta = db.notificacion.find((n: any) => n.tipo === `FACTURACION:registrada-previa:${id}`);
    expect(alerta).toBeDefined();
    expect(alerta.titulo.startsWith('URGENTE')).toBe(false);
    expect(alerta.rol_destino).toBe('ADMIN');

    // Siguiente pasada: SUNAT ya da la constancia; no se envía nada y se guarda el CDR
    fetchFn.mockClear();
    fetchFn.mockImplementation(async (_u: string, init: any) => {
      if (String(init.body).includes('<ser:getStatusCdr>')) return consultaConCdr('0');
      throw new Error('no debería enviarse otra vez');
    });
    await worker.ejecutar();
    expect(fetchFn.mock.calls.every(([, i]: any) => !String(i.body).includes('<ser:sendBill>'))).toBe(true);
    expect(db.comprobante[0].facturacion_respuesta).not.toContain('no recuperada');
    expect(db.comprobanteArchivo.some((a: any) => a.tipo === 'CDR')).toBe(true);
    expect(estadosDe(db)).toEqual(['EMITIDO_SUNAT']);
  });
});

describe('Constancia recuperada: CDR rechazada y alerta 1033 con datos para comparar', () => {
  beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  async function yaRegistradaSinCdr() {
    const fetchFn = fetchSunat({
      sendBill: async () => sobreFault('soap-env:Client.1033'),
      getStatusCdr: async () => consultaSinComprobante(),
    });
    const m = montar({}, fetchFn);
    await m.prisma.$transaction(async (tx: any) => m.servicio.emitirParaPedido(100n, tx, cajero));
    const id = m.db.comprobante[0].id;
    await m.servicio.enviarElectronico(id, { automatico: true });
    return { ...m, id, fetchFn };
  }

  it('la CDR recuperada viene RECHAZADA: REVISION_MANUAL con el motivo de la CDR, auditoría y aviso ADMIN prioridad alta', async () => {
    const { db, worker, fetchFn, auditoria, id } = await yaRegistradaSinCdr();
    fetchFn.mockImplementation(async (_u: string, init: any) => {
      if (String(init.body).includes('<ser:getStatusCdr>')) return consultaConCdr('2335');
      throw new Error('no debería enviarse');
    });
    await worker.ejecutar();
    const fila = db.comprobante[0];
    expect(fila.facturacion_estado).toBe('REVISION_MANUAL');
    expect(fila.emision).toBe('POR_EMITIR');
    expect(fila.revision_motivo).toContain('2335');
    expect(fila.revision_motivo).toContain('Descripción SUNAT');
    expect(db.comprobanteArchivo.some((a: any) => a.tipo === 'CDR')).toBe(true);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CDR_RECHAZADA_EN_RECUPERACION', entidadId: id }));
    const aviso = db.notificacion.find((n: any) => n.tipo === `FACTURACION:cdr-rechazada:${id}`);
    expect(aviso).toBeDefined();
    expect(aviso.titulo.startsWith('URGENTE')).toBe(true);
    expect(aviso.rol_destino).toBe('ADMIN');
    // Ya no es un comprobante a recuperar: la siguiente pasada no vuelve a consultar
    fetchFn.mockClear();
    await worker.ejecutar();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('1033: el aviso dice que SUNAT podría tener otro documento y trae hash y total para comparar en SOL', async () => {
    const { db, id } = await yaRegistradaSinCdr();
    const fila = db.comprobante[0];
    const aviso = db.notificacion.find((n: any) => n.tipo === `FACTURACION:registrada-previa:${id}`);
    expect(aviso).toBeDefined();
    expect(aviso.mensaje).toContain('DISTINTO');
    expect(aviso.mensaje).toContain('SOL');
    expect(aviso.mensaje).toContain(fila.facturacion_hash);
    expect(aviso.mensaje).toContain(`S/ ${(fila.sunat_total_cents / 100).toFixed(2)}`);
    expect(aviso.mensaje).toContain('fecha de emisión');
  });
});
