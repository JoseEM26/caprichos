import { ajustarVentaProductos } from './producto-controlado';

/** Base falsa mínima: un producto con saldo en una fila y sus movimientos VENTA vigentes. */
function crearDb(opts: { saldo: number; vendido: number }) {
  const estado = { saldo: opts.saldo, movimientos: [] as any[] };
  const vigente = { id: BigInt(50), cantidad: opts.vendido, lugar_id: BigInt(1), tipo: 'VENTA' };
  const db: any = {
    producto: {
      findMany: jest.fn(async () => [{ id: BigInt(5), nombre: 'Torta', sabores: [], ofertasAlcance: [] }]),
      findUnique: jest.fn(async () => ({ agotado_hasta: null, agotado_origen: null })),
    },
    movimientoStock: {
      findMany: jest.fn(async () => (opts.vendido > 0 ? [vigente] : [])),
      create: jest.fn(async (a: any) => estado.movimientos.push(a.data)),
    },
    stock: {
      findFirst: jest.fn(async () => ({ id: BigInt(7), lugar_id: BigInt(1), cantidad: estado.saldo })),
      findMany: jest.fn(async () => [{ cantidad: estado.saldo }]),
      update: jest.fn(async (a: any) => {
        estado.saldo += Number(a.data.cantidad.increment);
      }),
      updateMany: jest.fn(async (a: any) => {
        const pide = Number(a.data.cantidad.decrement);
        if (estado.saldo < pide) return { count: 0 };
        estado.saldo -= pide;
        return { count: 1 };
      }),
    },
    agotado: { create: jest.fn(), updateMany: jest.fn() },
    lugarStock: { findFirst: jest.fn(async () => ({ id: BigInt(1) })) },
  };
  return { db, estado };
}

describe('ajustarVentaProductos (Editar pedido)', () => {
  it('devuelve el stock de lo quitado: vendía 3, quita 1 y queda vendido 2', async () => {
    const { db, estado } = crearDb({ saldo: 10, vendido: 3 });
    await ajustarVentaProductos(db, BigInt(100), [{ productoId: BigInt(5), cantidad: 1 }], [], BigInt(9));
    // devuelve los 3 y descuenta 2 de nuevo: saldo final 10 + 3 - 2 = 11
    expect(estado.saldo).toBe(11);
    expect(estado.movimientos.map((m) => m.tipo)).toEqual(['ANULACION', 'VENTA']);
    expect(estado.movimientos[0].movimiento_anulado_id).toBe(BigInt(50));
  });

  it('descuenta lo nuevo: vendía 3, agrega 2 y queda vendido 5', async () => {
    const { db, estado } = crearDb({ saldo: 10, vendido: 3 });
    await ajustarVentaProductos(db, BigInt(100), [], [{ productoId: BigInt(5), cantidad: 2 }], BigInt(9));
    expect(estado.saldo).toBe(8);
  });

  it('409 STOCK_INSUFICIENTE si lo nuevo no alcanza', async () => {
    const { db } = crearDb({ saldo: 1, vendido: 0 });
    await expect(ajustarVentaProductos(db, BigInt(100), [], [{ productoId: BigInt(5), cantidad: 4 }], BigInt(9))).rejects.toMatchObject({
      response: expect.objectContaining({ codigo: 'STOCK_INSUFICIENTE' }),
    });
  });

  it('sin cambios netos no toca el stock', async () => {
    const { db, estado } = crearDb({ saldo: 10, vendido: 3 });
    await ajustarVentaProductos(db, BigInt(100), [{ productoId: BigInt(5), cantidad: 2 }], [{ productoId: BigInt(5), cantidad: 2 }], BigInt(9));
    expect(estado.saldo).toBe(10);
    expect(estado.movimientos).toEqual([]);
  });
});
