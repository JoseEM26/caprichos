import { PropinasService } from './propinas.service';

/** Acumulado: el cobro suma en su día y la devolución resta el día en que se devuelve (mismo criterio que el cierre). */
describe('PropinasService', () => {
  function crearServicio(opts: { cobros?: unknown[]; devueltos?: unknown[]; pedidos?: unknown[] }) {
    const prisma: any = {
      cobroPago: { findMany: jest.fn().mockResolvedValue(opts.cobros ?? []) },
      devolucionPedido: { findMany: jest.fn().mockResolvedValue(opts.devueltos ?? []) },
      pedido: { findMany: jest.fn().mockResolvedValue(opts.pedidos ?? []) },
    };
    return { servicio: new PropinasService(prisma), prisma };
  }

  it('resumenMes: cobros del mes menos la propina devuelta el día de la devolución, por medio original', async () => {
    const { servicio, prisma } = crearServicio({
      cobros: [
        { medio: 'EFECTIVO', propina: 10, cobro: { en: new Date('2026-11-06T15:00:00Z'), pedido: { canal: 'CARTA' } } },
        { medio: 'YAPE', propina: 8.5, cobro: { en: new Date('2026-11-07T15:00:00Z'), pedido: { canal: 'WHATSAPP' } } },
      ],
      devueltos: [
        {
          creado_en: new Date('2026-11-08T14:00:00Z'),
          pedido: {
            canal: 'CARTA',
            cobros: [{ pagos: [{ medio: 'EFECTIVO', propina: 4 }] }],
          },
        },
      ],
    });

    const r = await servicio.resumenMes(2026, 11);

    expect(r.total).toBe(14.5);
    expect(r.efectivo).toBe(6);
    expect(r.digital).toBe(8.5);
    expect(r.devuelto).toBe(4);
    // la devolución cae en su propio día (08), no en el del cobro
    expect(r.porDia).toEqual([
      { fecha: '2026-11-06', total: 10, efectivo: 10, digital: 0 },
      { fecha: '2026-11-07', total: 8.5, efectivo: 0, digital: 8.5 },
      { fecha: '2026-11-08', total: -4, efectivo: -4, digital: 0 },
    ]);
    // el rango del mes se pide por fecha de cobro y de devolución
    expect(prisma.devolucionPedido.findMany.mock.calls[0][0].where.creado_en.gte.toISOString()).toBe('2026-11-01T05:00:00.000Z');
  });

  it('resumenMes cuenta igual la propina de MOZO y CAJA con pago mixto (propina por renglón) y la de CARTA; sin filtrar por canal', async () => {
    const { servicio, prisma } = crearServicio({
      cobros: [
        // mesa de mozo, mixto: la propina 6 se reparte por renglón en proporción a lo pagado (4 efectivo + 2 yape)
        { medio: 'EFECTIVO', propina: 4, cobro: { en: new Date('2026-11-06T15:00:00Z'), pedido: { canal: 'MOZO' } } },
        { medio: 'YAPE', propina: 2, cobro: { en: new Date('2026-11-06T15:00:00Z'), pedido: { canal: 'MOZO' } } },
        { medio: 'TARJETA', propina: 3, cobro: { en: new Date('2026-11-06T18:00:00Z'), pedido: { canal: 'CAJA' } } },
        { medio: 'YAPE', propina: 5, cobro: { en: new Date('2026-11-07T15:00:00Z'), pedido: { canal: 'CARTA' } } },
      ],
    });

    const r = await servicio.resumenMes(2026, 11);

    expect(r.total).toBe(14);
    expect(r.porCanal).toEqual(expect.arrayContaining([{ canal: 'MOZO', monto: 6 }, { canal: 'CAJA', monto: 3 }, { canal: 'CARTA', monto: 5 }]));
    // solo cobros vigentes (un cobro anulado o rechazado sale) y de cualquier canal
    const donde = prisma.cobroPago.findMany.mock.calls[0][0].where;
    expect(donde.propina).toEqual({ gt: 0 });
    expect(donde.cobro.anulado_en).toBeNull();
    expect(donde.cobro.pedido).toBeUndefined();
    expect(JSON.stringify(donde)).not.toContain('canal');
  });

  it('un cobro anulado (por Caja o por cambio de cobro) no entra: la consulta exige anulado_en nulo y el cobro por verificar del mozo (sin cobro) no suma', async () => {
    const { servicio, prisma } = crearServicio({ cobros: [] });
    const r = await servicio.resumenMes(2026, 11);
    expect(r.total).toBe(0);
    expect(prisma.cobroPago.findMany.mock.calls[0][0].where.cobro.anulado_en).toBeNull();
  });

  it('resumenMes sin datos: todo en cero y sin días', async () => {
    const { servicio } = crearServicio({});
    const r = await servicio.resumenMes(2026, 11);
    expect(r).toMatchObject({ total: 0, efectivo: 0, digital: 0, devuelto: 0, porDia: [] });
  });

  it('resumenMes rechaza un mes inválido', async () => {
    const { servicio } = crearServicio({});
    await expect(servicio.resumenMes(2026, 13)).rejects.toMatchObject({ response: { codigo: 'MES_INVALIDO' } });
  });

  it('pendientesDeCobro: pedidos entregados con propina y sin cobro vigente', async () => {
    const { servicio, prisma } = crearServicio({
      pedidos: [
        {
          id: 9n,
          codigo: 'CP-9',
          propina: 3,
          total: 25,
          canal: 'CARTA',
          modalidad: 'DELIVERY',
          cliente_nombre: '  Ana ',
          mesa_nombre: null,
          entregado_en: new Date('2026-11-06T16:00:00Z'),
        },
      ],
    });

    const lista = await servicio.pendientesDeCobro();

    expect(prisma.pedido.findMany.mock.calls[0][0].where).toEqual({
      propina: { gt: 0 },
      estado: 'ENTREGADO',
      cobros: { none: { anulado_en: null } },
    });
    expect(lista).toEqual([
      expect.objectContaining({ id: 9, codigo: 'CP-9', propina: 3, total: 25, cliente: 'Ana' }),
    ]);
  });
});
