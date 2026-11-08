import { PuntosService } from './puntos.service';

/** Pedido pagado sin cliente ligado, solo con celular: debe acumular al party de ese celular (todos los canales). */
function armar(pedido: any, opts: { party?: bigint | null; rol?: any; baja?: boolean; consultar?: any } = {}) {
  const rol = 'rol' in opts ? opts.rol : { id: 50n, customer_detail: { puntos: '0' } };
  const prisma: any = {
    movimientoPuntos: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    pedido: { findUnique: jest.fn().mockResolvedValue(pedido), update: jest.fn() },
    pedidoLinea: {
      findMany: jest.fn().mockResolvedValue([
        { id: 1n, producto_id: 7n, oferta_id: null, linea_combo_id: null, es_cortesia: false, cantidad: 2, precio_unit: '50.00', subtotal: '100.00', producto: { no_suma_beneficios: false } },
        { id: 2n, producto_id: 8n, oferta_id: null, linea_combo_id: null, es_cortesia: true, cantidad: 1, precio_unit: '30.00', subtotal: '30.00', producto: { no_suma_beneficios: false } },
      ]),
    },
    partyRole: { findFirst: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where.hasta === null ? rol : opts.baja ? { id: 1n } : null)) },
    customerDetail: { update: jest.fn(), create: jest.fn() },
    parametro: { findUnique: jest.fn().mockResolvedValue({ valor: 5 }) },
    $transaction: jest.fn(async (cb: any) => cb(prisma)),
  };
  const puntosParty: any = {
    resolverOCrear: jest.fn().mockResolvedValue('party' in opts ? opts.party : 900n),
    consultar: jest.fn().mockResolvedValue(opts.consultar ?? { valido: true, celular9: '987654321', partyId: 900n }),
    asegurarRolCliente: jest.fn(),
  };
  return { prisma, puntosParty, servicio: new PuntosService(prisma, { registrar: jest.fn() } as any, puntosParty) };
}

const base = { id: 1n, codigo: 'CP-1', canal: 'CAJA', party_id: 5n, cliente_party_id: null, cliente_telefono: '+51 987 654 321', cupon_id: null, cupon_emitido_id: null, puntos_canjeados: 0, descuento_detalle: [] };

describe('puntos por celular (acumularPorPedido)', () => {
  it.each(['CAJA', 'MOZO', 'CARTA', 'WHATSAPP', 'BOT'])('canal %s sin cliente ligado: suma al party del celular y liga el pedido', async (canal) => {
    // CARTA/WHATSAPP/BOT con party_id nulo para que solo el celular decida
    const { servicio, prisma, puntosParty } = armar({ ...base, canal, party_id: ['CAJA', 'MOZO'].includes(canal) ? 5n : null });
    const r = await servicio.acumularPorPedido(1n);
    expect(puntosParty.resolverOCrear).toHaveBeenCalledWith('+51 987 654 321');
    // 100 elegibles (la cortesía no cuenta) x 5 %
    expect(r).toMatchObject({ puntos: 5, sumados: true, partyId: 900n });
    expect(prisma.movimientoPuntos.create).toHaveBeenCalledWith({ data: expect.objectContaining({ party_id: 900n, pedido_id: 1n, tipo: 'SUMA', puntos: 5 }) });
    expect(prisma.pedido.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { puntos_ganados: 5, cliente_party_id: 900n } });
  });

  it('celular inválido o relleno (resolverOCrear devuelve null): no suma', async () => {
    const { servicio, prisma } = armar({ ...base, cliente_telefono: '999999999' }, { party: null });
    expect(await servicio.acumularPorPedido(1n)).toMatchObject({ puntos: 0, sumados: false, motivoNo: 'SIN_CELULAR' });
    expect(prisma.movimientoPuntos.create).not.toHaveBeenCalled();
  });

  it('pedido sin celular ni cliente: invitado, no suma', async () => {
    const { servicio } = armar({ ...base, cliente_telefono: null });
    expect(await servicio.acumularPorPedido(1n)).toMatchObject({ sumados: false, motivoNo: 'SIN_CELULAR' });
  });

  it('party existente sin rol CLIENTE (nunca lo tuvo): se le da el rol y suma', async () => {
    const { servicio, puntosParty, prisma } = armar(base, { rol: null });
    prisma.partyRole.findFirst
      .mockResolvedValueOnce(null) // vigente
      .mockResolvedValueOnce(null) // nunca tuvo
      .mockResolvedValueOnce({ id: 60n, customer_detail: null }); // tras asegurar
    const r = await servicio.acumularPorPedido(1n);
    expect(puntosParty.asegurarRolCliente).toHaveBeenCalledWith(900n);
    expect(r.sumados).toBe(true);
  });

  it('cliente dado de baja (rol con hasta): no suma ni reactiva', async () => {
    const { servicio, puntosParty } = armar(base, { rol: null, baja: true });
    expect(await servicio.acumularPorPedido(1n)).toMatchObject({ sumados: false, motivoNo: 'SIN_CUENTA_CLIENTE' });
    expect(puntosParty.asegurarRolCliente).not.toHaveBeenCalled();
  });

  it('cupón: no suma', async () => {
    const { servicio } = armar({ ...base, cupon_id: 3n });
    expect(await servicio.acumularPorPedido(1n)).toMatchObject({ sumados: false, motivoNo: 'CUPON' });
  });

  it('canje total: no suma', async () => {
    const { servicio } = armar({ ...base, puntos_canjeados: 100 });
    expect(await servicio.acumularPorPedido(1n)).toMatchObject({ sumados: false, motivoNo: 'SIN_PUNTOS' });
  });

  it('idempotente: si ya hay SUMA no vuelve a escribir', async () => {
    const { servicio, prisma } = armar(base);
    prisma.movimientoPuntos.findFirst.mockResolvedValue({ puntos: '5' });
    expect(await servicio.acumularPorPedido(1n)).toEqual({ puntos: 5, sumados: false, motivoNo: 'YA_SUMADO' });
    expect(prisma.movimientoPuntos.create).not.toHaveBeenCalled();
  });

  it('carrera (único pedido_id+tipo): no duplica ni falla', async () => {
    const { servicio, prisma } = armar(base);
    prisma.movimientoPuntos.create.mockRejectedValue({ code: 'P2002' });
    expect(await servicio.acumularPorPedido(1n)).toMatchObject({ sumados: false, motivoNo: 'YA_SUMADO' });
  });

  it('simulacro: calcula lo mismo que el real y no escribe ni crea el party', async () => {
    const real = armar(base);
    const sim = armar(base, { consultar: { valido: true, celular9: '987654321', partyId: null } });
    const r1 = await real.servicio.acumularPorPedido(1n);
    const r2 = await sim.servicio.acumularPorPedido(1n, { simular: true });
    expect(r2.puntos).toBe(r1.puntos);
    expect(r2.partyNuevo).toBe(true);
    expect(sim.puntosParty.resolverOCrear).not.toHaveBeenCalled();
    expect(sim.prisma.movimientoPuntos.create).not.toHaveBeenCalled();
    expect(sim.prisma.pedido.update).not.toHaveBeenCalled();
    expect(sim.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('motivo propio en el movimiento (reconstrucción)', async () => {
    const { servicio, prisma } = armar(base);
    await servicio.acumularPorPedido(1n, { motivo: 'Reconstrucción X' });
    expect(prisma.movimientoPuntos.create).toHaveBeenCalledWith({ data: expect.objectContaining({ motivo: 'Reconstrucción X' }) });
  });
});
