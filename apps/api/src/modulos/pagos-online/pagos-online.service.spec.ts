jest.mock('../pedidos-admin/pedidos-estado.service', () => ({ PedidosEstadoService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { createHmac } from 'crypto';
import { PagosOnlineService } from './pagos-online.service';
import { SimuladoAdaptador, TOKEN_3DS } from './simulado.adaptador';
import { CulqiAdaptador } from './culqi.adaptador';
import { crearPasarela } from './pasarela.fabrica';
import { ErrorPasarela, PasarelaPago } from './pasarela.puerto';
import { pagosOnlineDe } from '../pedidos-admin/pago-online-resumen';
import { comisionDeCargoCulqi, comisionEstimada } from './comision-pasarela';
import { mensajeDeError } from './culqi.errores';
import { PagosOnlineVencimientoService } from './pagos-online-vencimiento.service';
import { generarTokenSeguimiento } from '../pedidos/seguimiento.tokens';
import { medioDelToken, medioDeFuenteCulqi, tarjetaDeFuenteCulqi } from './medio-real';

// Datos sintéticos: nada real
function armar(opts: { activo?: boolean; pasarela?: PasarelaPago; pedido?: Partial<any>; cajaAbierta?: boolean } = {}) {
  const pedido: any = {
    id: 7n, codigo: 'P-0007', canal: 'CARTA', estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE', es_personal: false,
    total: 50.5, monto_credito: 0, propina: 2, planPago: [], cobros: [], modalidad: 'RECOGER',
    comprobante_tipo: 'SIMPLE', comprobante_doc: null, comprobante_razon: null, cliente_party_id: null, party_id: null,
    pasa_cocina_en: null, pago_coordinado_en: null, ...opts.pedido,
  };
  const intentos: any[] = [];
  const pagoCulqi: any = { id: 1n, origen: 'CULQI', comision_pasarela: null, comision_detalle: null };
  const eventos: any[] = [];
  let seq = 1;
  const cumple = (i: any, w: any): boolean =>
    Object.entries(w).every(([k, v]: [string, any]) => {
      if (k === 'OR') return v.some((x: any) => cumple(i, x));
      if (v && typeof v === 'object' && 'in' in v) return v.in.includes(i[k]);
      return i[k] === v;
    });
  const prisma: any = {
    parametro: { findUnique: jest.fn().mockResolvedValue({ valor: { CARTA: { PAGO_EN_LINEA: opts.activo !== false } } }) },
    caja: { findUnique: jest.fn().mockResolvedValue({ estado: opts.cajaAbierta === false ? 'CERRADA' : 'ABIERTA' }), findFirst: jest.fn().mockResolvedValue(null) },
    pedido: {
      findUnique: jest.fn(async () => pedido),
      findUniqueOrThrow: jest.fn(async () => pedido),
      update: jest.fn(async ({ data }: any) => Object.assign(pedido, data)),
    },
    pedidoEstadoHistorial: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (fn: any) => fn({ caja: { findUnique: jest.fn().mockResolvedValue({ id: 1n, estado: 'ABIERTA' }) }, $queryRaw: jest.fn().mockResolvedValue([{ id: 1n, estado: 'ABIERTA' }]), movimientoCaja: { create: jest.fn().mockResolvedValue({ id: 55n }) } })),
    userAccount: { findFirst: jest.fn().mockResolvedValue({ party_id: 99n }) },
    cobro: { findFirst: jest.fn().mockResolvedValue({ id: 31n, caja: { estado: 'ABIERTA' } }) },
    notificacion: { create: jest.fn().mockResolvedValue({}) },
    cobroPago: {
      findFirst: jest.fn(async () => pagoCulqi),
      findMany: jest.fn(async () => [{ ...pagoCulqi, cobro: { pedido_id: 7n } }]),
      update: jest.fn(async ({ data }: any) => Object.assign(pagoCulqi, data)),
    },
    pagoOnlineIntento: {
      findUnique: jest.fn(async ({ where }: any) => {
        const i = intentos.find((x) => Object.entries(where).every(([k, v]) => x[k] === v));
        return i ? { ...i, pedido: { id: pedido.id, codigo: pedido.codigo, estado: pedido.estado } } : null;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => intentos.find((x) => x.id === where.id)),
      count: jest.fn(async () => intentos.length),
      aggregate: jest.fn(async () => ({
        _sum: {
          monto_centimos: intentos.filter((x) => ['APROBADO', 'DEVUELTO'].includes(x.estado)).reduce((t, x) => t + x.monto_centimos, 0),
          devuelto_centimos: intentos.reduce((t, x) => t + (x.devuelto_centimos ?? 0), 0),
        },
      })),
      findMany: jest.fn(async () => intentos.map((i) => ({ ...i, pedido: { codigo: pedido.codigo, estado: pedido.estado } }))),
      findFirst: jest.fn(async ({ where }: any) => intentos.find((x) => cumple(x, where)) ?? null),
      create: jest.fn(async ({ data }: any) => {
        if (intentos.some((x) => x.pedido_id === data.pedido_id && ['CREADO', 'PROCESANDO', 'PENDIENTE', 'APROBADO'].includes(x.estado))) throw { code: 'P2002' };
        const i = { id: BigInt(seq++), estado: 'CREADO', moneda: 'PEN', medio: null, mensaje: null, culqi_cargo_id: null, cobrado_en: null, cobro_error: null, devuelto_centimos: 0, devoluciones: [], marca: null, ultimos4: null, aprobado_en: null, ...data };
        intentos.push(i);
        return i;
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(intentos.find((x) => x.id === where.id), data)),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const coinc = intentos.filter((x) => cumple(x, where));
        coinc.forEach((x) => {
          for (const [k, v] of Object.entries<any>(data)) x[k] = v && typeof v === 'object' && 'decrement' in v ? x[k] - v.decrement : v;
        });
        return { count: coinc.length };
      }),
    },
    pagoOnlineEvento: {
      create: jest.fn(async ({ data }: any) => {
        if (eventos.some((e) => e.evento_id === data.evento_id)) throw { code: 'P2002' };
        eventos.push({ estado: 'RECIBIDO', ...data });
      }),
      findUnique: jest.fn(async ({ where }: any) => eventos.find((e) => e.evento_id === where.evento_id) ?? null),
      update: jest.fn(async ({ where, data }: any) => Object.assign(eventos.find((e) => e.evento_id === where.evento_id), data)),
    },
  };
  const cobros = { cobrar: jest.fn().mockResolvedValue({}), anularCobro: jest.fn().mockResolvedValue({}), anularCobroCajaCerrada: jest.fn().mockResolvedValue({}) };
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const pasarela = opts.pasarela ?? new SimuladoAdaptador();
  const gateway: any = { emitirAdmin: jest.fn() };
  const avisos = { avisar: jest.fn().mockResolvedValue({ estado: 'ENCOLADO' }) };
  const s = new PagosOnlineService(prisma, auditoria as any, cobros as any, pasarela, gateway, undefined, avisos as any);
  const acceso = { seguimientoToken: generarTokenSeguimiento(pedido.id) };
  return { s, prisma, cobros, auditoria, pedido, intentos, eventos, acceso, pasarela, pagoCulqi, gateway, avisos };
}

describe('PagosOnlineService', () => {
  const admin = { partyId: '1', rol: 'ADMIN', roles: ['ADMIN'] };

  it('apagado por defecto: sin parámetro en "si" no hay intento ni cargo', async () => {
    const { s, acceso } = armar({ activo: false });
    await expect(s.crearIntento('7', acceso)).rejects.toMatchObject({ response: { codigo: 'PAGO_ONLINE_APAGADO' } });
    await expect(s.cargar({ intentoId: 'x', token: 'tkn_simulado_ok', medio: 'TARJETA' })).rejects.toMatchObject({ response: { codigo: 'PAGO_ONLINE_APAGADO' } });
    expect((await s.config()).activo).toBe(false);
  });

  it('sin la caja de hoy abierta (local cerrado): la carta no ofrece el pago en línea aunque el interruptor esté encendido', async () => {
    const { s } = armar({ cajaAbierta: false });
    expect((await s.config()).activo).toBe(false);
    expect((await armar({ cajaAbierta: true }).s.config()).activo).toBe(true);
  });

  it('producción sin llaves de Culqi: interruptor encendido pero config.activo=false y no hay intento', async () => {
    const previo = { n: process.env.NODE_ENV, a: process.env.AMBIENTE_DESPLIEGUE };
    process.env.NODE_ENV = 'production';
    delete process.env.AMBIENTE_DESPLIEGUE;
    try {
      const { s, acceso } = armar();
      expect((await s.config()).activo).toBe(false);
      await expect(s.crearIntento('7', acceso)).rejects.toMatchObject({ response: { codigo: 'PAGO_ONLINE_APAGADO' } });
    } finally {
      process.env.NODE_ENV = previo.n;
      if (previo.a !== undefined) process.env.AMBIENTE_DESPLIEGUE = previo.a;
    }
  });

  it('el intento toma el monto del servidor (total + propina), no del cliente', async () => {
    const { s, acceso } = armar();
    const r = await s.crearIntento('7', { ...acceso });
    expect(r).toMatchObject({ montoCentimos: 5250, moneda: 'PEN', publicKey: null, modo: 'SIMULADO', medios: ['TARJETA', 'YAPE'], descripcion: 'Pedido P-0007 - Caprichos' });
    // repetir devuelve el mismo intento
    expect((await s.crearIntento('7', acceso)).intentoId).toBe(r.intentoId);
  });

  it('sin token de seguimiento ni sesión del dueño: 403', async () => {
    const { s } = armar();
    await expect(s.crearIntento('7', { seguimientoToken: 'malo' })).rejects.toMatchObject({ response: { codigo: 'SIN_ACCESO' } });
    const ok = armar({ pedido: { cliente_party_id: 5n } });
    await expect(ok.s.crearIntento('7', { clientePartyId: 5n })).resolves.toHaveProperty('intentoId');
  });

  it('pedido ya pagado, anulado o sin caja abierta: no se crea intento', async () => {
    await expect(armar({ pedido: { pago_estado: 'PAGADO' } }).s.crearIntento('7', armar().acceso)).rejects.toMatchObject({ response: { codigo: 'YA_PAGADO' } });
    await expect(armar({ pedido: { estado: 'ANULADO' } }).s.crearIntento('7', armar().acceso)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_ANULADO' } });
    await expect(armar({ cajaAbierta: false }).s.crearIntento('7', armar().acceso)).rejects.toMatchObject({ response: { codigo: 'LOCAL_SIN_CAJA' } });
  });

  it('cargo aprobado: cobra con el flujo de Caja, medio TARJETA, y el pedido queda aprobado para cocina', async () => {
    const { s, acceso, cobros, pedido, intentos, gateway } = armar();
    const { intentoId } = await s.crearIntento('7', acceso);
    expect(gateway.emitirAdmin).not.toHaveBeenCalledWith('pedido:nuevo', expect.anything());
    const r = await s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' });
    expect(r).toMatchObject({ estado: 'APROBADO', pedidoCodigo: 'P-0007' });
    expect(cobros.cobrar).toHaveBeenCalledTimes(1);
    const [dto] = cobros.cobrar.mock.calls[0];
    expect(dto.pagos).toEqual([{ medio: 'TARJETA', monto: 52.5 }]);
    // El cobro se marca como venido de la pasarela: en Caja y en el cierre se distingue del Yape/POS del local
    expect(dto.origen).toBe('CULQI');
    expect((await s.listar({})).totalAprobado).toBe(52.5);
    expect(pedido.pago_coordinado_en).toBeInstanceOf(Date);
    expect(pedido.pasa_cocina_en).toBeInstanceOf(Date);
    expect(pedido.estado).toBe('COLA');
    expect(gateway.emitirAdmin).toHaveBeenCalledWith('pedido:nuevo', expect.objectContaining({ codigo: 'P-0007', estado: 'COLA' }));
    expect(intentos[0]).toMatchObject({ estado: 'APROBADO', ultimos4: '1111' });
    expect(intentos[0].cobrado_en).toBeInstanceOf(Date);
  });

  it('el «recibimos tu pedido» por WhatsApp sale recién al aprobarse el pago (no al crearlo sin pagar)', async () => {
    const { s, acceso, avisos } = armar();
    const { intentoId } = await s.crearIntento('7', acceso);
    expect(avisos.avisar).not.toHaveBeenCalled();
    await s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' });
    expect(avisos.avisar).toHaveBeenCalledWith(expect.anything(), 'RECIBIDO', {});
  });

  it('Yape aprobado queda como YAPE', async () => {
    const { s, acceso, cobros } = armar();
    const { intentoId } = await s.crearIntento('7', acceso);
    expect((await s.cargar({ intentoId, token: 'ype_simulado_ok', medio: 'YAPE' })).estado).toBe('APROBADO');
    expect(cobros.cobrar.mock.calls[0][0].pagos[0].medio).toBe('YAPE');
  });

  it('cargo rechazado: no cobra ni toca el pedido; el token de rechazo da mensaje de tarjeta rechazada', async () => {
    const { s, acceso, cobros, pedido } = armar();
    const { intentoId } = await s.crearIntento('7', acceso);
    const r = await s.cargar({ intentoId, token: 'tkn_simulado_rechazo', medio: 'TARJETA' });
    expect(r.estado).toBe('RECHAZADO');
    expect(r.mensaje).toMatch(/tarjeta fue rechazada/);
    expect(cobros.cobrar).not.toHaveBeenCalled();
    expect(pedido.pago_coordinado_en).toBeNull();
    expect(pedido.estado).toBe('POR_PAGAR');
    const otro = armar();
    const i2 = await otro.s.crearIntento('7', otro.acceso);
    expect((await otro.s.cargar({ intentoId: i2.intentoId, token: 'cualquiera_123', medio: 'TARJETA' })).estado).toBe('RECHAZADO');
  });

  it('idempotencia: reintentar el cargo no cobra dos veces', async () => {
    const pasarela = new SimuladoAdaptador();
    const espia = jest.spyOn(pasarela, 'cargar');
    const { s, acceso, cobros } = armar({ pasarela });
    const { intentoId } = await s.crearIntento('7', acceso);
    const a = await s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' });
    const b = await s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' });
    expect(a.estado).toBe('APROBADO');
    expect(b.estado).toBe('APROBADO');
    expect(espia).toHaveBeenCalledTimes(1);
    expect(cobros.cobrar).toHaveBeenCalledTimes(1);
  });

  it('dos cargos a la vez: solo uno llama a la pasarela', async () => {
    const pasarela = new SimuladoAdaptador();
    const espia = jest.spyOn(pasarela, 'cargar');
    const { s, acceso } = armar({ pasarela });
    const { intentoId } = await s.crearIntento('7', acceso);
    const [a, b] = await Promise.all([
      s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' }),
      s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' }),
    ]);
    expect(espia).toHaveBeenCalledTimes(1);
    expect([a.estado, b.estado]).toContain('APROBADO');
  });

  it('pasarela sin respuesta: queda PENDIENTE (no se rechaza) y no se cobra en Caja', async () => {
    const pasarela = new SimuladoAdaptador();
    jest.spyOn(pasarela, 'cargar').mockRejectedValue(new ErrorPasarela('x'));
    const { s, acceso, cobros } = armar({ pasarela });
    const { intentoId } = await s.crearIntento('7', acceso);
    expect((await s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' })).estado).toBe('PENDIENTE');
    expect(cobros.cobrar).not.toHaveBeenCalled();
  });

  it('cobro de Caja falla tras aprobar: devuelve PENDIENTE, avisa al equipo y deja el error a la vista', async () => {
    const { s, acceso, cobros, prisma, intentos } = armar();
    cobros.cobrar.mockRejectedValue(new Error('caja cerrada'));
    const { intentoId } = await s.crearIntento('7', acceso);
    const r = await s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' });
    expect(r.estado).toBe('PENDIENTE');
    expect(intentos[0].cobro_error).toBe('caja cerrada');
    expect(prisma.notificacion.create).toHaveBeenCalled();
  });

  it('si cambia el total tras crear el intento, no se cobra', async () => {
    const { s, acceso, pedido, pasarela } = armar();
    const espia = jest.spyOn(pasarela, 'cargar');
    const { intentoId } = await s.crearIntento('7', acceso);
    pedido.total = 99;
    await expect(s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' })).rejects.toMatchObject({ response: { codigo: 'MONTO_CAMBIO' } });
    expect(espia).not.toHaveBeenCalled();
  });

  it('3DS: el primer cargo da REQUIERE_3DS sin rechazar; el segundo con autenticacion3ds aprueba una sola vez', async () => {
    const { s, acceso, cobros, intentos } = armar();
    const { intentoId } = await s.crearIntento('7', acceso);
    const r1 = await s.cargar({ intentoId, token: TOKEN_3DS, medio: 'TARJETA' });
    expect(r1).toMatchObject({ estado: 'REQUIERE_3DS', datos3ds: { montoCentimos: 5250, moneda: 'PEN' } });
    expect(intentos[0].estado).toBe('CREADO');
    expect(cobros.cobrar).not.toHaveBeenCalled();
    const r2 = await s.cargar({ intentoId, token: TOKEN_3DS, medio: 'TARJETA', autenticacion3ds: { cavv: 'x', eci: '05' } });
    expect(r2.estado).toBe('APROBADO');
    await s.cargar({ intentoId, token: TOKEN_3DS, medio: 'TARJETA', autenticacion3ds: { cavv: 'x' } });
    expect(cobros.cobrar).toHaveBeenCalledTimes(1);
  });

  describe('webhook', () => {
    const evento = (id: string, tipo: string, data: any) => ({ id, type: tipo, data: JSON.stringify(data) });

    const sembrar = (pasarela: any, intentoId: string, id: string, extra: Partial<any> = {}) =>
      pasarela.sembrarCargo({ cargoId: id, estado: 'APROBADO', montoCentimos: 5250, moneda: 'PEN', metadata: { intento: intentoId }, devueltoCentimos: 0, ...extra });

    it('evento duplicado: se procesa una sola vez', async () => {
      const { s, acceso, cobros, intentos, pasarela } = armar();
      const { intentoId } = await s.crearIntento('7', acceso);
      sembrar(pasarela, intentoId, 'chr_x1');
      intentos[0].estado = 'PENDIENTE';
      intentos[0].medio = 'YAPE';
      const ev = evento('evt_1', 'charge.creation.succeeded', { id: 'chr_x1', amount: 5250, metadata: { intento: intentoId } });
      expect(await s.recibirWebhook(ev)).toEqual({ recibido: true });
      expect(await s.recibirWebhook(ev)).toEqual({ recibido: true, duplicado: true });
      expect(cobros.cobrar).toHaveBeenCalledTimes(1);
      expect(intentos[0]).toMatchObject({ estado: 'APROBADO', culqi_cargo_id: 'chr_x1' });
    });

    it('el cuerpo no aprueba: si Culqi no conoce el cargo o dice otro monto, no se cobra', async () => {
      const { s, acceso, intentos, eventos, cobros, pasarela } = armar();
      const { intentoId } = await s.crearIntento('7', acceso);
      intentos[0].estado = 'PENDIENTE';
      // el cuerpo dice 5250 pero la consulta no encuentra el cargo
      expect((await s.recibirWebhook(evento('evt_0', 'charge.creation.succeeded', { id: 'chr_inexistente', amount: 5250, metadata: { intento: intentoId } }))).recibido).toBe(true);
      expect(eventos[0].estado).toBe('IGNORADO');
      expect(cobros.cobrar).not.toHaveBeenCalled();
      // el cuerpo dice 5250 pero la API dice 100
      sembrar(pasarela, intentoId, 'chr_x2', { montoCentimos: 100 });
      await expect(s.recibirWebhook(evento('evt_2b', 'charge.creation.succeeded', { id: 'chr_x2', amount: 5250, metadata: { intento: intentoId } }))).rejects.toThrow();
      expect(cobros.cobrar).not.toHaveBeenCalled();
    });

    it('un monto distinto al del servidor no aprueba', async () => {
      const { s, acceso, intentos, eventos, cobros, pasarela } = armar();
      const { intentoId } = await s.crearIntento('7', acceso);
      sembrar(pasarela, intentoId, 'chr_x2', { montoCentimos: 100 });
      intentos[0].estado = 'PENDIENTE';
      await expect(s.recibirWebhook(evento('evt_2', 'charge.creation.succeeded', { id: 'chr_x2', amount: 100, metadata: { intento: intentoId } }))).rejects.toThrow();
      expect(eventos[0].estado).toBe('ERROR');
      expect(cobros.cobrar).not.toHaveBeenCalled();
    });

    it('webhook aprobado de un pedido ya anulado: no lo revive, queda para devolver y avisa al ADMIN', async () => {
      const { s, acceso, cobros, pedido, intentos, prisma, pasarela } = armar();
      const { intentoId } = await s.crearIntento('7', acceso);
      sembrar(pasarela, intentoId, 'chr_x9');
      intentos[0].estado = 'PENDIENTE';
      pedido.estado = 'ANULADO';
      await s.recibirWebhook(evento('evt_9', 'charge.creation.succeeded', { id: 'chr_x9', amount: 5250, metadata: { intento: intentoId } }));
      expect(cobros.cobrar).not.toHaveBeenCalled();
      expect(pedido.estado).toBe('ANULADO');
      expect(intentos[0].cobro_error).toMatch(/^PEDIDO_ANULADO_DEVOLVER/);
      expect(prisma.notificacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: 'PAGO_ONLINE_A_DEVOLVER', rol_destino: 'ADMIN' }) });
      expect((await s.listar({})).items[0]).toMatchObject({ requiereDevolucion: true, cobroPendiente: false });
    });

    it('autenticidad: simulado acepta; real exige secreto, Basic o (opcional) HMAC', () => {
      const sim = armar().s;
      expect(() => sim.verificarWebhook(Buffer.from('{}'), {})).not.toThrow();
      const real = armar({ pasarela: new CulqiAdaptador({ secretKey: 'sk_test_x', publicKey: 'pk_test_x', fetchFn: jest.fn() as any }) }).s;
      process.env.CULQI_WEBHOOK_SECRET = 'secreto_de_prueba';
      try {
        const raw = Buffer.from('{"id":"evt"}');
        const firma = createHmac('sha256', 'secreto_de_prueba').update(raw).digest('hex');
        expect(() => real.verificarWebhook(raw, { 'x-culqi-signature': firma })).not.toThrow();
        expect(() => real.verificarWebhook(raw, { 'x-webhook-secret': 'secreto_de_prueba' })).not.toThrow();
        expect(() => real.verificarWebhook(raw, { 'x-culqi-signature': 'a'.repeat(64) })).toThrow();
        expect(() => real.verificarWebhook(raw, {})).toThrow();
        expect(() => real.verificarWebhook(raw, {}, 'secreto_de_prueba')).not.toThrow();
        process.env.CULQI_WEBHOOK_USUARIO = 'u';
        process.env.CULQI_WEBHOOK_CLAVE = 'c';
        expect(() => real.verificarWebhook(raw, { authorization: 'Basic ' + Buffer.from('u:c').toString('base64') })).not.toThrow();
        expect(() => real.verificarWebhook(raw, { authorization: 'Basic ' + Buffer.from('u:mala').toString('base64') })).toThrow();
        delete process.env.CULQI_WEBHOOK_SECRET;
        delete process.env.CULQI_WEBHOOK_USUARIO;
        delete process.env.CULQI_WEBHOOK_CLAVE;
        expect(() => real.verificarWebhook(raw, { 'x-webhook-secret': 'x' })).toThrow();
      } finally {
        delete process.env.CULQI_WEBHOOK_SECRET;
        delete process.env.CULQI_WEBHOOK_USUARIO;
        delete process.env.CULQI_WEBHOOK_CLAVE;
      }
    });
  });

  describe('devolución', () => {
    async function aprobado(extra: Partial<any> = {}) {
      const ctx = armar(extra);
      const { intentoId } = await ctx.s.crearIntento('7', ctx.acceso);
      await ctx.s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' });
      return { ...ctx, id: ctx.intentos[0].id.toString() };
    }

    it('solo ADMIN', async () => {
      const { s, id } = await aprobado({ pedido: {} });
      await expect(s.devolver(id, { motivo: 'cliente pidió', confirmar: true }, { partyId: '2', rol: 'CAJERO', roles: ['CAJERO'] })).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
    });

    it('pedido no anulado exige confirmar; con confirmar devuelve parcial y total, y audita', async () => {
      const { s, id, auditoria, intentos } = await aprobado();
      await expect(s.devolver(id, { motivo: 'cliente pidió' }, admin)).rejects.toMatchObject({ response: { codigo: 'CONFIRMAR_DEVOLUCION' } });
      const parcial = await s.devolver(id, { monto: 10, motivo: 'cliente pidió', confirmar: true }, admin);
      expect(parcial).toMatchObject({ montoDevuelto: 10, restante: 42.5 });
      await expect(s.devolver(id, { monto: 50, motivo: 'cliente pidió', confirmar: true }, admin)).rejects.toMatchObject({ response: { codigo: 'MONTO_EXCEDE' } });
      const resto = await s.devolver(id, { motivo: 'cliente pidió', confirmar: true }, admin);
      expect(resto.restante).toBe(0);
      expect(intentos[0].estado).toBe('DEVUELTO');
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'DEVOLUCION_PAGO_ONLINE', partyId: '1' }));
    });

    it('devolución por otro medio: no llama a Culqi; efectivo registra egreso de caja; nunca pasa de lo cobrado', async () => {
      const { s, id, pasarela, intentos, prisma } = await aprobado();
      const espia = jest.spyOn(pasarela, 'devolver');
      const r1 = await s.devolver(id, { monto: 20, medio: 'EFECTIVO', motivo: 'devuelto en el local', confirmar: true }, admin);
      expect(r1.medio).toBe('EFECTIVO');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      await s.devolver(id, { monto: 12.5, medio: 'YAPE', motivo: 'devuelto por Yape', confirmar: true }, admin);
      expect(espia).not.toHaveBeenCalled();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      await expect(s.devolver(id, { monto: 30, medio: 'PLIN', motivo: 'de más ya no cabe', confirmar: true }, admin)).rejects.toMatchObject({ response: { codigo: 'MONTO_EXCEDE' } });
      expect(intentos[0].devoluciones.map((d: any) => d.medio)).toEqual(['EFECTIVO', 'YAPE']);
      expect(intentos[0].devuelto_centimos).toBe(3250);
      const lista = await s.listar({});
      expect(lista.items[0]).toMatchObject({ montoDevuelto: 32.5, devoluciones: [{ monto: 20, medio: 'EFECTIVO' }, { monto: 12.5, medio: 'YAPE' }] });
    });

    it('medio de devolución inválido y no-ADMIN con otro medio', async () => {
      const { s, id } = await aprobado();
      await expect(s.devolver(id, { motivo: 'cliente pidió', medio: 'BITCOIN', confirmar: true }, admin)).rejects.toMatchObject({ response: { codigo: 'MEDIO_INVALIDO' } });
      await expect(s.devolver(id, { motivo: 'cliente pidió', medio: 'EFECTIVO', confirmar: true }, { partyId: '2', rol: 'CAJERO', roles: ['CAJERO'] })).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
    });

    it('el cobro lo registra el usuario de sistema «Pago en línea»', async () => {
      const { cobros } = await aprobado();
      expect(cobros.cobrar.mock.calls[0][1]).toMatchObject({ partyId: '99', rol: 'ADMIN' });
    });

    it('devolución parcial: el cobro queda; total: se anula el cobro de Caja una sola vez', async () => {
      const { s, id, cobros } = await aprobado();
      await s.devolver(id, { monto: 10, motivo: 'cliente pidió', confirmar: true }, admin);
      expect(cobros.anularCobro).not.toHaveBeenCalled();
      const fin = await s.devolver(id, { motivo: 'cliente pidió', confirmar: true }, admin);
      expect(cobros.anularCobro).toHaveBeenCalledTimes(1);
      expect(cobros.anularCobro).toHaveBeenCalledWith(31n, { motivo: expect.stringContaining('Devolución total') }, admin, undefined);
      expect(fin.cobroAnulado).toBe(true);
    });

    it('total en efectivo: un solo egreso de caja y el cobro digital se anula', async () => {
      const { s, id, cobros, prisma } = await aprobado();
      await s.devolver(id, { medio: 'EFECTIVO', motivo: 'devuelto en el local', confirmar: true }, admin);
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(cobros.anularCobro).toHaveBeenCalledTimes(1);
    });

    it('cobro en caja ya cerrada: usa la anulación de caja cerrada', async () => {
      const { s, id, cobros, prisma } = await aprobado();
      prisma.cobro.findFirst.mockResolvedValue({ id: 31n, caja: { estado: 'CERRADA' } });
      await s.devolver(id, { motivo: 'cliente pidió', confirmar: true }, admin);
      expect(cobros.anularCobroCajaCerrada).toHaveBeenCalledTimes(1);
      expect(cobros.anularCobro).not.toHaveBeenCalled();
    });

    it('si no se puede anular el cobro, la devolución se conserva y se explica', async () => {
      const { s, id, cobros, intentos } = await aprobado();
      cobros.anularCobro.mockRejectedValue({ response: { mensaje: 'caja cerrada' } });
      const r = await s.devolver(id, { motivo: 'cliente pidió', confirmar: true }, admin);
      expect(r).toMatchObject({ cobroAnulado: false, restante: 0 });
      expect(r.avisoCobro).toMatch(/no se pudo anular/);
      expect(intentos[0].estado).toBe('DEVUELTO');
    });

    it('pedido anulado: devuelve sin confirmar', async () => {
      const { s, id, pedido } = await aprobado();
      pedido.estado = 'ANULADO';
      await expect(s.devolver(id, { motivo: 'pedido anulado' }, admin)).resolves.toMatchObject({ restante: 0 });
    });

    it('si Culqi rechaza la devolución, se libera el monto reservado', async () => {
      const { s, id, pasarela, intentos } = await aprobado();
      jest.spyOn(pasarela, 'devolver').mockRejectedValue(new Error('no se puede'));
      await expect(s.devolver(id, { motivo: 'cliente pidió', confirmar: true }, admin)).rejects.toMatchObject({ response: { codigo: 'DEVOLUCION_RECHAZADA' } });
      expect(intentos[0].devuelto_centimos).toBe(0);
    });

    it('webhook de devolución propia no se cuenta dos veces', async () => {
      const { s, id, intentos } = await aprobado();
      const r = await s.devolver(id, { monto: 10, motivo: 'cliente pidió', confirmar: true }, admin);
      await s.recibirWebhook({ id: 'evt_r', type: 'refund.creation.succeeded', data: { id: r.devolucionId, charge_id: intentos[0].culqi_cargo_id, amount: 1000 } });
      expect(intentos[0].devuelto_centimos).toBe(1000);
    });
  });
});

