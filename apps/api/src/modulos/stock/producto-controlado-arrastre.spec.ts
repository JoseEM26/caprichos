import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AlmacenService } from '../almacen/almacen.service';
import { mermarProductoControlado, registrarAperturaArrastre } from './producto-controlado';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

// Hoy en Lima: 2026-11-05 (15:00 UTC = 10:00 Lima)
const HOY = '2026-11-05';
const AHORA = new Date('2026-11-05T15:00:00Z');
const DONA = 1n;
const LUGAR = 7n;
const FRESA = 11n;
const OREO = 12n;

type Row = Record<string, any>;

/** Tabla en memoria: solo lo que usan el arrastre, la merma y la apertura (where, select, create, update, upsert, count). */
class Tabla {
  filas: Row[] = [];
  private siguiente = 100n;
  constructor(filas: Row[] = []) {
    this.filas = filas;
  }
  private cumple(f: Row, where: Row = {}): boolean {
    return Object.entries(where).every(([k, v]) => {
      const val = f[k];
      if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof Prisma.Decimal) && !Array.isArray(v)) {
        if ('gte' in v) return Number(val) >= Number(v.gte);
        if ('in' in v) return v.in.some((x: any) => String(x) === String(val));
      }
      if (v === null) return val === null || val === undefined;
      if (v instanceof Date) return val instanceof Date ? val.getTime() === v.getTime() : false;
      return String(val) === String(v);
    });
  }
  private filtrar(where?: Row) {
    return this.filas.filter((f) => this.cumple(f, where));
  }
  private aplicar(f: Row, data: Row) {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && 'decrement' in v) f[k] = Number(f[k]) - Number(v.decrement);
      else if (v && typeof v === 'object' && 'increment' in v) f[k] = Number(f[k] ?? 0) + Number(v.increment);
      else f[k] = v;
    }
  }
  findMany = async (args: Row = {}) => this.filtrar(args.where).map((f) => ({ ...f }));
  findFirst = async (args: Row = {}) => {
    const f = this.filtrar(args.where)[0];
    return f ? { ...f } : null;
  };
  findUnique = this.findFirst;
  count = async (args: Row = {}) => this.filtrar(args.where).length;
  create = async ({ data }: Row) => {
    // Como el default de la base: `en` = momento del registro (el reloj de la prueba)
    const fila = { id: this.siguiente++, en: AHORA, ...data };
    this.filas.push(fila);
    return { ...fila };
  };
  update = async ({ where, data }: Row) => {
    const f = this.filtrar(where)[0];
    if (!f) throw new Error('registro no encontrado');
    this.aplicar(f, data);
    return { ...f };
  };
  updateMany = async ({ where, data }: Row) => {
    const sel = this.filtrar(where);
    sel.forEach((f) => this.aplicar(f, data));
    return { count: sel.length };
  };
  upsert = async ({ where, update, create }: Row) => {
    const f = this.filtrar(where)[0];
    if (f) {
      this.aplicar(f, update);
      return { ...f };
    }
    return this.create({ data: create });
  };
}

/** Base en memoria con un producto de donas (sin sabores) y otro con sabores (Fresa y Oreo). */
function fakeDb(init: { stock?: number; stockSabor?: Record<string, number>; controla?: boolean } = {}) {
  const db: Row = {
    producto: new Tabla([
      { id: DONA, nombre: 'Dona', controla_stock: init.controla ?? true, agotado_hasta: null, sabores: [] },
    ]),
    lugarStock: new Tabla([{ id: LUGAR, nombre: 'Salados', tipo: 'AREA', area_id: null }]),
    stock: new Tabla(init.stock === undefined ? [] : [{ id: 1n, producto_id: DONA, lugar_id: LUGAR, cantidad: init.stock }]),
    stockSabor: new Tabla(
      Object.entries(init.stockSabor ?? {}).map(([k, v]) => ({ id: BigInt(k) * 10n, sabor_id: BigInt(k), cantidad: v })),
    ),
    sabor: new Tabla([
      { id: FRESA, nombre: 'Fresa', activo: true, agotado_hasta: null, producto_id: DONA },
      { id: OREO, nombre: 'Oreo', activo: true, agotado_hasta: null, producto_id: DONA },
    ]),
    conteoApertura: new Tabla(),
    movimientoStock: new Tabla(),
    agotado: new Tabla(),
  };
  // Solo con stockSabor el producto es «por sabor» (controlaPorSabor exige sabores activos)
  db.producto.filas[0].sabores = init.stockSabor ? db.sabor.filas : [];
  return db;
}

