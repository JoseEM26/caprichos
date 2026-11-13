jest.mock('../pedidos-admin/pedidos-estado.service', () => ({ PedidosEstadoService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { createHmac } from 'crypto';
import { PagosOnlineService } from './pagos-online.service';
import { SimuladoAdaptador } from './simulado.adaptador';
import { CulqiAdaptador } from './culqi.adaptador';
import { crearPasarela } from './pasarela.fabrica';
import { PasarelaPago } from './pasarela.puerto';
import { generarTokenSeguimiento } from '../pedidos/seguimiento.tokens';

// Datos sintéticos: nada real
function armar(opts: { activo?: boolean; pasarela?: PasarelaPago; pedido?: Partial<any>; cajaAbierta?: boolean } = {}) {
  const pedido: any = {
    id: 7n, codigo: 'P-0007', canal: 'CARTA', estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE', es_personal: false,
    total: 50.5, monto_credito: 0, propina: 2, planPago: [], cobros: [], modalidad: 'RECOGER',
    comprobante_tipo: 'SIMPLE', comprobante_doc: null, comprobante_razon: null, cliente_party_id: null, party_id: null,
    pasa_cocina_en: null, pago_coordinado_en: null, ...opts.pedido,
  };
  const intentos: any[] = [];
  const eventos: any[] = [];
  let seq = 1;
  const cumple = (i: any, w: any): boolean =>
    Object.entries(w).every(([k, v]: [string, any]) => {
      if (k === 'OR') return v.some((x: any) => cumple(i, x));
      if (v && typeof v === 'object' && 'in' in v) return v.in.includes(i[k]);
      return i[k] === v;
    });
  const prisma: any = {
    parametro: { findUnique: jest.fn().mockResolvedValue({ valor: opts.activo === false ? 'no' : 'si' }) },
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
    pagoOnlineIntento: {
      findUnique: jest.fn(async ({ where }: any) => {
        const i = intentos.find((x) => Object.entries(where).every(([k, v]) => x[k] === v));
        return i ? { ...i, pedido: { id: pedido.id, codigo: pedido.codigo, estado: pedido.estado } } : null;
      }),
      findUniqueOrThrow: jest.fn(async ({ where }: any) => intentos.find((x) => x.id === where.id)),
      count: jest.fn(async () => intentos.length),
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
  const s = new PagosOnlineService(prisma, auditoria as any, cobros as any, pasarela);
  const acceso = { seguimientoToken: generarTokenSeguimiento(pedido.id) };
  return { s, prisma, cobros, auditoria, pedido, intentos, eventos, acceso, pasarela };
}

describe('PagosOnlineService', () => {
  const admin = { partyId: '1', rol: 'ADMIN', roles: ['ADMIN'] };

  it('apagado por defecto: sin parámetro en "si" no hay intento ni cargo', async () => {
    const { s, acceso } = armar({ activo: false });
    await expect(s.crearIntento('7', acceso)).rejects.toMatchObject({ response: { codigo: 'PAGO_ONLINE_APAGADO' } });
    await expect(s.cargar({ intentoId: 'x', token: 'tkn_simulado_ok', medio: 'TARJETA' })).rejects.toMatchObject({ response: { codigo: 'PAGO_ONLINE_APAGADO' } });
    expect((await s.config()).activo).toBe(false);
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
    const { s, acceso, cobros, pedido, intentos } = armar();
    const { intentoId } = await s.crearIntento('7', acceso);
    const r = await s.cargar({ intentoId, token: 'tkn_simulado_ok', medio: 'TARJETA' });
    expect(r).toMatchObject({ estado: 'APROBADO', pedidoCodigo: 'P-0007' });
    expect(cobros.cobrar).toHaveBeenCalledTimes(1);
    const [dto] = cobros.cobrar.mock.calls[0];
    expect(dto.pagos).toEqual([{ medio: 'TARJETA', monto: 52.5 }]);
    expect(pedido.pago_coordinado_en).toBeInstanceOf(Date);
    expect(pedido.pasa_cocina_en).toBeInstanceOf(Date);
    expect(pedido.estado).toBe('COLA');
    expect(intentos[0]).toMatchObject({ estado: 'APROBADO', ultimos4: '1111' });
    expect(intentos[0].cobrado_en).toBeInstanceOf(Date);
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
    jest.spyOn(pasarela, 'cargar').mockRejectedValue(new (require('./pasarela.puerto').ErrorPasarela)('x'));
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

  describe('webhook', () => {
    const evento = (id: string, tipo: string, data: any) => ({ id, type: tipo, data: JSON.stringify(data) });

    it('evento duplicado: se procesa una sola vez', async () => {
      const { s, acceso, cobros, intentos } = armar();
      const { intentoId } = await s.crearIntento('7', acceso);
      intentos[0].estado = 'PENDIENTE';
      intentos[0].medio = 'YAPE';
      const ev = evento('evt_1', 'charge.creation.succeeded', { id: 'chr_x1', amount: 5250, metadata: { intento: intentoId } });
      expect(await s.recibirWebhook(ev)).toEqual({ recibido: true });
      expect(await s.recibirWebhook(ev)).toEqual({ recibido: true, duplicado: true });
      expect(cobros.cobrar).toHaveBeenCalledTimes(1);
      expect(intentos[0]).toMatchObject({ estado: 'APROBADO', culqi_cargo_id: 'chr_x1' });
    });

    it('un monto distinto al del servidor no aprueba', async () => {
      const { s, acceso, intentos, eventos, cobros } = armar();
      const { intentoId } = await s.crearIntento('7', acceso);
      intentos[0].estado = 'PENDIENTE';
      await expect(s.recibirWebhook(evento('evt_2', 'charge.creation.succeeded', { id: 'chr_x2', amount: 100, metadata: { intento: intentoId } }))).rejects.toThrow();
      expect(eventos[0].estado).toBe('ERROR');
      expect(cobros.cobrar).not.toHaveBeenCalled();
    });

    it('webhook aprobado de un pedido ya anulado: no lo revive, queda para devolver y avisa al ADMIN', async () => {
      const { s, acceso, cobros, pedido, intentos, prisma } = armar();
      const { intentoId } = await s.crearIntento('7', acceso);
      intentos[0].estado = 'PENDIENTE';
      pedido.estado = 'ANULADO';
      await s.recibirWebhook(evento('evt_9', 'charge.creation.succeeded', { id: 'chr_x9', amount: 5250, metadata: { intento: intentoId } }));
      expect(cobros.cobrar).not.toHaveBeenCalled();
      expect(pedido.estado).toBe('ANULADO');
      expect(intentos[0].cobro_error).toMatch(/^PEDIDO_ANULADO_DEVOLVER/);
      expect(prisma.notificacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ tipo: 'PAGO_ONLINE_A_DEVOLVER', rol_destino: 'ADMIN' }) });
      expect((await s.listar({})).items[0]).toMatchObject({ requiereDevolucion: true, cobroPendiente: false });
    });

    it('autenticidad: simulado acepta; real exige firma o secreto', () => {
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
        delete process.env.CULQI_WEBHOOK_SECRET;
        expect(() => real.verificarWebhook(raw, { 'x-webhook-secret': 'x' })).toThrow();
      } finally {
        delete process.env.CULQI_WEBHOOK_SECRET;
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
      expect(cobros.cobrar.mock.calls[0][1]).toMatchObject({ partyId: '99', rol: 'SISTEMA' });
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
    expect((await c.cargar(base)).mensaje).toMatch(/fondos/);
    await expect(c.cargar(base)).rejects.toThrow(/^Sin respuesta de Culqi$/);
  });
});

describe('PagosOnlineVencimientoService', () => {
  const { PagosOnlineVencimientoService } = require('./pagos-online-vencimiento.service');
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
    expect(pedidos.cambiarEstado).toHaveBeenCalledWith(1n, expect.objectContaining({ estado: 'ANULADO' }), expect.objectContaining({ rol: 'SISTEMA', partyId: 9n }));
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
});
