/**
 * Auditoría del descuento de INSUMOS por receta (al cobrar) y de las anulaciones fuera de Caja, contra un Postgres
 * REAL. Complementa auditoria-stock.pg.spec.ts (productos terminados). Misma preparación:
 *   AUDITORIA_PG_URL=<url de una base desechable con las migraciones> npx jest auditoria-insumos.pg
 * Sin AUDITORIA_PG_URL se omite (CI normal).
 */
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../clientes/party-puntos.service', () => ({ PartyPuntosService: class {} }));
import { PrismaClient } from '@prisma/client';
import { StockService } from './stock.service';
import { descontarVentaProductos, saldoProducto } from './producto-controlado';
import { AlmacenService } from '../almacen/almacen.service';
import { ReprogramacionService, MOTIVO_RETIRO } from '../chatbot/servicios/reprogramacion.service';

const URL_PG = process.env.AUDITORIA_PG_URL;
const suite = URL_PG ? describe : describe.skip;
const POR = BigInt(1);

suite('Auditoría de insumos por receta en Postgres real', () => {
  let prisma: PrismaClient;
  let lugarId: bigint;
  let areaId: bigint;
  let categoriaId: bigint;
  let listaId: bigint;
  let n = 0;
  const uniq = (p: string) => `${p}-${Date.now()}-${++n}`;
  const stockSvc = () => new StockService(prisma as any, {} as any);

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: URL_PG! } } });
    areaId = (await prisma.areaCocina.create({ data: { nombre: uniq('Area') } })).id;
    categoriaId = (await prisma.categoria.create({ data: { nombre: uniq('Cat'), area_id: areaId } })).id;
    lugarId = (await prisma.lugarStock.findFirst({ where: { nombre: 'Salados' } }))?.id
      ?? (await prisma.lugarStock.create({ data: { nombre: 'Salados', tipo: 'AREA' } })).id;
    listaId = (await prisma.lista.create({ data: { nombre: uniq('Lista'), codigo: uniq('L') } })).id;
    await prisma.parametro.upsert({ where: { clave: 'stock_control_activo' }, update: { valor: 'si' }, create: { clave: 'stock_control_activo', valor: 'si' } });
  });
  afterAll(async () => {
    await prisma.parametro.update({ where: { clave: 'stock_control_activo' }, data: { valor: 'no' } });
    await prisma.$disconnect();
  });

  const mkProducto = (controla = false) =>
    prisma.producto.create({ data: { nombre: uniq('Prod'), precio: 10, categoria_id: categoriaId, controla_stock: controla } });
  const mkInsumo = async (cantidad: number, factorReceta = 1) => {
    const ins = await prisma.insumo.create({
      data: { nombre: uniq('Ins'), unidad_compra: 'u', unidad_almacen: 'u', unidad_receta: 'u', factor_compra: 1, factor_receta: factorReceta, minimo: 0, maximo: 1000 },
    });
    await prisma.stock.create({ data: { insumo_id: ins.id, lugar_id: lugarId, cantidad } });
    return ins.id;
  };
  const saldoIns = async (id: bigint) => (await prisma.stock.findMany({ where: { insumo_id: id } })).reduce((a, s) => a + Number(s.cantidad), 0);
  const receta = async (productoId: bigint, lineas: Array<[bigint, number]>, tamanoValorId: bigint | null = null) => {
    const r = await prisma.receta.create({ data: { producto_id: productoId, tamano_valor_id: tamanoValorId } });
    for (const [insumo_id, cantidad] of lineas) await prisma.recetaLinea.create({ data: { receta_id: r.id, insumo_id, cantidad } });
    return r;
  };
  const mkPedido = async (extra: any = {}) =>
    (await prisma.pedido.create({ data: { codigo: uniq('P'), modalidad: 'MESA', subtotal: 0, total: 0, ...extra } })).id;
  const linea = (pedido_id: bigint, producto_id: bigint | null, cantidad: number, extra: any = {}) =>
    prisma.pedidoLinea.create({ data: { pedido_id, producto_id, nombre: 'x', cantidad, precio_unit: 1, area_id: areaId, ...extra } });

  it('I1. combo x2: la madre no descuenta; cada hija descuenta su receta (y la de SU tamaño, no la base)', async () => {
    const host = await mkProducto();
    const hostIns = await mkInsumo(100);
    await receta(host.id, [[hostIns, 7]]); // el anfitrión no debe consumir nada
    const cafe = await mkProducto();
    const insCafe = await mkInsumo(100);
    const tam = await prisma.listaValor.create({ data: { lista_id: listaId, nombre: uniq('Grande') } });
    await prisma.productoTamano.create({ data: { producto_id: cafe.id, tamano_valor_id: tam.id, precio: 5 } });
    await receta(cafe.id, [[insCafe, 2]]); // receta base
    await receta(cafe.id, [[insCafe, 5]], tam.id); // receta del tamaño
    const torta = await mkProducto();
    const insTorta = await mkInsumo(100);
    await receta(torta.id, [[insTorta, 3]]);

    const ped = await mkPedido();
    const madre = await linea(ped, null, 2); // contenedora (producto_id null) de 2 combos
    await linea(ped, cafe.id, 2, { linea_combo_id: madre.id, tamano: tam.nombre });
    await linea(ped, torta.id, 2, { linea_combo_id: madre.id });
    await stockSvc().descontarPorPedido(ped);
    expect(await saldoIns(hostIns)).toBe(100);
    expect(await saldoIns(insCafe)).toBe(100 - 2 * 5);
    expect(await saldoIns(insTorta)).toBe(100 - 2 * 3);
    await stockSvc().descontarPorPedido(ped); // idempotente
    expect(await saldoIns(insCafe)).toBe(90);
  });

  it('I2. opción ligada a insumo (leche +S/99, y una de costo 0): descuenta su insumo x cantidad, no el precio', async () => {
    const p = await mkProducto();
    const base = await mkInsumo(100);
    const leche = await mkInsumo(100);
    await receta(p.id, [[base, 1]]);
    const grupo = await prisma.grupoOpciones.create({ data: { nombre: uniq('Leche'), maximo: 2 } });
    const mkOpcion = async (precio: number, insumo?: bigint, cant = 0) => {
      const valor = await prisma.listaValor.create({ data: { lista_id: listaId, nombre: uniq('Op') } });
      const op = await prisma.opcion.create({ data: { grupo_id: grupo.id, valor_id: valor.id, precio_extra: precio } });
      if (insumo) await prisma.ajusteOpcion.create({ data: { opcion_id: op.id, insumo_id: insumo, efecto: 'SUMA', cantidad: cant } });
      return op.id;
    };
    const opLeche = await mkOpcion(99, leche, 0.25); // +S/99: el precio no cambia lo que se descuenta
    const opSinCosto = await mkOpcion(0, leche, 0.1); // costo 0 también descuenta
    const ped = await mkPedido();
    const l = await linea(ped, p.id, 2);
    for (const opcion_id of [opLeche, opSinCosto]) {
      await prisma.pedidoLineaOpcion.create({ data: { pedido_linea_id: l.id, opcion_id, grupo_nombre: 'g', opcion_nombre: 'o', precio_unit: 0, precio_extra: 0 } });
    }
    await stockSvc().descontarPorPedido(ped);
    expect(await saldoIns(base)).toBe(98);
    expect(await saldoIns(leche)).toBeCloseTo(100 - 2 * (0.25 + 0.1), 6);
  });

  it('I3. cortesía de línea (precio 0) consume receta igual que una venta', async () => {
    const p = await mkProducto();
    const ins = await mkInsumo(50);
    await receta(p.id, [[ins, 4]]);
    const ped = await mkPedido();
    await linea(ped, p.id, 1, { es_cortesia: true, precio_unit: 0, subtotal: 0 });
    await linea(ped, p.id, 2);
    await stockSvc().descontarPorPedido(ped);
    expect(await saldoIns(ins)).toBe(50 - 3 * 4);
  });

  it.failing('I4 (PENDIENTE, ver informe). redondeo: 10 ventas de 0.4 g con almacén en kg descuentan 0.004 kg en total', async () => {
    const p = await mkProducto();
    const ins = await mkInsumo(10, 1000); // receta en g, almacén en kg
    await receta(p.id, [[ins, 0.4]]);
    for (let i = 0; i < 10; i++) {
      const ped = await mkPedido();
      await linea(ped, p.id, 1);
      await stockSvc().descontarPorPedido(ped);
    }
    expect(await saldoIns(ins)).toBeCloseTo(10 - 0.004, 6);
  });

  it('I5. producción: anular devuelve exactamente lo consumido (rendimiento real distinto de tandas × rinde) y no dos veces', async () => {
    const p = await mkProducto();
    const ins = await mkInsumo(100);
    const r = await prisma.receta.create({ data: { producto_id: p.id, es_produccion: true, rinde: 10 } });
    await prisma.recetaLinea.create({ data: { receta_id: r.id, insumo_id: ins, cantidad: 4 } });
    const almacen = new AlmacenService(prisma as any, { registrar: jest.fn() } as any, undefined, stockSvc());
    const prod = await almacen.registrarProduccion({ recetaId: r.id.toString(), tandas: 2, unidadesReales: 15 } as any);
    const consumido = 100 - (await saldoIns(ins));
    expect(consumido).toBeGreaterThan(0);
    await Promise.allSettled([almacen.anularProduccion(prod.id, 'error de digitación'), almacen.anularProduccion(prod.id, 'error de digitación')]);
    expect(await saldoIns(ins)).toBeCloseTo(100, 6);
  });

  it('I6. reprogramación que anula el pedido devuelve el stock del producto una sola vez', async () => {
    const p = await mkProducto(true);
    await prisma.stock.create({ data: { producto_id: p.id, lugar_id: lugarId, cantidad: 5 } });
    const ped = await mkPedido({ estado: 'LISTO', repartidor_party_id: null, motivo_falla: MOTIVO_RETIRO });
    await prisma.$transaction((tx) => descontarVentaProductos(tx, ped, [{ productoId: p.id, cantidad: 2, areaId }], POR));
    expect(await saldoProducto(prisma, p.id)).toBe(3);
    const avisos = { avisar: jest.fn(), despertar: jest.fn() } as any;
    const svc = new ReprogramacionService(prisma as any, avisos, undefined, stockSvc());
    (svc as any).notificarCaja = jest.fn();
    expect(await svc.cancelar(ped, 'NO' as any)).toBe(true);
    expect(await saldoProducto(prisma, p.id)).toBe(5);
    expect(await svc.cancelar(ped, 'NO' as any)).toBe(false);
    expect(await saldoProducto(prisma, p.id)).toBe(5);
  });

  it('I7. anular una merma de un SABOR devuelve el saldo al sabor (no a una fila de producto) y no dos veces', async () => {
    const p = await mkProducto(true);
    const sabor = await prisma.sabor.create({ data: { producto_id: p.id, nombre: 'Choco' } });
    await prisma.stockSabor.create({ data: { sabor_id: sabor.id, cantidad: 10 } });
    const almacen = new AlmacenService(prisma as any, { registrar: jest.fn() } as any, undefined, stockSvc());
    const merma = await almacen.registrarMermaProducto({ productoId: p.id.toString(), saborId: sabor.id.toString(), cantidad: 3, motivo: 'SE_CAYO' } as any, { partyId: POR, rol: 'ADMIN', debeCambiar: false } as any);
    const sab = async () => Number((await prisma.stockSabor.findUniqueOrThrow({ where: { sabor_id: sabor.id } })).cantidad);
    expect(await sab()).toBe(7);
    const res = await Promise.allSettled([almacen.anularMovimiento(merma.id, 'se anota mal'), almacen.anularMovimiento(merma.id, 'se anota mal')]);
    expect(res.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await sab()).toBe(10);
  });
});
