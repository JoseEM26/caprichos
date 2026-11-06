import { ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  controlaPorSabor,
  descontarVentaProductos,
  estadoSaboresHoy,
  estadoSaborCarta,
  fijarAperturaSabor,
  validarSaboresLinea,
} from './producto-controlado';
import { FECHA_HASTA_REACTIVAR } from '../cocina/cocina.util';

// Fechas fijas: hoy en Lima es 2026-11-05 (15:00 UTC = 10:00 Lima)
const HOY = '2026-11-05';
const AHORA = new Date('2026-11-05T15:00:00Z');
const DONA = 1n;
const LUGAR = 7n;
const FRESA = 11n;
const OREO = 12n;
const MANJAR = 13n;

type Sabor = { id: bigint; nombre: string; activo: boolean; agotado_hasta: Date | null; producto_id: bigint };

/** Base falsa: solo lo que usa el módulo de productos por sabor (igualdad, in, gte, null, not). */
function fakeDb(init: {
  sabores?: Sabor[];
  stockSabor?: Record<string, number>;
  aperturaSabor?: Record<string, number>;
  controla?: boolean;
} = {}) {
  const st = {
    producto: { id: DONA, nombre: 'Dona', controla_stock: init.controla ?? true, agotado_hasta: null as Date | null },
    sabores: (init.sabores ?? [
      { id: FRESA, nombre: 'Fresa', activo: true, agotado_hasta: null, producto_id: DONA },
      { id: OREO, nombre: 'Oreo', activo: true, agotado_hasta: null, producto_id: DONA },
      { id: MANJAR, nombre: 'Manjar', activo: true, agotado_hasta: null, producto_id: DONA },
    ]) as Sabor[],
    stockSabor: Object.entries(init.stockSabor ?? {}).map(([k, v]) => ({ id: BigInt(k) * 10n, sabor_id: BigInt(k), cantidad: v })),
    apertura: Object.entries(init.aperturaSabor ?? {}).map(([k, v]) => ({
      id: BigInt(k) * 100n,
      fecha: HOY,
      producto_id: DONA,
      sabor_id: BigInt(k),
      lugar_id: LUGAR,
      cantidad: v,
    })),
    movimientos: [] as any[],
    agotados: [] as any[],
  };
  const soportaWhere = (valor: any, cond: any): boolean => {
    if (cond && typeof cond === 'object' && !(cond instanceof Prisma.Decimal) && !Array.isArray(cond) && !(cond instanceof Date)) {
      if ('gte' in cond) return Number(valor) >= Number(cond.gte);
      if ('in' in cond) return cond.in.some((x: any) => x === valor);
      if ('not' in cond) return valor !== null && valor !== undefined;
    }
    if (cond === null) return valor === null || valor === undefined;
    return valor === cond;
  };
  const coincide = (f: any, where: any) =>
    Object.entries(where ?? {}).every(([k, v]) => {
      if (k === 'fecha') return f.fecha === (v as Date).toISOString().slice(0, 10);
      return soportaWhere(f[k], v);
    });
  const sincronizar = (cant: any) => (cant?.decrement !== undefined ? -Number(cant.decrement) : cant?.increment !== undefined ? Number(cant.increment) : undefined);
  const db: any = {
    st,
    producto: {
      findMany: jest.fn(async () => [{ id: DONA, nombre: 'Dona', controla_stock: st.producto.controla_stock, sabores: st.sabores.filter((s) => s.activo).map((s) => ({ id: s.id })) }]),
      findUnique: jest.fn(async () => ({ ...st.producto })),
      update: jest.fn(async ({ data }: any) => Object.assign(st.producto, data)),
    },
    lugarStock: { findFirst: jest.fn(async () => ({ id: LUGAR })) },
    stock: {
      findFirst: jest.fn(async () => null),
      findMany: jest.fn(async () => []),
      updateMany: jest.fn(async () => ({ count: 0 })),
      create: jest.fn(async () => ({})),
    },
    sabor: {
      findUnique: jest.fn(async ({ where }: any) => {
        const s = st.sabores.find((x) => x.id === where.id);
        return s ? { ...s } : null;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const s = st.sabores.find((x) => x.id === where.id)!;
        Object.assign(s, data);
        return s;
      }),
    },
    stockSabor: {
      findUnique: jest.fn(async ({ where }: any) => st.stockSabor.find((f) => f.sabor_id === where.sabor_id) ?? null),
      findMany: jest.fn(async ({ where }: any) => st.stockSabor.filter((f) => where.sabor_id.in.includes(f.sabor_id))),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const filas = st.stockSabor.filter((f) => coincide(f, where));
        for (const f of filas) f.cantidad = Number(f.cantidad) + (sincronizar(data.cantidad) as number);
        return { count: filas.length };
      }),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const f = st.stockSabor.find((x) => x.sabor_id === where.sabor_id);
        if (f) {
          f.cantidad = Number(f.cantidad) + (sincronizar(update.cantidad) as number);
          return f;
        }
        const nueva = { id: 99n, sabor_id: create.sabor_id, cantidad: Number(create.cantidad) };
        st.stockSabor.push(nueva);
        return nueva;
      }),
      create: jest.fn(async ({ data }: any) => {
        const nueva = { id: 98n, sabor_id: data.sabor_id, cantidad: Number(data.cantidad) };
        st.stockSabor.push(nueva);
        return nueva;
      }),
    },
    conteoApertura: {
      findFirst: jest.fn(async ({ where }: any) => {
        const f = st.apertura.find((a) => coincide(a, where));
        return f ? { ...f } : null;
      }),
      findMany: jest.fn(async ({ where }: any) => st.apertura.filter((a) => coincide(a, where))),
      create: jest.fn(async ({ data }: any) => {
        const nueva = { id: 500n, fecha: HOY, producto_id: data.producto_id, sabor_id: data.sabor_id ?? null, lugar_id: data.lugar_id, cantidad: Number(data.cantidad) };
        st.apertura.push(nueva);
        return nueva;
      }),
      update: jest.fn(async ({ where, data }: any) => {
        const f = st.apertura.find((a) => a.id === where.id)!;
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

const saldoSabor = (db: any, id: bigint) => Number(db.st.stockSabor.find((f: any) => f.sabor_id === id)?.cantidad ?? 0);
const sabores = (): Sabor[] => fakeDb().st.sabores;

describe('productos por sabor (stock de donas y galletas con sabores)', () => {
  describe('controlaPorSabor', () => {
    it('solo si controla stock y tiene al menos un sabor activo', () => {
      expect(controlaPorSabor({ controla_stock: true, sabores: [{ activo: true }] })).toBe(true);
      expect(controlaPorSabor({ controla_stock: true, sabores: [{ activo: false }] })).toBe(false);
      expect(controlaPorSabor({ controla_stock: true, sabores: [] })).toBe(false);
      expect(controlaPorSabor({ controla_stock: false, sabores: [{ activo: true }] })).toBe(false);
    });
  });

  describe('validarSaboresLinea (unidades por tamaño)', () => {
    const prod = { id: DONA, nombre: 'Dona', sabores: sabores() };

    it('reparte las unidades del tamaño: media docena (6) entre tres sabores', () => {
      const r = validarSaboresLinea(prod, 6, 1, [
        { saborId: FRESA, cantidad: 2 },
        { saborId: OREO, cantidad: 3 },
        { saborId: MANJAR, cantidad: 1 },
      ], AHORA);
      expect(r.map((s) => [s.nombre, s.cantidad])).toEqual([
        ['Fresa', 2],
        ['Oreo', 3],
        ['Manjar', 1],
      ]);
    });

    it('la cantidad de la línea multiplica las unidades: 2 docenas (12 × 2) = 24', () => {
      expect(() => validarSaboresLinea(prod, 12, 2, [{ saborId: FRESA, cantidad: 24 }], AHORA)).not.toThrow();
      expect(() => validarSaboresLinea(prod, 12, 2, [{ saborId: FRESA, cantidad: 12 }], AHORA)).toThrow(BadRequestException);
    });

    it('suma inválida: 400 SABORES_INVALIDOS con mensaje claro', () => {
      const err: any = (() => {
        try {
          validarSaboresLinea(prod, 6, 1, [{ saborId: FRESA, cantidad: 2 }, { saborId: OREO, cantidad: 3 }], AHORA);
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toMatchObject({ codigo: 'SABORES_INVALIDOS' });
      expect(err.getResponse().mensaje).toContain('suman 5');
    });

    it('sin sabores enviados: 400 SABORES_INVALIDOS', () => {
      expect(() => validarSaboresLinea(prod, 1, 1, undefined, AHORA)).toThrow(BadRequestException);
      expect(() => validarSaboresLinea(prod, 1, 1, [], AHORA)).toThrow(BadRequestException);
    });

    it('sabor de otro producto: 400 SABORES_INVALIDOS', () => {
      const otro = { id: 99n, nombre: 'Ajeno', activo: true, agotado_hasta: null, producto_id: 2n };
      expect(() => validarSaboresLinea(prod, 1, 1, [{ saborId: otro.id, cantidad: 1 }], AHORA)).toThrow(BadRequestException);
    });

    it('sabor inactivo: 400 SABORES_INVALIDOS', () => {
      const inactivo = { ...prod, sabores: prod.sabores.map((s) => (s.id === FRESA ? { ...s, activo: false } : s)) };
      expect(() => validarSaboresLinea(inactivo, 1, 1, [{ saborId: FRESA, cantidad: 1 }], AHORA)).toThrow(BadRequestException);
    });

    it('sabor agotado: 409 SABOR_AGOTADO con productoId, saborId y saborNombre', () => {
      const agotado = { ...prod, sabores: prod.sabores.map((s) => (s.id === OREO ? { ...s, agotado_hasta: FECHA_HASTA_REACTIVAR } : s)) };
      const err: any = (() => {
        try {
          validarSaboresLinea(agotado, 1, 1, [{ saborId: OREO, cantidad: 1 }], AHORA);
        } catch (e) {
          return e;
        }
      })();
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toEqual({
        codigo: 'SABOR_AGOTADO',
        mensaje: 'El sabor Oreo está agotado',
        productoId: '1',
        saborId: '12',
        saborNombre: 'Oreo',
      });
    });

    it('varias entradas del mismo sabor en una línea se suman', () => {
      const r = validarSaboresLinea(prod, 6, 1, [{ saborId: FRESA, cantidad: 2 }, { saborId: FRESA, cantidad: 4 }], AHORA);
      expect(r).toEqual([expect.objectContaining({ saborId: FRESA, cantidad: 6 })]);
    });
  });

  describe('descontarVentaProductos por sabor', () => {
    const linea = (sabores: Array<[bigint, string, number]>, cantidad = 1) => ({
      productoId: DONA,
      cantidad,
      sabores: sabores.map(([saborId, nombre, c]) => ({ saborId, nombre, cantidad: c })),
    });

    it('reparte la venta entre sabores: cada sabor baja lo suyo y cada uno tiene su VENTA con sabor_id', async () => {
      const db = fakeDb({ stockSabor: { 11: 5, 12: 5, 13: 5 } });
      await descontarVentaProductos(db, 100n, [linea([[FRESA, 'Fresa', 2], [OREO, 'Oreo', 3], [MANJAR, 'Manjar', 1]], 1)], 1n, AHORA);
      expect([saldoSabor(db, FRESA), saldoSabor(db, OREO), saldoSabor(db, MANJAR)]).toEqual([3, 2, 4]);
      expect(db.st.movimientos.map((m: any) => [m.tipo, m.sabor_id, Number(m.cantidad), m.producto_id])).toEqual([
        ['VENTA', FRESA, 2, DONA],
        ['VENTA', OREO, 3, DONA],
        ['VENTA', MANJAR, 1, DONA],
      ]);
      expect(db.st.movimientos.every((m: any) => m.pedido_id === 100n)).toBe(true);
    });

    it('sin apertura de hoy del sabor: resta sin tope y no agota', async () => {
      const db = fakeDb({ stockSabor: { 11: 1 } });
      const res = await descontarVentaProductos(db, 100n, [linea([[FRESA, 'Fresa', 4]], 4)], 1n, AHORA);
      expect(saldoSabor(db, FRESA)).toBe(-3);
      expect(res.saboresAgotados).toEqual([]);
      expect(db.st.agotados).toHaveLength(0);
    });

    it('con apertura de hoy: pedir más que el saldo del sabor responde 409 STOCK_INSUFICIENTE y no descuenta', async () => {
      const db = fakeDb({ stockSabor: { 11: 2 }, aperturaSabor: { 11: 10 } });
      const err: any = await descontarVentaProductos(db, 100n, [linea([[FRESA, 'Fresa', 3]], 3)], 1n, AHORA).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toEqual({
        codigo: 'STOCK_INSUFICIENTE',
        mensaje: 'Solo quedan 2 de Fresa',
        productoId: '1',
        saborId: '11',
        saborNombre: 'Fresa',
        quedan: 2,
      });
      expect(saldoSabor(db, FRESA)).toBe(2);
      expect(db.st.movimientos).toHaveLength(0);
    });

    it('varias líneas del mismo sabor se validan juntas contra el saldo (2 + 3 con saldo 4 = 409)', async () => {
      const db = fakeDb({ stockSabor: { 11: 4 }, aperturaSabor: { 11: 10 } });
      const err: any = await descontarVentaProductos(
        db,
        100n,
        [linea([[FRESA, 'Fresa', 2]]), linea([[FRESA, 'Fresa', 3]])],
        1n,
        AHORA,
      ).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'STOCK_INSUFICIENTE', quedan: 4 });
      expect(saldoSabor(db, FRESA)).toBe(4);
    });

    it('concurrencia: el UPDATE condicional gana una sola vez; la segunda venta del último saldo responde 409', async () => {
      const db = fakeDb({ stockSabor: { 11: 3 }, aperturaSabor: { 11: 10 } });
      await descontarVentaProductos(db, 100n, [linea([[FRESA, 'Fresa', 3]], 3)], 1n, AHORA);
      expect(saldoSabor(db, FRESA)).toBe(0);
      const err: any = await descontarVentaProductos(db, 101n, [linea([[FRESA, 'Fresa', 1]])], 1n, AHORA).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'STOCK_INSUFICIENTE', quedan: 0 });
    });

    it('con apertura y saldo que llega a 0: se agota solo ese sabor (sabor.agotado_hasta y agotado tipo SABOR)', async () => {
      const db = fakeDb({ stockSabor: { 11: 2, 12: 5 }, aperturaSabor: { 11: 10, 12: 10 } });
      const res = await descontarVentaProductos(db, 100n, [linea([[FRESA, 'Fresa', 2]], 2)], 1n, AHORA);
      expect(res.saboresAgotados).toEqual([FRESA]);
      expect(res.agotados).toEqual([]);
      expect(db.st.sabores.find((s: Sabor) => s.id === FRESA)!.agotado_hasta).toEqual(FECHA_HASTA_REACTIVAR);
      expect(db.st.sabores.find((s: Sabor) => s.id === OREO)!.agotado_hasta).toBeNull();
      expect(db.st.agotados[0]).toMatchObject({ sabor_id: FRESA, tipo: 'SABOR', alcance: 'HASTA_REACTIVAR' });
      expect(db.st.producto.agotado_hasta).toBeNull();
    });

    it('un producto por sabor sin reparto en la línea: 400 SABORES_INVALIDOS (defensa en el servidor)', async () => {
      const db = fakeDb({ stockSabor: { 11: 5 } });
      const err: any = await descontarVentaProductos(db, 100n, [{ productoId: DONA, cantidad: 1 }], 1n, AHORA).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect(err.getResponse()).toMatchObject({ codigo: 'SABORES_INVALIDOS' });
    });
  });

  describe('fijarAperturaSabor (conteo de apertura por sabor)', () => {
    it('fija el saldo del sabor con un AJUSTE «Apertura del día» con sabor_id y guarda el conteo del sabor', async () => {
      const db = fakeDb({ stockSabor: { 11: 0 } });
      await fijarAperturaSabor(db, DONA, FRESA, 6, null, 1n, AHORA, HOY);
      expect(saldoSabor(db, FRESA)).toBe(6);
      expect(db.st.movimientos[0]).toMatchObject({ tipo: 'AJUSTE', nota: 'Apertura del día', sabor_id: FRESA });
      expect(db.st.apertura).toEqual([expect.objectContaining({ sabor_id: FRESA, cantidad: 6 })]);
    });

    it('corrige el mismo día sin duplicar el conteo del sabor, y no toca el de otro sabor', async () => {
      const db = fakeDb({ stockSabor: { 11: 0, 12: 0 } });
      await fijarAperturaSabor(db, DONA, FRESA, 6, null, 1n, AHORA, HOY);
      await fijarAperturaSabor(db, DONA, OREO, 4, null, 1n, AHORA, HOY);
      await fijarAperturaSabor(db, DONA, FRESA, 2, null, 1n, AHORA, HOY);
      expect(saldoSabor(db, FRESA)).toBe(2);
      expect(saldoSabor(db, OREO)).toBe(4);
      expect(db.st.apertura.filter((a: any) => a.sabor_id === FRESA)).toHaveLength(1);
      expect(db.st.apertura.filter((a: any) => a.sabor_id === OREO)).toHaveLength(1);
    });

    it('apertura en 0 agota ese sabor; apertura con saldo lo reactiva', async () => {
      const db = fakeDb({ stockSabor: { 11: 3 } });
      await fijarAperturaSabor(db, DONA, FRESA, 0, null, 1n, AHORA, HOY);
      expect(db.st.sabores.find((s: Sabor) => s.id === FRESA)!.agotado_hasta).toEqual(FECHA_HASTA_REACTIVAR);
      await fijarAperturaSabor(db, DONA, FRESA, 5, null, 1n, AHORA, HOY);
      expect(db.st.sabores.find((s: Sabor) => s.id === FRESA)!.agotado_hasta).toBeNull();
      expect(db.agotado.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ sabor_id: FRESA }) }));
    });
  });

  describe('lectura para la carta y el admin', () => {
    it('quedan del sabor solo con apertura de hoy; sin apertura es null (sin tope)', async () => {
      const db = fakeDb({ stockSabor: { 11: 3.8, 12: 9 }, aperturaSabor: { 11: 10 } });
      const mapa = await estadoSaboresHoy(db, [FRESA, OREO], HOY);
      expect(mapa.get('11')).toMatchObject({ saldo: 3.8, aperturaHoy: true });
      expect(mapa.get('12')).toMatchObject({ saldo: 9, aperturaHoy: false });
      const sab = db.st.sabores.find((s: Sabor) => s.id === FRESA)!;
      expect(estadoSaborCarta(sab, mapa.get('11'), AHORA)).toEqual({
        id: '11',
        nombre: 'Fresa',
        activo: true,
        disponible: true,
        quedan: 3,
      });
      const oreo = db.st.sabores.find((s: Sabor) => s.id === OREO)!;
      expect(estadoSaborCarta(oreo, mapa.get('12'), AHORA)).toMatchObject({ disponible: true, quedan: null });
    });

    it('un sabor agotado, o a 0 con apertura de hoy, no está disponible', () => {
      const base = { id: FRESA, nombre: 'Fresa', activo: true, agotado_hasta: null };
      expect(estadoSaborCarta({ ...base, agotado_hasta: FECHA_HASTA_REACTIVAR }, undefined, AHORA).disponible).toBe(false);
      expect(estadoSaborCarta(base, { saldo: 0, aperturaHoy: true }, AHORA)).toMatchObject({ disponible: false, quedan: 0 });
    });
  });
});