const saldoDona = (db: Row) => db.stock.filas.reduce((a: number, f: Row) => a + Number(f.cantidad), 0);

describe('Apertura con arrastre (producto-controlado)', () => {
  it('arrastra lo que quedó de ayer y suma lo producido hoy: total = quedaron + produccion', async () => {
    const db = fakeDb({ stock: 4 });
    await registrarAperturaArrastre(db, {
      productoId: DONA, saborId: null, quedaron: 4, produccion: 6, areaId: null, por: 1n, ahora: AHORA, fecha: HOY,
    });
    expect(saldoDona(db)).toBe(10);
    const conteo = db.conteoApertura.filas.find((f: Row) => f.sabor_id === null);
    expect(Number(conteo.cantidad)).toBe(10);
    const prod = db.movimientoStock.filas.find((m: Row) => m.nota === 'Produje hoy');
    expect(Number(prod.cantidad)).toBe(6);
    expect(prod.tipo).toBe('ENTRADA');
  });

  it('una segunda apertura el mismo día no pierde lo producido antes: solo suma lo nuevo', async () => {
    const db = fakeDb({ stock: 4 });
    await registrarAperturaArrastre(db, {
      productoId: DONA, saborId: null, quedaron: 4, produccion: 6, areaId: null, por: 1n, ahora: AHORA, fecha: HOY,
    });
    // «Quedaron de ayer» que sugiere la pantalla = saldo (10) - producido hoy (6) = 4
    await registrarAperturaArrastre(db, {
      productoId: DONA, saborId: null, quedaron: 4, produccion: 3, areaId: null, por: 1n, ahora: AHORA, fecha: HOY,
    });
    expect(saldoDona(db)).toBe(13);
    expect(Number(db.conteoApertura.filas[0].cantidad)).toBe(13);
  });

  it('si se vendió más que lo de ayer, la pantalla propone 0 («sin cambios»): guardar solo suma lo nuevo y no devuelve lo vendido', async () => {
    const db = fakeDb({ stock: 2 });
    await registrarAperturaArrastre(db, { productoId: DONA, saborId: null, quedaron: 2, produccion: 10, areaId: null, por: 1n, ahora: AHORA, fecha: HOY });
    db.stock.filas[0].cantidad = Number(db.stock.filas[0].cantidad) - 5; // se vendieron 5 → saldo 7 (producido hoy 10)
    // «Quedaron de ayer» propuesto = max(0, 7 - 10) = 0
    await registrarAperturaArrastre(db, { productoId: DONA, saborId: null, quedaron: 0, produccion: 3, areaId: null, por: 1n, ahora: AHORA, fecha: HOY });
    expect(saldoDona(db)).toBe(10); // 7 + 3 (antes quedaba en 13)
    // Si el usuario SÍ escribe otro conteo, ese conteo manda
    await registrarAperturaArrastre(db, { productoId: DONA, saborId: null, quedaron: 1, produccion: 0, areaId: null, por: 1n, ahora: AHORA, fecha: HOY });
    expect(saldoDona(db)).toBe(14); // 1 + 13 producidos hoy
  });

  it('si se contó distinto ayer, corrige el saldo a lo contado (AJUSTE) sin reiniciar', async () => {
    const db = fakeDb({ stock: 4 });
    await registrarAperturaArrastre(db, {
      productoId: DONA, saborId: null, quedaron: 2, produccion: 0, areaId: null, por: 1n, ahora: AHORA, fecha: HOY,
    });
    expect(saldoDona(db)).toBe(2);
    expect(db.movimientoStock.filas.some((m: Row) => m.tipo === 'AJUSTE')).toBe(true);
  });

  it('por sabor: arrastra el saldo del sabor y suma su producción', async () => {
    const db = fakeDb({ stockSabor: { [String(FRESA)]: 5 } });
    await registrarAperturaArrastre(db, {
      productoId: DONA, saborId: FRESA, quedaron: 5, produccion: 4, areaId: null, por: 1n, ahora: AHORA, fecha: HOY,
    });
    const sab = db.stockSabor.filas.find((f: Row) => f.sabor_id === FRESA);
    expect(Number(sab.cantidad)).toBe(9);
  });
});