describe('adaptadores', () => {
  it('sin llaves la fábrica da SIMULADO; con ambas, REAL', () => {
    expect(crearPasarela({} as any).modo).toBe('SIMULADO');
    expect(crearPasarela({ CULQI_SECRET_KEY: 'sk_test_x' } as any).modo).toBe('SIMULADO');
    const real = crearPasarela({ CULQI_SECRET_KEY: 'sk_test_x', CULQI_PUBLIC_KEY: 'pk_test_x' } as any);
    expect(real).toMatchObject({ modo: 'REAL', publicKey: 'pk_test_x' });
    expect(JSON.stringify(real.publicKey)).not.toContain('sk_');
  });

  it('Culqi: manda céntimos, traduce errores y no filtra la llave', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce({ status: 201, json: async () => ({ object: 'charge', id: 'chr_t1', outcome: { type: 'venta_exitosa' }, source: { card_number: '411111******1111', iin: { card_brand: 'Visa' } } }) })
      .mockResolvedValueOnce({ status: 400, json: async () => ({ object: 'error', code: 'insufficient_funds' }) })
      .mockRejectedValueOnce(new Error('ECONNRESET sk_test_secreta'));
    const c = new CulqiAdaptador({ secretKey: 'sk_test_secreta', publicKey: 'pk_test_x', fetchFn: fetchFn as any });
    const base = { montoCentimos: 5250, moneda: 'PEN', token: 'tkn_x', medio: 'TARJETA' as const, email: 'a@b.pe', descripcion: 'x', metadata: {} };
    expect(await c.cargar(base)).toMatchObject({ estado: 'APROBADO', cargoId: 'chr_t1', marca: 'Visa', ultimos4: '1111' });
    expect(JSON.parse(fetchFn.mock.calls[0][1].body)).toMatchObject({ amount: 5250, currency_code: 'PEN', source_id: 'tkn_x' });
    expect((await c.cargar(base)).mensaje).toMatch(/ondos/);
    await expect(c.cargar(base)).rejects.toThrow(/^Sin respuesta de Culqi$/);
  });

  it('Culqi 3DS: 200 con action_code REVIEW pide 3DS; el reintento manda authentication_3DS; consulta con GET', async () => {
    const fetchFn = jest.fn()
      .mockResolvedValueOnce({ status: 200, json: async () => ({ action_code: 'REVIEW' }) })
      .mockResolvedValueOnce({ status: 201, json: async () => ({ object: 'charge', id: 'chr_t3', outcome: { type: 'venta_exitosa' } }) })
      .mockResolvedValueOnce({ status: 200, json: async () => ({ object: 'charge', id: 'chr_t3', amount: 5250, currency_code: 'PEN', outcome: { type: 'venta_exitosa' }, metadata: { intento: 'k' }, amount_refunded: 0 }) });
    const c = new CulqiAdaptador({ secretKey: 'sk_test_secreta', publicKey: 'pk_test_x', fetchFn: fetchFn as any });
    const base = { montoCentimos: 5250, moneda: 'PEN', token: 'tkn_x', medio: 'TARJETA' as const, email: 'a@b.pe', descripcion: 'x', metadata: {} };
    expect(await c.cargar({ ...base, deviceId: 'dev1' })).toMatchObject({ estado: 'REQUIERE_3DS', cargoId: null });
    expect(await c.cargar({ ...base, autenticacion3ds: { cavv: 'c', eci: '05', xid: 'x', protocolVersion: '2.2.0', directoryServerTransactionId: 'd', otro: 'no' } })).toMatchObject({ estado: 'APROBADO' });
    const b1 = JSON.parse(fetchFn.mock.calls[0][1].body);
    const b2 = JSON.parse(fetchFn.mock.calls[1][1].body);
    expect(b1.antifraud_details).toEqual({ device_finger_print_id: 'dev1' });
    expect(b2.authentication_3DS).toEqual({ cavv: 'c', eci: '05', xid: 'x', protocolVersion: '2.2.0', directoryServerTransactionId: 'd' });
    expect(await c.consultarCargo('chr_t3')).toMatchObject({ estado: 'APROBADO', montoCentimos: 5250, moneda: 'PEN' });
    expect(fetchFn.mock.calls[2][1].method).toBe('GET');
    expect(fetchFn.mock.calls[2][0]).toMatch(/\/charges\/chr_t3$/);
  });

  it('mensajes de error simples, sin hablar de fraude', () => {
    const m = (x: any) => mensajeDeError(x);
    expect(m({ decline_code: 'insufficient_funds' })).toMatch(/Fondos insuficientes/);
    expect(m({ code: 'incorrect_cvv' })).toMatch(/código de seguridad/);
    for (const c of ['stolen_card', 'lost_card', 'fraudulent', 'issuer_decline_operation', 'PREV0009', 'DNGE0087']) {
      const txt = m({ decline_code: c, code: 'card_declined' }) + m({ code: c, merchant_message: c });
      expect(txt).toMatch(/Tu banco no autorizó el pago/);
      expect(txt.toLowerCase()).not.toMatch(/fraud|rob|perd|sospech/);
    }
    expect(m({ merchant_message: 'Error CULQ0001 interno' })).toMatch(/Intenta de nuevo/);
    expect(m({ code: 'contact_issuer' })).toMatch(/banco/);
    expect(m({ code: 'invalid_card' })).toMatch(/tarjeta/);
    expect(m({})).toMatch(/No pudimos procesar/);
  });
});

