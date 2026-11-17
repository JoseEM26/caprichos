import { devolverCortesiaProductos } from './producto-controlado';

/** Base falsa mínima: stock por producto y por sabor, movimientos y agotados. */
function crearDb(movs: any[], opts: { stockProducto?: number; stockSabor?: number; agotadoOrigen?: string | null } = {}) {
  const futuro = new Date('2999-01-01');
  const db: any = {
    movs: [...movs],
    stockFilas: [{ id: 1n, producto_id: 10n, lugar_id: 3n, cantidad: opts.stockProducto ?? 0 }],
    stockSaborFilas: new Map<bigint, number>([[20n, opts.stockSabor ?? 0]]),
    producto: {
      findUnique: jest.fn(async () => ({ agotado_hasta: opts.agotadoOrigen === undefined ? null : futuro, agotado_origen: opts.agotadoOrigen ?? null })),
      update: jest.fn(async () => ({})),
    },
    sabor: {
      findUnique: jest.fn(async () => ({ agotado_hasta: opts.agotadoOrigen === undefined ? null : futuro, agotado_origen: opts.agotadoOrigen ?? null, producto_id: 10n })),
      update: jest.fn(async () => ({})),
    },
    agotado: { create: jest.fn(), updateMany: jest.fn(async () => ({})) },
    movimientoStock: {
      findMany: jest.fn(async ({ where }: any) =>
        db.movs.filter((m: any) => m.cortesia_id === where.cortesia_id && m.tipo === 'CORTESIA' && !db.movs.some((a: any) => a.movimiento_anulado_id === m.id)),
      ),
      create: jest.fn(async ({ data }: any) => {
        db.movs.push({ id: BigInt(100 + db.movs.length), ...data });
      }),
    },
    stock: {
      findMany: jest.fn(async () => db.stockFilas.map((f: any) => ({ cantidad: f.cantidad }))),
      findFirst: jest.fn(async () => db.stockFilas[0]),
      update: jest.fn(async ({ data }: any) => {
        db.stockFilas[0].cantidad += Number(data.cantidad.increment);
      }),
      create: jest.fn(),
    },
    stockSabor: {
      findUnique: jest.fn(async ({ where }: any) => ({ cantidad: db.stockSaborFilas.get(where.sabor_id) })),
      upsert: jest.fn(async ({ where, update }: any) => {
        db.stockSaborFilas.set(where.sabor_id, (db.stockSaborFilas.get(where.sabor_id) ?? 0) + Number(update.cantidad.increment));
      }),
    },
  };
  return db;
}

const movProducto = { id: 1n, tipo: 'CORTESIA', producto_id: 10n, sabor_id: null, lugar_id: 3n, cantidad: 2, cortesia_id: 77n };
const movSabor = { id: 2n, tipo: 'CORTESIA', producto_id: 10n, sabor_id: 20n, lugar_id: 3n, cantidad: 3, cortesia_id: 77n };

describe('devolverCortesiaProductos', () => {
  it('producto simple: repone lo descontado y deja un ANULACION enlazado', async () => {
    const db = crearDb([movProducto], { stockProducto: 5 });
    expect(await devolverCortesiaProductos(db, 77n, 9n)).toBe(1);
    expect(db.stockFilas[0].cantidad).toBe(7);
    expect(db.movs[1]).toMatchObject({ tipo: 'ANULACION', movimiento_anulado_id: 1n, producto_id: 10n, cantidad: 2, cortesia_id: 77n, por: 9n, pedido_id: null });
  });

  it('producto por sabor: repone el saldo del sabor, no el del producto', async () => {
    const db = crearDb([movSabor], { stockSabor: 1 });
    expect(await devolverCortesiaProductos(db, 77n, 9n)).toBe(1);
    expect(db.stockSaborFilas.get(20n)).toBe(4);
    expect(db.stockFilas[0].cantidad).toBe(0);
    expect(db.movs[1]).toMatchObject({ tipo: 'ANULACION', sabor_id: 20n, movimiento_anulado_id: 2n });
  });

  it('una segunda llamada no devuelve nada más (idempotente por movimiento)', async () => {
    const db = crearDb([movProducto], { stockProducto: 5 });
    await devolverCortesiaProductos(db, 77n, 9n);
    expect(await devolverCortesiaProductos(db, 77n, 9n)).toBe(0);
    expect(db.stockFilas[0].cantidad).toBe(7);
  });

  it('sin movimientos ligados devuelve 0 y no toca nada', async () => {
    const db = crearDb([], { stockProducto: 5 });
    expect(await devolverCortesiaProductos(db, 77n, 9n)).toBe(0);
    expect(db.stockFilas[0].cantidad).toBe(5);
  });

  it('reactiva el agotado AUTOMATICO del sabor al volver a haber saldo', async () => {
    const db = crearDb([movSabor], { stockSabor: 0, agotadoOrigen: 'AUTOMATICO' });
    await devolverCortesiaProductos(db, 77n, 9n);
    expect(db.sabor.update).toHaveBeenCalledWith({ where: { id: 20n }, data: { agotado_hasta: null, agotado_origen: null } });
  });

  it('reactiva el agotado AUTOMATICO del producto, pero no el MANUAL', async () => {
    const auto = crearDb([movProducto], { stockProducto: 0, agotadoOrigen: 'AUTOMATICO' });
    await devolverCortesiaProductos(auto, 77n, 9n);
    expect(auto.producto.update).toHaveBeenCalledWith({ where: { id: 10n }, data: { agotado_hasta: null, agotado_origen: null } });

    const manual = crearDb([movProducto], { stockProducto: 0, agotadoOrigen: 'MANUAL' });
    await devolverCortesiaProductos(manual, 77n, 9n);
    expect(manual.producto.update).not.toHaveBeenCalled();
  });
});
