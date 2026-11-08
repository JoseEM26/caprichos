import { conciliarCobros, diaLima, leerOpciones, MOTIVO_REGULARIZACION } from '../conciliar-cobros';

describe('conciliar-cobros', () => {
  const op = { desde: '2026-11-05', hasta: '2026-11-06', aplicar: false };
  const en = new Date('2026-11-05T17:00:00Z'); // 12:00 Lima del 05/11
  const pedido = (id: number, extra: any = {}) => ({
    id: BigInt(id), codigo: `CP-${id}`, modalidad: 'LLEVAR', estado: 'ENTREGADO', pago_metodo: 'YAPE', total: 40, propina: 0,
    pago_coordinado_en: en, pago_coordinado_por: 2n, entregado_en: null, planPago: [], ...extra,
  });
  function montar(pedidos: any[], cajas: Record<string, any>, abierta: any = { id: 99n, estado: 'ABIERTA', abierta_por: 1n }) {
    const cobrosCreados: any[] = [];
    const tx: any = {
      $queryRaw: jest.fn(),
      caja: { findUnique: jest.fn().mockImplementation(async ({ where }: any) => (where.id === 99n ? abierta : Object.values(cajas).find((c: any) => c.id === where.id) ?? null)) },
      cobro: {
        findFirst: jest.fn().mockImplementation(async ({ where }: any) => (cobrosCreados.some((c) => c.pedido_id === where.pedido_id) ? { id: 1n } : null)),
        create: jest.fn().mockImplementation(async ({ data }: any) => { cobrosCreados.push(data); return { id: BigInt(cobrosCreados.length) }; }),
      },
      pedido: { findUnique: jest.fn().mockResolvedValue({ pago_estado: 'PAGADO', estado: 'ENTREGADO' }) },
    };
    const prisma: any = {
      ...tx,
      pedido: { findMany: jest.fn().mockImplementation(async () => pedidos.filter((p) => !cobrosCreados.some((c) => c.pedido_id === p.id))), findUnique: tx.pedido.findUnique },
      caja: {
        findUnique: jest.fn().mockImplementation(async ({ where }: any) => cajas[where.fecha.toISOString().slice(0, 10)] ?? null),
        findFirst: jest.fn().mockResolvedValue(abierta),
      },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    return { prisma, cobrosCreados, auditar: jest.fn().mockResolvedValue(undefined) };
  }

  it('lee y valida el rango', () => {
    expect(leerOpciones(['--desde', '2026-11-01', '--hasta', '2026-11-08', '--aplicar'])).toEqual({ desde: '2026-11-01', hasta: '2026-11-08', aplicar: true });
    expect(() => leerOpciones([])).toThrow();
    expect(() => leerOpciones(['--desde', '2026-11-09', '--hasta', '2026-11-01'])).toThrow();
    expect(diaLima(new Date('2026-11-06T02:00:00Z'))).toBe('2026-11-05');
  });

  it('simulacro: lista por día con CSV y no escribe nada', async () => {
    const { prisma, cobrosCreados, auditar } = montar([pedido(1)], { '2026-11-05': { id: 5n, estado: 'CERRADA' } });
    const salida: string[] = [];
    const r = await conciliarCobros(prisma, auditar, op, (t) => salida.push(t));
    expect(cobrosCreados).toHaveLength(0);
    expect(auditar).not.toHaveBeenCalled();
    expect(r.digitalTotal).toBe(4000);
    const texto = salida.join('\n');
    expect(texto).toContain('SIMULACRO');
    expect(texto).toContain('fecha,codigo,modalidad,medio,total');
    expect(texto).toContain('2026-11-05,CP-1,LLEVAR,YAPE,40.00,40.00,0.00,CERRADA');
  });

  it('aplicar con la caja del día cerrada: asienta lo digital en la caja abierta de hoy con la fecha original, y audita', async () => {
    const { prisma, cobrosCreados, auditar } = montar([pedido(1)], { '2026-11-05': { id: 5n, estado: 'CERRADA' } });
    await conciliarCobros(prisma, auditar, { ...op, aplicar: true }, () => undefined);
    expect(cobrosCreados).toHaveLength(1);
    expect(cobrosCreados[0]).toMatchObject({ pedido_id: 1n, caja_id: 99n, total: 40, en });
    expect(cobrosCreados[0].pagos.create).toEqual([{ medio: 'YAPE', monto: 40, propina: 0 }]);
    expect(auditar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REGULARIZAR_COBRO', motivo: MOTIVO_REGULARIZACION }));
  });

  it('con la caja de ese día abierta el cobro va a esa caja, también el efectivo', async () => {
    const { prisma, cobrosCreados, auditar } = montar(
      [pedido(1, { planPago: [{ medio: 'YAPE', monto: 30 }, { medio: 'EFECTIVO', monto: 10 }] })],
      { '2026-11-05': { id: 5n, estado: 'ABIERTA', abierta_por: 1n } },
    );
    await conciliarCobros(prisma, auditar, { ...op, aplicar: true }, () => undefined);
    expect(cobrosCreados[0].caja_id).toBe(5n);
    expect(cobrosCreados[0].pagos.create.map((x: any) => x.medio)).toEqual(['YAPE', 'EFECTIVO']);
  });

  it('el efectivo de un día cerrado no se mueve a la caja de hoy (queda para revisar a mano)', async () => {
    const { prisma, cobrosCreados, auditar } = montar([pedido(1, { pago_metodo: 'EFECTIVO' })], { '2026-11-05': { id: 5n, estado: 'CERRADA' } });
    const salida: string[] = [];
    await conciliarCobros(prisma, auditar, { ...op, aplicar: true }, (t) => salida.push(t));
    expect(cobrosCreados).toHaveLength(0);
    expect(salida.join('\n')).toContain('revisar a mano');
  });

  it('el efectivo de un delivery entregado entra por la liquidación: no se crea cobro', async () => {
    const { prisma, cobrosCreados, auditar } = montar(
      [pedido(1, { modalidad: 'DELIVERY', pago_metodo: 'EFECTIVO', entregado_en: en })],
      { '2026-11-05': { id: 5n, estado: 'ABIERTA', abierta_por: 1n } },
    );
    await conciliarCobros(prisma, auditar, { ...op, aplicar: true }, () => undefined);
    expect(cobrosCreados).toHaveLength(0);
  });

  it('idempotente: repetir la corrida no duplica', async () => {
    const { prisma, cobrosCreados, auditar } = montar([pedido(1)], { '2026-11-05': { id: 5n, estado: 'CERRADA' } });
    await conciliarCobros(prisma, auditar, { ...op, aplicar: true }, () => undefined);
    const r2 = await conciliarCobros(prisma, auditar, { ...op, aplicar: true }, () => undefined);
    expect(cobrosCreados).toHaveLength(1);
    expect(r2.filas).toHaveLength(0);
  });

  it('sin caja abierta no escribe y cuenta el error', async () => {
    const { prisma, cobrosCreados, auditar } = montar([pedido(1)], { '2026-11-05': { id: 5n, estado: 'CERRADA' } }, null);
    const r = await conciliarCobros(prisma, auditar, { ...op, aplicar: true }, () => undefined);
    expect(cobrosCreados).toHaveLength(0);
    expect(r.errores).toBe(1);
  });
});