describe('PagosOnlineVencimientoService', () => {
  function armarV(valor: any, vencidos: any[]) {
    const prisma: any = {
      parametro: { findUnique: jest.fn().mockResolvedValue(valor === undefined ? null : { valor }) },
      pedido: { findMany: jest.fn().mockResolvedValue(vencidos) },
      userAccount: { findFirst: jest.fn().mockResolvedValue({ party_id: 9n }) },
      pagoOnlineIntento: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const pedidos = { cambiarEstado: jest.fn().mockResolvedValue({}) };
    return { v: new PagosOnlineVencimientoService(prisma, {} as any, pedidos as any), prisma, pedidos };
  }

  it('espera 15 min por defecto y anula solo los POR_PAGAR sin cargo en curso', async () => {
    const { v, prisma, pedidos } = armarV(undefined, [{ id: 1n }, { id: 2n }]);
    const ahora = new Date('2027-03-03T15:00:00Z');
    expect(await v.anularVencidos(ahora)).toBe(2);
    const donde = prisma.pedido.findMany.mock.calls[0][0].where;
    expect(donde).toMatchObject({ estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE' });
    expect(donde.creado_en.lte.toISOString()).toBe('2027-03-03T14:45:00.000Z');
    expect(donde.pagosOnline.none.estado.in).toEqual(['PROCESANDO', 'PENDIENTE', 'APROBADO']);
    expect(pedidos.cambiarEstado).toHaveBeenCalledWith(1n, expect.objectContaining({ estado: 'ANULADO' }), expect.objectContaining({ rol: 'ADMIN', partyId: 9n }));
  });

  it('lee pago_online_espera_min y sin vencidos no hace nada', async () => {
    const { v, pedidos } = armarV(30, []);
    expect(await v.minutosEspera()).toBe(30);
    expect(await v.anularVencidos(new Date())).toBe(0);
    expect(pedidos.cambiarEstado).not.toHaveBeenCalled();
  });

  it('si anular falla en uno, sigue con los demás', async () => {
    const { v, pedidos } = armarV(15, [{ id: 1n }, { id: 2n }]);
    pedidos.cambiarEstado.mockRejectedValueOnce(new Error('x'));
    expect(await v.anularVencidos(new Date())).toBe(1);
  });

  it('al anular por falta de pago le avisa al cliente por WhatsApp (caso CP-W920: tenía el código y nadie le avisó)', async () => {
    const { prisma, pedidos } = armarV(15, [{ id: 7n, codigo: 'CP-W920', cliente_telefono: '989690890' }, { id: 8n, codigo: 'CP-W921', cliente_telefono: null }]);
    const outbox = { encolar: jest.fn().mockResolvedValue(true), despertar: jest.fn() };
    const v = new PagosOnlineVencimientoService(prisma, {} as any, pedidos as any, outbox as any);
    expect(await v.anularVencidos(new Date())).toBe(2);
    expect(outbox.encolar).toHaveBeenCalledTimes(1);
    const [d] = outbox.encolar.mock.calls[0];
    expect(d).toMatchObject({ tipo: 'TEXTO', clave: 'pago-online-vencido-7', origen: 'PAGO_ONLINE_VENCIDO' });
    expect(d.carga.textoLibre).toContain('CP-W920');
    expect(d.carga.textoLibre).toContain('no se registró');
  });
});

describe('llaves live en la demo', () => {
  it('la demo se niega a cobrar con sk_live; con sk_test cobra normal; prod no se toca', async () => {
    const live = { CULQI_SECRET_KEY: 'sk_live_x', CULQI_PUBLIC_KEY: 'pk_live_x' };
    const bloqueada = crearPasarela({ ...live, AMBIENTE_DESPLIEGUE: 'demo' } as any);
    expect(bloqueada.publicKey).toBeNull();
    expect((await bloqueada.cargar({} as any)).estado).toBe('RECHAZADO');
    await expect(bloqueada.devolver({} as any)).rejects.toThrow();
    expect(crearPasarela({ CULQI_SECRET_KEY: 'sk_test_x', CULQI_PUBLIC_KEY: 'pk_test_x', AMBIENTE_DESPLIEGUE: 'demo' } as any).publicKey).toBe('pk_test_x');
    expect(crearPasarela(live as any).publicKey).toBe('pk_live_x');
  });
});

describe('Comisión de la pasarela (la asume el local)', () => {
  // Respuesta de cargo simulada con los campos de comisión de Culqi (céntimos): 3,99 % + S/ 0,30 + IGV
  const cargoCulqi = { amount: 5250, total_fee: 240, total_fee_taxes: 43, transfer_amount: 4967, fee_details: { fixed_fee: { total: 30 }, variable_fee: { total: 210 } } };

  it('comisionDeCargoCulqi: total = monto - lo que deposita, con fijo, variable e IGV', () => {
    expect(comisionDeCargoCulqi(cargoCulqi, 5250)).toEqual({ total: 2.83, detalle: { fijo: 0.3, variable: 2.1, igv: 0.43, neto_depositado: 49.67, fuente: 'CULQI' } });
    expect(comisionDeCargoCulqi({ amount: 5250 }, 5250)).toBeNull();
    expect(comisionDeCargoCulqi({ total_fee: 240, total_fee_taxes: 43 }, 5250)?.total).toBe(2.83);
  });

  it('comisionEstimada: porcentaje + fijo (IGV incluido, no se suma otra vez); sin tarifa, null', () => {
    expect(comisionEstimada(52.5, { pct: 4, fijo: 0.3 })).toEqual({ total: 2.4, detalle: { fijo: 0.3, variable: 2.1, igv: 0, neto_depositado: 50.1, fuente: 'ESTIMADA' } });
    expect(comisionEstimada(52.5, null)).toBeNull();
  });

  it('guarda la comisión REAL de la respuesta de Culqi al aprobar el cargo', async () => {
    const base = new SimuladoAdaptador();
    const pasarela: PasarelaPago = Object.assign(Object.create(base), {
      cargar: async (p: any) => ({ ...(await base.cargar(p)), comision: comisionDeCargoCulqi(cargoCulqi, 5250) }),
    });
    const { s, acceso, pagoCulqi } = armar({ pasarela });
    const { intentoId } = await s.crearIntento('7', acceso);
    await s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' });
    expect(pagoCulqi.comision_pasarela).toBe(2.83);
    expect(pagoCulqi.comision_detalle).toMatchObject({ fuente: 'CULQI', neto_depositado: 49.67 });
  });

  it('sin dato de Culqi usa la ESTIMADA con la tarifa del ADMIN', async () => {
    const { s, acceso, prisma, pagoCulqi } = armar();
    prisma.parametro.findUnique.mockImplementation(async ({ where }: any) =>
      where.clave === 'culqi_comision_tarjeta_pct' ? { valor: 4 } : where.clave === 'culqi_comision_tarjeta_fijo' ? { valor: 0.3 } : { valor: { CARTA: { PAGO_EN_LINEA: true } } });
    const { intentoId } = await s.crearIntento('7', acceso);
    await s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' });
    expect(pagoCulqi.comision_pasarela).toBe(2.4);
    expect(pagoCulqi.comision_detalle.fuente).toBe('ESTIMADA');
  });

  it('sin dato ni tarifa configurada queda null (por confirmar), sin inventar valores', async () => {
    const { s, acceso, pagoCulqi } = armar();
    const { intentoId } = await s.crearIntento('7', acceso);
    await s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' });
    expect(pagoCulqi.comision_pasarela).toBeNull();
  });

  it('el cliente no la ve: la respuesta del cargo no lleva comisión ni neto', async () => {
    const base = new SimuladoAdaptador();
    const pasarela: PasarelaPago = Object.assign(Object.create(base), {
      cargar: async (p: any) => ({ ...(await base.cargar(p)), comision: comisionDeCargoCulqi(cargoCulqi, 5250) }),
    });
    const { s, acceso } = armar({ pasarela });
    const { intentoId } = await s.crearIntento('7', acceso);
    const r = await s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' });
    expect(JSON.stringify(r)).not.toMatch(/comision|neto/i);
  });

  it('el detalle del pedido solo lleva comisión con permiso (el mozo no la recibe)', async () => {
    const db: any = {
      pagoOnlineIntento: { findMany: async () => [{ pedido_id: 7n, culqi_cargo_id: 'chr_1', monto_centimos: 5250, devuelto_centimos: 0, modo: 'REAL' }] },
      cobroPago: { findMany: async () => [{ comision_pasarela: 2.83, comision_detalle: { neto_depositado: 49.67, fuente: 'CULQI' }, cobro: { pedido_id: 7n } }] },
    };
    expect((await pagosOnlineDe(db, [7n])).get('7')).toMatchObject({ comision: 2.83, neto: 49.67 });
    expect((await pagosOnlineDe(db, [7n], false)).get('7')).not.toHaveProperty('comision');
  });

  it('una comisión real no se pisa con una estimada; el webhook posterior completa la real', async () => {
    const { s, pagoCulqi } = armar();
    const intento = { pedido_id: 7n, monto_centimos: 5250, medio: 'TARJETA' };
    await s.guardarComision(intento, comisionDeCargoCulqi(cargoCulqi, 5250));
    await s.guardarComision(intento); // sin real: no pisa
    expect(pagoCulqi.comision_detalle.fuente).toBe('CULQI');
  });
});

// Cambio de medio de un pedido que espera Culqi (E1/E2) y webhook tardío tras el cambio
describe('PagosOnlineService: cambio de medio y webhook tardío', () => {
  const admin: any = { partyId: '1', rol: 'ADMIN', roles: ['ADMIN'] };
  const conTxReal = (ctx: any) => {
    ctx.prisma.$transaction = jest.fn(async (fn: any) => fn(ctx.prisma));
    ctx.prisma.pedidoPagoPlan = { deleteMany: jest.fn().mockResolvedValue({ count: 0 }) };
    return ctx;
  };

  it('cliente cambia de Culqi a Yape: el pedido llega a COLA, el intento queda FALLIDO y se audita', async () => {
    const ctx = conTxReal(armar());
    const { s, acceso, pedido, intentos, auditoria, prisma } = ctx;
    await s.crearIntento('7', acceso);
    const r = await s.cambiarMedioInvitado('7', { ...acceso }, { medio: 'YAPE' });
    expect(r).toMatchObject({ ok: true, estado: 'COLA', medio: 'YAPE' });
    expect(pedido).toMatchObject({ estado: 'COLA', pago_estado: 'PENDIENTE', pago_preferido: 'YAPE' });
    expect(pedido.pasa_cocina_en).toBeInstanceOf(Date);
    expect(intentos[0].estado).toBe('FALLIDO');
    expect(intentos[0].mensaje).toBe('Cambió el medio de pago');
    expect(prisma.pedidoEstadoHistorial.create).toHaveBeenCalledWith({ data: expect.objectContaining({ estado_anterior: 'POR_PAGAR', estado_nuevo: 'COLA', motivo: expect.stringContaining('Cambió el medio de pago') }) });
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'PAGO_ONLINE_CAMBIO_MEDIO' }));
  });

  it('Caja (ADMIN) cambia a efectivo por el mismo camino', async () => {
    const ctx = conTxReal(armar());
    await ctx.s.crearIntento('7', ctx.acceso);
    await ctx.s.cambiarMedioAdmin('7', { medio: 'EFECTIVO' }, admin, '10.0.0.1');
    expect(ctx.pedido).toMatchObject({ estado: 'COLA', pago_preferido: 'EFECTIVO' });
    expect(ctx.auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'PAGO_ONLINE_CAMBIO_MEDIO', ip: '10.0.0.1' }));
  });

  it('rechaza con un cargo en curso o aprobado (409 PAGO_EN_CURSO) y no cambia nada', async () => {
    for (const estado of ['PROCESANDO', 'PENDIENTE', 'APROBADO']) {
      const ctx = conTxReal(armar());
      await ctx.s.crearIntento('7', ctx.acceso);
      ctx.intentos[0].estado = estado;
      await expect(ctx.s.cambiarMedioInvitado('7', { ...ctx.acceso }, { medio: 'YAPE' })).rejects.toMatchObject({ response: { codigo: 'PAGO_EN_CURSO' } });
      expect(ctx.pedido.estado).toBe('POR_PAGAR');
      expect(ctx.intentos[0].estado).toBe(estado);
    }
  });

  it('rechaza si el pedido está anulado (409 PEDIDO_ANULADO)', async () => {
    const ctx = conTxReal(armar({ pedido: { estado: 'ANULADO' } }));
    await expect(ctx.s.cambiarMedioInvitado('7', { ...ctx.acceso }, { medio: 'YAPE' })).rejects.toMatchObject({ response: { codigo: 'PEDIDO_ANULADO' } });
    expect(ctx.pedido.estado).toBe('ANULADO');
  });

  it('sin token de seguimiento ni sesión del dueño: 403', async () => {
    const ctx = conTxReal(armar());
    await expect(ctx.s.cambiarMedioInvitado('7', {}, { medio: 'YAPE' })).rejects.toMatchObject({ status: 403 });
  });

  it('medio que no es de la lista (p. ej. tarjeta) rechazado con 400', async () => {
    const ctx = conTxReal(armar());
    await expect(ctx.s.cambiarMedioInvitado('7', { ...ctx.acceso }, { medio: 'TARJETA' })).rejects.toMatchObject({ response: { codigo: 'MEDIO_INVALIDO' } });
    expect(ctx.pedido.estado).toBe('POR_PAGAR');
  });

  it('webhook tardío de un cargo del intento anterior (ya cambiado de medio) no cobra ni revive el pedido', async () => {
    const ctx = conTxReal(armar());
    const { s, acceso, pedido, intentos, cobros, pasarela, prisma } = ctx;
    const { intentoId } = await s.crearIntento('7', acceso);
    pasarela.sembrarCargo({ cargoId: 'chr_tarde', estado: 'APROBADO', montoCentimos: 5250, moneda: 'PEN', metadata: { intento: intentoId }, devueltoCentimos: 0 });
    await s.cambiarMedioInvitado('7', { ...acceso }, { medio: 'YAPE' });
    expect(intentos[0].estado).toBe('FALLIDO');
    await s.recibirWebhook({ id: 'evt_tarde', type: 'charge.creation.succeeded', data: JSON.stringify({ id: 'chr_tarde', amount: 5250, metadata: { intento: intentoId } }) });
    expect(cobros.cobrar).not.toHaveBeenCalled();
    expect(pedido).toMatchObject({ estado: 'COLA', pago_preferido: 'YAPE' });
    // Si el cargo llegara a aprobarse por el intento ya cambiado, la guarda de cobrarPedido no cobra y avisa
    intentos[0].estado = 'APROBADO';
    await s.cobrarPedido(intentos[0].id);
    expect(cobros.cobrar).not.toHaveBeenCalled();
    expect(intentos[0].cobro_error).toMatch(/^PEDIDO_YA_NO_EN_LINEA/);
    expect(prisma.notificacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: 'PAGO_ONLINE_A_DEVOLVER' }) });
  });
});