describe('Merma de producto terminado (producto-controlado)', () => {
  it('descuenta del saldo del producto y deja MERMA con motivo y quién la hizo', async () => {
    const db = fakeDb({ stock: 10 });
    const r = await mermarProductoControlado(db, {
      productoId: DONA, nombre: 'Dona', saborId: null, cantidad: 3, motivo: 'VENCIDO', nota: null,
      areaId: null, por: 9n, ahora: AHORA, fecha: HOY,
    });
    expect(saldoDona(db)).toBe(7);
    expect(r.saldo).toBe(7);
    const mov = db.movimientoStock.filas.find((m: Row) => m.tipo === 'MERMA');
    expect(Number(mov.cantidad)).toBe(-3);
    expect(mov.nota).toBe('Merma · Vencido');
    expect(String(mov.por)).toBe('9');
  });

  it('descuenta del sabor indicado y guarda la nota del motivo Otro', async () => {
    const db = fakeDb({ stockSabor: { [String(FRESA)]: 6 } });
    await mermarProductoControlado(db, {
      productoId: DONA, nombre: 'Dona', saborId: FRESA, saborNombre: 'Fresa', cantidad: 2, motivo: 'OTRO', nota: 'Cayó al piso',
      areaId: null, por: 1n, ahora: AHORA, fecha: HOY,
    });
    const sab = db.stockSabor.filas.find((f: Row) => f.sabor_id === FRESA);
    expect(Number(sab.cantidad)).toBe(4);
    const mov = db.movimientoStock.filas.find((m: Row) => m.tipo === 'MERMA');
    expect(String(mov.sabor_id)).toBe(String(FRESA));
    expect(mov.nota).toBe('Merma · Otro · Cayó al piso');
  });

  it('una merma mayor al saldo se rechaza (409) y no toca el stock', async () => {
    const db = fakeDb({ stock: 2 });
    await expect(
      mermarProductoControlado(db, {
        productoId: DONA, nombre: 'Dona', saborId: null, cantidad: 3, motivo: 'DANADO', nota: null,
        areaId: null, por: 1n, ahora: AHORA, fecha: HOY,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(saldoDona(db)).toBe(2);
    expect(db.movimientoStock.filas.length).toBe(0);
  });
});

describe('Merma desde el servicio de almacén (con el control de almacén apagado)', () => {
  const usuario = { partyId: 5n, rol: 'COCINA', debeCambiar: false } as any;

  /** Servicio con prisma en memoria; el parámetro stock_control_activo está apagado (no existe) y se vigila. */
  function servicioCon(db: Row) {
    const parametro = { findUnique: jest.fn(async () => null) };
    const prisma: any = {
      ...db,
      parametro,
      producto: { ...db.producto, findUnique: db.producto.findUnique },
      $transaction: async (cb: (tx: any) => any) => cb({ ...db, parametro }),
    };
    const auditoria = { registrar: jest.fn(async () => ({})) };
    const eventos = { emitirAdmin: jest.fn() };
    const service = new AlmacenService(prisma, auditoria as any, eventos as any);
    return { service, parametro, auditoria };
  }

  it('registra la merma sin código de supervisor, sin consultar el interruptor y con auditoría', async () => {
    const db = fakeDb({ stock: 8 });
    const { service, parametro, auditoria } = servicioCon(db);
    const r = await service.registrarMermaProducto(
      { productoId: String(DONA), cantidad: 5, motivo: 'SE_CAYO' } as any,
      usuario,
      '10.0.0.1',
    );
    expect(r.saldo).toBe(3);
    expect(parametro.findUnique).not.toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'MERMA_PRODUCTO', partyId: 5n, ip: '10.0.0.1' }),
      expect.anything(),
    );
  });

  it('el motivo Otro exige nota', async () => {
    const { service } = servicioCon(fakeDb({ stock: 8 }));
    await expect(
      service.registrarMermaProducto({ productoId: String(DONA), cantidad: 1, motivo: 'OTRO' } as any, usuario),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('un producto por sabor exige el sabor de la merma', async () => {
    const db = fakeDb({ stockSabor: { [String(FRESA)]: 4 } });
    const { service } = servicioCon(db);
    await expect(
      service.registrarMermaProducto({ productoId: String(DONA), cantidad: 1, motivo: 'VENCIDO' } as any, usuario),
    ).rejects.toMatchObject({ response: { codigo: 'SABOR_REQUERIDO' } });
  });
});
