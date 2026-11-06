import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  descontarVentaProductos,
  fijarAperturaProducto,
  fechaLimaHoy,
  quedanProductos,
} from './producto-controlado';
import { FECHA_HASTA_REACTIVAR } from '../cocina/cocina.util';

const HOY = '2026-11-05';
const AHORA = new Date('2026-11-05T15:00:00Z');
const DONA = 1n;
const LUGAR = 7n;

/** Base falsa mínima: evalúa los `where` que usa el módulo (igualdad, in, gte, not, none). */
function fakeDb(init: { producto?: any; stock?: number | null; apertura?: number | null; controla?: boolean }) {
  const st = {
    producto: { id: DONA, nombre: 'Dona', controla_stock: init.controla ?? true, agotado_hasta: null as Date | null },
    stock: init.stock === null || init.stock === undefined ? [] : [{ id: 9n, producto_id: DONA, lugar_id: LUGAR, cantidad: init.stock }],
    apertura: (init.apertura === null || init.apertura === undefined ? [] : [{ fecha: HOY, producto_id: DONA, sabor_id: null as bigint | null, lugar_id: LUGAR, cantidad: init.apertura }]) as any[],
    movimientos: [] as any[],
    agotados: [] as any[],
  };
  const cumple = (valor: any, cond: any) => {
    if (cond && typeof cond === 'object' && !(cond instanceof Prisma.Decimal) && !Array.isArray(cond)) {
      if ('gte' in cond) return Number(valor) >= Number(cond.gte);
      if ('not' in cond) return valor !== null && valor !== undefined;
      if ('in' in cond) return cond.in.some((x: any) => x === valor);
    }
    return valor === cond;
  };
  const filas = () => st.stock;
  const coincide = (f: any, where: any) => Object.entries(where ?? {}).every(([k, v]) => cumple(f[k], v));
  const db: any = {
    st,
    producto: {
      findMany: jest.fn(async ({ where }: any) =>
        where?.controla_stock === true && !st.producto.controla_stock ? [] : [{ id: DONA, nombre: 'Dona', controla_stock: st.producto.controla_stock }],
      ),
      findUnique: jest.fn(async () => ({ ...st.producto })),
      update: jest.fn(async ({ data }: any) => {
        Object.assign(st.producto, data);
        return { ...st.producto };
      }),
    },
    lugarStock: {
      findFirst: jest.fn(async ({ where }: any) => (where?.nombre === 'Salados' || where?.tipo ? { id: LUGAR } : null)),
    },
    stock: {
      findFirst: jest.fn(async ({ where }: any) => filas().find((f) => coincide(f, where)) ?? null),
      findMany: jest.fn(async ({ where }: any) => filas().filter((f) => coincide(f, where))),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const rows = filas().filter((f) => coincide(f, where));
        for (const r of rows) {
          if (data.cantidad?.decrement !== undefined) r.cantidad = Number(r.cantidad) - Number(data.cantidad.decrement);
          if (data.cantidad?.increment !== undefined) r.cantidad = Number(r.cantidad) + Number(data.cantidad.increment);
        }
        return { count: rows.length };
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const r = filas().find((f) => f.id === where.id)!;
        if (data.cantidad?.increment !== undefined) r.cantidad = Number(r.cantidad) + Number(data.cantidad.increment);
        return r;
      }),
      create: jest.fn(async ({ data }: any) => {
        const r = { id: 50n, ...data, cantidad: Number(data.cantidad) };
        st.stock.push(r);
        return r;
      }),
    },
    conteoApertura: {
      findFirst: jest.fn(async ({ where }: any) => {
        const f = st.apertura.find((a) => a.fecha === where.fecha.toISOString().slice(0, 10) && a.producto_id === where.producto_id && (a.sabor_id ?? null) === (where.sabor_id ?? null));
        return f ? { ...f } : null;
      }),
      findMany: jest.fn(async ({ where }: any) =>
        st.apertura.filter((a) => a.fecha === where.fecha.toISOString().slice(0, 10) && where.producto_id.in.includes(a.producto_id) && (a.sabor_id ?? null) === null),
      ),
      create: jest.fn(async ({ data }: any) => {
        const nueva = { id: 60n, fecha: data.fecha.toISOString().slice(0, 10), producto_id: data.producto_id, sabor_id: data.sabor_id ?? null, lugar_id: data.lugar_id, cantidad: Number(data.cantidad) };
        st.apertura.push(nueva);
        return nueva;
      }),
      update: jest.fn(async ({ data }: any) => {
        const f = st.apertura[0];
        f.cantidad = Number(data.cantidad);
        return f;
      }),
    },
    movimientoStock: {
      create: jest.fn(async ({ data }: any) => {
        st.movimientos.push(data);
        return data;
      }),
    },
    agotado: {
      create: jest.fn(async ({ data }: any) => st.agotados.push(data)),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
  };
  return db;
}