describe('medio de pago lo decide el servidor (prefijo del token y cargo de Culqi)', () => {
  const culqiTarjeta = (source: any) =>
    jest.fn().mockResolvedValue({ status: 201, json: async () => ({ object: 'charge', id: 'chr_live_t1', outcome: { type: 'venta_exitosa' }, amount: 5250, currency_code: 'PEN', source }) });

  it('token tkn_ con medio YAPE del navegador: se registra TARJETA, se cobra TARJETA y queda el aviso', async () => {
    const { s, acceso, cobros, intentos, auditoria } = armar();
    const { intentoId } = await s.crearIntento('7', acceso);
    expect((await s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'YAPE' })).estado).toBe('APROBADO');
    expect(intentos[0].medio).toBe('TARJETA');
    expect(cobros.cobrar.mock.calls[0][0].pagos[0].medio).toBe('TARJETA');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'MEDIO_CORREGIDO_CULQI', motivo: 'El medio informado por el navegador (YAPE) no coincide con Culqi (TARJETA)' }),
    );
  });

  it('token ype_ con medio TARJETA del navegador: se registra YAPE y queda el aviso', async () => {
    const { s, acceso, cobros, intentos, auditoria } = armar();
    const { intentoId } = await s.crearIntento('7', acceso);
    await s.cargar({ intentoId, token: 'ype_simulado_ok', medio: 'TARJETA' });
    expect(intentos[0].medio).toBe('YAPE');
    expect(cobros.cobrar.mock.calls[0][0].pagos[0].medio).toBe('YAPE');
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'MEDIO_CORREGIDO_CULQI' }));
  });

  it('navegador y servidor coinciden (simulado): sin aviso', async () => {
    const { s, acceso, auditoria } = armar();
    const { intentoId } = await s.crearIntento('7', acceso);
    await s.cargar({ intentoId, token: 'ype_simulado_ok', medio: 'YAPE' });
    expect(auditoria.registrar).not.toHaveBeenCalledWith(expect.objectContaining({ accion: 'MEDIO_CORREGIDO_CULQI' }));
  });

  it('cargo de Culqi con datos de tarjeta manda aunque el token sea ype_: TARJETA, con marca y últimos 4', async () => {
    const pasarela = new CulqiAdaptador({ secretKey: 'sk_test_x', publicKey: 'pk_test_x', fetchFn: culqiTarjeta({ type: 'card', card_number: '455788******6476', iin: { card_brand: 'Visa' } }) as any });
    const { s, acceso, cobros, intentos } = armar({ pasarela });
    const { intentoId } = await s.crearIntento('7', acceso);
    expect((await s.cargar({ intentoId, token: 'ype_token_ambiguo', medio: 'YAPE' })).estado).toBe('APROBADO');
    expect(intentos[0]).toMatchObject({ medio: 'TARJETA', marca: 'Visa', ultimos4: '6476' });
    expect(cobros.cobrar.mock.calls[0][0].pagos[0].medio).toBe('TARJETA');
  });

  it('cargo de Culqi con source tipo yape sin datos de tarjeta: YAPE aunque el token sea tkn_', async () => {
    const pasarela = new CulqiAdaptador({ secretKey: 'sk_test_x', publicKey: 'pk_test_x', fetchFn: culqiTarjeta({ type: 'yape' }) as any });
    const { s, acceso, cobros, intentos } = armar({ pasarela });
    const { intentoId } = await s.crearIntento('7', acceso);
    await s.cargar({ intentoId, token: 'tkn_token_ambiguo', medio: 'TARJETA' });
    expect(intentos[0].medio).toBe('YAPE');
    expect(cobros.cobrar.mock.calls[0][0].pagos[0].medio).toBe('YAPE');
  });

  it('webhook: el cargo confirma TARJETA aunque el intento decía YAPE; guarda marca y últimos 4 y cobra como TARJETA', async () => {
    const { s, acceso, cobros, intentos, pasarela } = armar();
    const { intentoId } = await s.crearIntento('7', acceso);
    (pasarela as SimuladoAdaptador).sembrarCargo({ cargoId: 'chr_m1', estado: 'APROBADO', montoCentimos: 5250, moneda: 'PEN', metadata: { intento: intentoId }, devueltoCentimos: 0, medioReal: 'TARJETA', marca: 'Visa', ultimos4: '6476' });
    intentos[0].estado = 'PENDIENTE';
    intentos[0].medio = 'YAPE';
    intentos[0].culqi_cargo_id = 'chr_m1';
    await s.recibirWebhook({ id: 'evt_m1', type: 'charge.creation.succeeded', data: JSON.stringify({ id: 'chr_m1', metadata: { intento: intentoId } }) });
    expect(intentos[0]).toMatchObject({ estado: 'APROBADO', medio: 'TARJETA', marca: 'Visa', ultimos4: '6476' });
    expect(cobros.cobrar.mock.calls[0][0].pagos[0].medio).toBe('TARJETA');
  });

  it('derivación: prefijo del token y fuente del cargo; sin dato, null', () => {
    expect(medioDelToken('tkn_abc')).toBe('TARJETA');
    expect(medioDelToken('ype_abc')).toBe('YAPE');
    expect(medioDelToken('otro_abc')).toBeNull();
    expect(medioDeFuenteCulqi({ iin: { card_brand: 'Visa' } })).toBe('TARJETA');
    expect(medioDeFuenteCulqi({ last_four: '6476' })).toBe('TARJETA');
    expect(medioDeFuenteCulqi({ type: 'yape' })).toBe('YAPE');
    expect(medioDeFuenteCulqi(undefined)).toBeNull();
    expect(tarjetaDeFuenteCulqi({ card_number: '455788******6476', iin: { card_brand: 'Visa' } })).toEqual({ marca: 'Visa', ultimos4: '6476' });
  });
});