const venta = (cantidad: number, areaId: bigint | null = null) => ({ productoId: DONA, cantidad, areaId });
const saldo = (db: any) => db.st.stock.reduce((a: number, f: any) => a + Number(f.cantidad), 0);

describe('producto que controla stock (independiente de Control de almacén)', () => {
  it('la fecha de hoy es la de Lima (YYYY-MM-DD)', () => {
    expect(fechaLimaHoy(new Date('2026-11-06T02:00:00Z'))).toBe('2026-11-05');
  });

  describe('descontarVentaProductos', () => {
    it('sin apertura de hoy: el saldo sigue siendo el tope; con 2 y pedido de 5 responde 409 y no descuenta', async () => {
      const db = fakeDb({ stock: 2 });
      const err = await descontarVentaProductos(db, 100n, [venta(5)], 1n, AHORA).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({ codigo: 'STOCK_INSUFICIENTE', quedan: 2 });
      expect(saldo(db)).toBe(2);
      expect(db.st.movimientos).toHaveLength(0);
    });

    it('saldo 0 sin apertura de hoy: la venta responde 409 STOCK_INSUFICIENTE con quedan 0', async () => {
      const db = fakeDb({ stock: 0 });
      const err = await descontarVentaProductos(db, 100n, [venta(1)], 1n, AHORA).catch((e) => e);
      expect(err.getResponse()).toEqual({
        codigo: 'STOCK_INSUFICIENTE',
        mensaje: 'Solo quedan 0 de Dona',
        productoId: '1',
        quedan: 0,
      });
      expect(saldo(db)).toBe(0);
      expect(db.st.movimientos).toHaveLength(0);
    });

    it('saldo 5 sin apertura de hoy: vende 5 y la 6.ª unidad falla; al llegar a 0 se agota solo', async () => {
      const db = fakeDb({ stock: 5 });
      const res = await descontarVentaProductos(db, 100n, [venta(5)], 1n, AHORA);
      expect(saldo(db)).toBe(0);
      expect(res.agotados).toEqual([DONA]);
      expect(db.st.producto.agotado_hasta).toEqual(FECHA_HASTA_REACTIVAR);
      expect(db.st.agotados[0]).toMatchObject({ producto_id: DONA, alcance: 'HASTA_REACTIVAR' });
      const err = await descontarVentaProductos(db, 101n, [venta(1)], 1n, AHORA).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'STOCK_INSUFICIENTE', quedan: 0 });
      expect(db.st.movimientos).toHaveLength(1);
    });

    it('sin apertura de hoy: la venta que deja en 0 agota el producto (sin requerir conteo)', async () => {
      const db = fakeDb({ stock: 2 });
      const res = await descontarVentaProductos(db, 100n, [venta(2)], 1n, AHORA);
      expect(res.agotados).toEqual([DONA]);
      expect(db.st.producto.agotado_hasta).toEqual(FECHA_HASTA_REACTIVAR);
    });

    it('una venta que deja saldo > 0 no reactiva un producto agotado a mano por Cocina', async () => {
      const db = fakeDb({ stock: 5 });
      db.st.producto.agotado_hasta = FECHA_HASTA_REACTIVAR;
      await descontarVentaProductos(db, 100n, [venta(2)], 1n, AHORA);
      expect(db.st.producto.agotado_hasta).toEqual(FECHA_HASTA_REACTIVAR);
      expect(db.agotado.updateMany).not.toHaveBeenCalled();
    });

    it('con apertura hoy: si no alcanza responde 409 STOCK_INSUFICIENTE y no descuenta', async () => {
      const db = fakeDb({ stock: 4, apertura: 10 });
      const err = await descontarVentaProductos(db, 100n, [venta(5)], 1n, AHORA).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toEqual({
        codigo: 'STOCK_INSUFICIENTE',
        mensaje: 'Solo quedan 4 de Dona',
        productoId: '1',
        quedan: 4,
      });
      expect(saldo(db)).toBe(4);
      expect(db.st.movimientos).toHaveLength(0);
    });

    it('suma las líneas repetidas del mismo producto: 2 + 3 con saldo 4 es 409', async () => {
      const db = fakeDb({ stock: 4, apertura: 10 });
      const err = await descontarVentaProductos(db, 100n, [venta(2), venta(3)], 1n, AHORA).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'STOCK_INSUFICIENTE', quedan: 4 });
      expect(saldo(db)).toBe(4);
    });

    it('suma las líneas repetidas: 2 + 2 con saldo 4 pasa y descuenta 4 en un solo movimiento', async () => {
      const db = fakeDb({ stock: 4, apertura: 10 });
      await descontarVentaProductos(db, 100n, [venta(2), venta(2)], 1n, AHORA);
      expect(saldo(db)).toBe(0);
      expect(db.st.movimientos).toHaveLength(1);
      expect(Number(db.st.movimientos[0].cantidad)).toBe(4);
    });

    it('con apertura hoy y saldo que llega a 0: se agota solo (agotado_hasta y registro de agotado)', async () => {
      const db = fakeDb({ stock: 2, apertura: 10 });
      const res = await descontarVentaProductos(db, 100n, [venta(2)], 1n, AHORA);
      expect(res.agotados).toEqual([DONA]);
      expect(db.st.producto.agotado_hasta).toEqual(FECHA_HASTA_REACTIVAR);
      expect(db.st.agotados[0]).toMatchObject({ producto_id: DONA, alcance: 'HASTA_REACTIVAR' });
    });

    it('un producto sin la casilla no se toca', async () => {
      const db = fakeDb({ stock: 5, controla: false });
      const res = await descontarVentaProductos(db, 100n, [venta(2)], 1n, AHORA);
      expect(saldo(db)).toBe(5);
      expect(res.agotados).toEqual([]);
      expect(db.st.movimientos).toHaveLength(0);
    });
  });

  describe('fijarAperturaProducto (conteo de apertura)', () => {
    it('fija el saldo a la cantidad contada con un AJUSTE «Apertura del día» y guarda el conteo', async () => {
      const db = fakeDb({ stock: 0 });
      await fijarAperturaProducto(db, DONA, 10, null, 1n, AHORA, HOY);
      expect(saldo(db)).toBe(10);
      expect(db.st.movimientos[0]).toMatchObject({ tipo: 'AJUSTE', nota: 'Apertura del día' });
      expect(Number(db.st.movimientos[0].cantidad)).toBe(10);
      expect(db.st.apertura).toEqual([expect.objectContaining({ producto_id: DONA, cantidad: 10 })]);
    });

    it('corrige el mismo día: la segunda apertura ajusta solo la diferencia y no duplica el conteo', async () => {
      const db = fakeDb({ stock: 0 });
      await fijarAperturaProducto(db, DONA, 10, null, 1n, AHORA, HOY);
      await fijarAperturaProducto(db, DONA, 7, null, 1n, AHORA, HOY);
      expect(saldo(db)).toBe(7);
      expect(Number(db.st.movimientos[1].cantidad)).toBe(-3);
      expect(db.st.apertura).toHaveLength(1);
      expect(db.st.apertura[0].cantidad).toBe(7);
    });

    it('apertura en 0 agota; apertura con saldo reactiva lo que estaba agotado', async () => {
      const db = fakeDb({ stock: 0 });
      await fijarAperturaProducto(db, DONA, 0, null, 1n, AHORA, HOY);
      expect(db.st.producto.agotado_hasta).toEqual(FECHA_HASTA_REACTIVAR);
      await fijarAperturaProducto(db, DONA, 5, null, 1n, AHORA, HOY);
      expect(db.st.producto.agotado_hasta).toBeNull();
      expect(db.agotado.updateMany).toHaveBeenCalled();
    });
  });

  describe('quedanProductos (carta)', () => {
    it('da el saldo entero hacia abajo, sin negativos', async () => {
      const db = fakeDb({ stock: 3.7, apertura: 10 });
      expect((await quedanProductos(db, [DONA])).get('1')).toBe(3);
      db.st.stock[0].cantidad = -2;
      expect((await quedanProductos(db, [DONA])).get('1')).toBe(0);
    });

    it('sin apertura hoy también da el saldo: 3 de saldo es quedan 3 (el saldo es el tope)', async () => {
      const db = fakeDb({ stock: 3 });
      expect((await quedanProductos(db, [DONA])).get('1')).toBe(3);
    });

    it('saldo 0 sin apertura da quedan 0 (la carta no lo deja vender)', async () => {
      const db = fakeDb({ stock: 0 });
      expect((await quedanProductos(db, [DONA])).get('1')).toBe(0);
    });

    it('un producto que no controla stock no aparece (sin tope)', async () => {
      const db = fakeDb({ stock: 3, controla: false });
      expect((await quedanProductos(db, [DONA])).has('1')).toBe(false);
    });
  });
});
