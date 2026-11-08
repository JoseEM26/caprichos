/**
 * Auditoría del stock de productos terminados contra un Postgres REAL (no mocks): descuento, devolución, edición,
 * sabores, combos, insumos por receta, apertura, merma y concurrencia.
 *
 * Solo corre con una base desechable con TODAS las migraciones aplicadas:
 *   docker run -d --name pg-aud -e POSTGRES_PASSWORD=x -e POSTGRES_DB=t -p 55432:5432 postgres:16-alpine
 *   DATABASE_URL=<url de esa base> npx prisma migrate deploy
 *   AUDITORIA_PG_URL=<url de esa base> npx jest auditoria-stock.pg
 * Sin AUDITORIA_PG_URL se omite (CI normal).
 */
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../clientes/party-puntos.service', () => ({ PartyPuntosService: class {} }));
import { PrismaClient } from '@prisma/client';
import { PedidosService } from '../pedidos/pedidos.service';
import { StockService } from './stock.service';
import {
  ajustarVentaProductos,
  descontarVentaProductos,
  mermarProductoControlado,
  registrarAperturaArrastre,
  saldoProducto,
  saldoSabor,
  validarSaboresLinea,
  fechaLimaHoy,
} from './producto-controlado';
import { lineasDeRequisitosOpcion } from './opcion-requiere';

const URL_PG = process.env.AUDITORIA_PG_URL;
const suite = URL_PG ? describe : describe.skip;
const POR = BigInt(1);

suite('Auditoría de stock en Postgres real', () => {
  let prisma: PrismaClient;
  let lugarId: bigint;
  let areaId: bigint;
  let categoriaId: bigint;
  let n = 0;
  const uniq = (p: string) => `${p}-${Date.now()}-${++n}`;
  // PedidosService solo se usa por ventaDeLineas (no toca sus dependencias)
  const pedidos = Object.create(PedidosService.prototype) as PedidosService;
  const stockSvc = () => new StockService(prisma as any, {} as any);

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: URL_PG! } } });
    const area = await prisma.areaCocina.create({ data: { nombre: uniq('Area') } });
    areaId = area.id;
    categoriaId = (await prisma.categoria.create({ data: { nombre: uniq('Cat'), area_id: areaId } })).id;
    const salados = await prisma.lugarStock.findFirst({ where: { nombre: 'Salados' } });
    lugarId = salados?.id ?? (await prisma.lugarStock.create({ data: { nombre: 'Salados', tipo: 'AREA' } })).id;
  });
  afterAll(async () => {
    await prisma.$disconnect();
  });

  const mkProducto = async (opts: { saldo?: number; controla?: boolean; sabores?: Array<[string, number]> } = {}) => {
    const p = await prisma.producto.create({
      data: { nombre: uniq('Prod'), precio: 10, categoria_id: categoriaId, controla_stock: opts.controla ?? true },
    });
    if (opts.saldo !== undefined) await prisma.stock.create({ data: { producto_id: p.id, lugar_id: lugarId, cantidad: opts.saldo } });
    const sabores: Array<{ id: bigint; nombre: string }> = [];
    for (const [nombre, saldo] of opts.sabores ?? []) {
      const s = await prisma.sabor.create({ data: { producto_id: p.id, nombre } });
      await prisma.stockSabor.create({ data: { sabor_id: s.id, cantidad: saldo } });
      sabores.push({ id: s.id, nombre });
    }
    return { id: p.id, sabores };
  };
  const mkPedido = async () =>
    (await prisma.pedido.create({ data: { codigo: uniq('P'), modalidad: 'MESA', subtotal: 0, total: 0 } })).id;
  const vender = (pedidoId: bigint | null, lineas: any[], opciones?: any) =>
    prisma.$transaction((tx) => descontarVentaProductos(tx, pedidoId, lineas, POR, new Date(), opciones));
  const saldo = async (id: bigint) => saldoProducto(prisma, id);
  const sab = async (id: bigint) => saldoSabor(prisma, id);
  const prodDb = (id: bigint) => prisma.producto.findUniqueOrThrow({ where: { id } });
  const codigo409 = async (p: Promise<unknown>) => {
    try {
      await p;
    } catch (e: any) {
      return e?.response?.codigo ?? e?.message;
    }
    return null;
  };

  // ── (1) producto simple ──────────────────────────────────────────────────────
  it('1. simple: 1 por venta, 409 si no alcanza (sin descontar), agotado automático en 0 y reactiva al devolver', async () => {
    const p = await mkProducto({ saldo: 2 });
    const ped = await mkPedido();
    await vender(ped, [{ productoId: p.id, cantidad: 1, areaId }]);
    expect(await saldo(p.id)).toBe(1);
    expect(await codigo409(vender(await mkPedido(), [{ productoId: p.id, cantidad: 2, areaId }]))).toBe('STOCK_INSUFICIENTE');
    expect(await saldo(p.id)).toBe(1);
    await vender(await mkPedido(), [{ productoId: p.id, cantidad: 1, areaId }]);
    const p0 = await prodDb(p.id);
    expect(await saldo(p.id)).toBe(0);
    expect(p0.agotado_origen).toBe('AUTOMATICO');
    expect(p0.agotado_hasta).not.toBeNull();
    await stockSvc().revertirPorPedido(ped);
    expect(await saldo(p.id)).toBe(1);
    const p1 = await prodDb(p.id);
    expect(p1.agotado_hasta).toBeNull();
  });

  // ── (2) tamaño con unidades ──────────────────────────────────────────────────
  it('2. tamaño con unidades: entero cumpleañero = 8 tajadas; 409 si no hay 8', async () => {
    const torta = await mkProducto({ saldo: 20 });
    const linea = (unidadesTamano: number, cantidad = 1) => ({ productoId: torta.id, cantidad, unidadesTamano, areaId, partesCombo: [], requisitosOpcion: [], sabores: [] });
    await vender(await mkPedido(), await pedidos.ventaDeLineas(prisma, [linea(1)])); // Tajada
    await vender(await mkPedido(), await pedidos.ventaDeLineas(prisma, [linea(8)])); // Entero
    expect(await saldo(torta.id)).toBe(11);
    await vender(await mkPedido(), await pedidos.ventaDeLineas(prisma, [linea(8)]));
    expect(await saldo(torta.id)).toBe(3);
    expect(await codigo409(vender(await mkPedido(), await pedidos.ventaDeLineas(prisma, [linea(8)])))).toBe('STOCK_INSUFICIENTE');
    expect(await saldo(torta.id)).toBe(3);
  });

  // ── (3) por sabor: media docena / docena ─────────────────────────────────────
  it('3. por sabor: 6 unidades repartidas, suma validada, 409 si el sabor no alcanza y todo se deshace', async () => {
    const dona = await mkProducto({ saldo: 0, sabores: [['Choco', 4], ['Fresa', 4], ['Vainilla', 1]] });
    const [c, f, v] = dona.sabores;
    const fila = await prisma.producto.findUniqueOrThrow({ where: { id: dona.id }, include: { sabores: true } });
    const valida = validarSaboresLinea(fila as any, 6, 1, [{ saborId: c.id, cantidad: 3 }, { saborId: f.id, cantidad: 3 }]);
    expect(valida.reduce((a, s) => a + s.cantidad, 0)).toBe(6);
    expect(() => validarSaboresLinea(fila as any, 6, 1, [{ saborId: c.id, cantidad: 3 }, { saborId: f.id, cantidad: 2 }])).toThrow();
    expect(() => validarSaboresLinea(fila as any, 12, 1, [{ saborId: c.id, cantidad: 6 }, { saborId: f.id, cantidad: 6 }])).not.toThrow();
    await vender(await mkPedido(), [{ productoId: dona.id, cantidad: 6, sabores: valida }]);
    expect([await sab(c.id), await sab(f.id)]).toEqual([1, 1]);
    // segunda docena: Choco alcanza, Vainilla no → 409 y Choco NO baja (transacción completa)
    const mala = [{ saborId: c.id, nombre: 'Choco', cantidad: 1 }, { saborId: v.id, nombre: 'Vainilla', cantidad: 2 }];
    expect(await codigo409(vender(await mkPedido(), [{ productoId: dona.id, cantidad: 3, sabores: mala }]))).toBe('STOCK_INSUFICIENTE');
    expect([await sab(c.id), await sab(v.id)]).toEqual([1, 1]);
    expect(await saldo(dona.id)).toBe(0); // el producto por sabor no usa su fila de stock
  });

  // ── (4) combos con partes ────────────────────────────────────────────────────
  it('4. combo: cada pieza hija descuenta su producto/sabor una sola vez y el anfitrión no descuenta', async () => {
    const host = await mkProducto({ saldo: 50 }); // Dúo con casilla marcada por error: no debe bajar
    const donas = await mkProducto({ sabores: [['Choco', 5], ['Fresa', 5]] });
    const galleta = await mkProducto({ saldo: 5 });
    const bebida = await mkProducto({ saldo: 5 });
    const lineaCombo = {
      productoId: host.id,
      contenedora: true,
      cantidad: 2, // 2 combos
      unidadesTamano: 1,
      areaId: null,
      sabores: [],
      requisitosOpcion: [],
      partesCombo: [
        { productoId: donas.id, cantidad: 4, unidadesTamano: 1, areaId, sabores: [{ saborId: donas.sabores[0].id, nombre: 'Choco', cantidad: 3 }, { saborId: donas.sabores[1].id, nombre: 'Fresa', cantidad: 1 }] },
        { productoId: galleta.id, cantidad: 2, areaId },
        { productoId: bebida.id, cantidad: 2, areaId },
      ],
    };
    const ped = await mkPedido();
    await vender(ped, await pedidos.ventaDeLineas(prisma, [lineaCombo]));
    expect(await saldo(host.id)).toBe(50);
    expect([await sab(donas.sabores[0].id), await sab(donas.sabores[1].id)]).toEqual([2, 4]);
    expect([await saldo(galleta.id), await saldo(bebida.id)]).toEqual([3, 3]);
    const movs = await prisma.movimientoStock.count({ where: { pedido_id: ped, tipo: 'VENTA' } });
    expect(movs).toBe(4); // 2 sabores + galleta + bebida: ni duplicados ni anfitrión
  });

  // ── (9) alternativa agotada / reemplazo ──────────────────────────────────────
  it('9. combo con reemplazo: baja el producto reemplazante (x cantidad de la alternativa), no el original; cortesía separada baja CORTESIA', async () => {
    const original = await mkProducto({ saldo: 0 });
    const reemplazo = await mkProducto({ saldo: 5 });
    const host = await mkProducto({ saldo: 9 });
    const ped = await mkPedido();
    await vender(ped, await pedidos.ventaDeLineas(prisma, [{
      productoId: host.id, contenedora: true, cantidad: 1, areaId: null, sabores: [], requisitosOpcion: [],
      partesCombo: [{ productoId: reemplazo.id, cantidad: 2, areaId }],
    }]));
    expect(await saldo(original.id)).toBe(0);
    expect(await saldo(reemplazo.id)).toBe(3);
    const cort = await mkProducto({ saldo: 2 });
    await vender(null, [{ productoId: cort.id, cantidad: 1, areaId }], { tipo: 'CORTESIA' });
    expect(await saldo(cort.id)).toBe(1);
    expect(await prisma.movimientoStock.count({ where: { producto_id: cort.id, tipo: 'CORTESIA' } })).toBe(1);
  });

  // ── (5) opciones con requisito de stock («2 Donas») ──────────────────────────
  it('5a. «2 Donas» como opción: se reparte entre sabores con saldo y descuenta; 409 si no alcanza', async () => {
    const dona = await mkProducto({ sabores: [['A', 1], ['B', 3]] });
    const lineas = await lineasDeRequisitosOpcion(prisma, [{ productoId: dona.id.toString(), saborId: null, cantidad: 2 }]);
    await vender(await mkPedido(), lineas);
    expect((await sab(dona.sabores[0].id)) + (await sab(dona.sabores[1].id))).toBe(2);
    expect(await codigo409(lineasDeRequisitosOpcion(prisma, [{ productoId: dona.id.toString(), saborId: null, cantidad: 5 }]))).toBe('STOCK_INSUFICIENTE');
  });

  const mkInsumo = async (cantidad: number) => {
    const ins = await prisma.insumo.create({
      data: { nombre: uniq('Ins'), unidad_compra: 'u', unidad_almacen: 'u', unidad_receta: 'u', factor_compra: 1, factor_receta: 1, minimo: 0, maximo: 100 },
    });
    await prisma.stock.create({ data: { insumo_id: ins.id, lugar_id: lugarId, cantidad } });
    return ins.id;
  };
  const insumoSaldo = async (id: bigint) =>
    (await prisma.stock.findMany({ where: { insumo_id: id } })).reduce((a, s) => a + Number(s.cantidad), 0);

  it('5b. insumos por receta (Control de almacén activo): descuenta al cobrar, es idempotente y al anular el cobro y volver a cobrar descuenta de nuevo', async () => {
    await prisma.parametro.upsert({ where: { clave: 'stock_control_activo' }, update: { valor: 'si' }, create: { clave: 'stock_control_activo', valor: 'si' } });
    try {
      const prod = await mkProducto({ controla: false });
      const ins = await mkInsumo(10);
      const rec = await prisma.receta.create({ data: { producto_id: prod.id } });
      await prisma.recetaLinea.create({ data: { receta_id: rec.id, insumo_id: ins, cantidad: 2 } });
      const ped = await mkPedido();
      await prisma.pedidoLinea.create({ data: { pedido_id: ped, producto_id: prod.id, nombre: 'x', cantidad: 2, precio_unit: 1, area_id: areaId } });
      const svc = stockSvc();
      await svc.descontarPorPedido(ped);
      expect(await insumoSaldo(ins)).toBe(6);
      await svc.descontarPorPedido(ped); // idempotente
      expect(await insumoSaldo(ins)).toBe(6);
      await svc.revertirPorPedido(ped, undefined, POR, { soloInsumos: true }); // anular el cobro
      expect(await insumoSaldo(ins)).toBe(10);
      await svc.descontarPorPedido(ped); // se vuelve a cobrar
      expect(await insumoSaldo(ins)).toBe(6);
      await svc.revertirPorPedido(ped, undefined, POR); // anular el pedido
      expect(await insumoSaldo(ins)).toBe(10);
    } finally {
      await prisma.parametro.update({ where: { clave: 'stock_control_activo' }, data: { valor: 'no' } });
    }
  });

  it('5c. revertirPorPedido con transacción externa también devuelve (antes no hacía nada)', async () => {
    const p = await mkProducto({ saldo: 5 });
    const ped = await mkPedido();
    await vender(ped, [{ productoId: p.id, cantidad: 2, areaId }]);
    await prisma.$transaction((tx) => stockSvc().revertirPorPedido(ped, tx));
    expect(await saldo(p.id)).toBe(5);
  });

  // ── (6) anular ───────────────────────────────────────────────────────────────
  it('6. anular: devuelve una sola vez (idempotente), también por sabor y con el pedido editado', async () => {
    const p = await mkProducto({ saldo: 10 });
    const dona = await mkProducto({ sabores: [['A', 6]] });
    const ped = await mkPedido();
    await vender(ped, [{ productoId: p.id, cantidad: 3, areaId }, { productoId: dona.id, cantidad: 2, sabores: [{ saborId: dona.sabores[0].id, nombre: 'A', cantidad: 2 }] }]);
    // se edita: simple 3 → 1
    await prisma.$transaction((tx) => ajustarVentaProductos(tx, ped, [{ productoId: p.id, cantidad: 3 }], [{ productoId: p.id, cantidad: 1 }], POR));
    expect(await saldo(p.id)).toBe(9);
    const svc = stockSvc();
    await svc.revertirPorPedido(ped);
    await svc.revertirPorPedido(ped);
    expect(await saldo(p.id)).toBe(10);
    expect(await sab(dona.sabores[0].id)).toBe(6);
  });

  it('6b. dos anulaciones simultáneas del mismo pedido no devuelven dos veces', async () => {
    const p = await mkProducto({ saldo: 10 });
    const ped = await mkPedido();
    await vender(ped, [{ productoId: p.id, cantidad: 4, areaId }]);
    await Promise.all([stockSvc().revertirPorPedido(ped), stockSvc().revertirPorPedido(ped), stockSvc().revertirPorPedido(ped)]);
    expect(await saldo(p.id)).toBe(10);
    expect(await prisma.movimientoStock.count({ where: { pedido_id: ped, tipo: 'ANULACION' } })).toBe(1);
  });

  // ── (7) editar pedido ────────────────────────────────────────────────────────
  it('7. editar: quitar / agregar / cambiar cantidad devuelve y vuelve a descontar; por sabor y 409 si no alcanza', async () => {
    const p = await mkProducto({ saldo: 10 });
    const dona = await mkProducto({ sabores: [['A', 4], ['B', 4]] });
    const [a, b] = dona.sabores;
    const ped = await mkPedido();
    await vender(ped, [
      { productoId: p.id, cantidad: 3, areaId },
      { productoId: dona.id, cantidad: 2, sabores: [{ saborId: a.id, nombre: 'A', cantidad: 2 }] },
    ]);
    const editar = (quitar: any[], agregar: any[]) => prisma.$transaction((tx) => ajustarVentaProductos(tx, ped, quitar, agregar, POR));
    // cambiar cantidad 3 → 5
    await editar([{ productoId: p.id, cantidad: 3 }], [{ productoId: p.id, cantidad: 5 }]);
    expect(await saldo(p.id)).toBe(5);
    // cambiar sabor A(2) → B(3)
    await editar(
      [{ productoId: dona.id, cantidad: 2, sabores: [{ saborId: a.id, nombre: 'A', cantidad: 2 }] }],
      [{ productoId: dona.id, cantidad: 3, sabores: [{ saborId: b.id, nombre: 'B', cantidad: 3 }] }],
    );
    expect([await sab(a.id), await sab(b.id)]).toEqual([4, 1]);
    // agregar más de lo que hay → 409 y todo queda igual
    const antes = [await saldo(p.id), await sab(a.id), await sab(b.id)];
    expect(await codigo409(editar([], [{ productoId: p.id, cantidad: 6 }]))).toBe('STOCK_INSUFICIENTE');
    expect([await saldo(p.id), await sab(a.id), await sab(b.id)]).toEqual(antes);
    // quitar todo
    await editar([{ productoId: p.id, cantidad: 5 }], []);
    expect(await saldo(p.id)).toBe(10);
  });

  it('7b. editar un pedido con «2 Donas» (opción): quitar la línea devuelve los sabores que de verdad se vendieron, aunque el saldo ya cambió', async () => {
    const dona = await mkProducto({ sabores: [['A', 1], ['B', 3]] });
    const [a, b] = dona.sabores;
    const ped = await mkPedido();
    const req = [{ productoId: dona.id.toString(), saborId: null, cantidad: 2 }];
    await vender(ped, await lineasDeRequisitosOpcion(prisma, req)); // A:1, B:1
    expect([await sab(a.id), await sab(b.id)]).toEqual([0, 2]);
    // Lo que el editor calcula al quitar la línea (con el saldo de ahora): todo de B
    const aQuitar = await lineasDeRequisitosOpcion(prisma, req);
    await prisma.$transaction((tx) => ajustarVentaProductos(tx, ped, aQuitar, [], POR));
    expect([await sab(a.id), await sab(b.id)]).toEqual([1, 3]); // todo devuelto
  });

  it('5d. dos cobros simultáneos del mismo pedido descuentan los insumos una sola vez', async () => {
    await prisma.parametro.upsert({ where: { clave: 'stock_control_activo' }, update: { valor: 'si' }, create: { clave: 'stock_control_activo', valor: 'si' } });
    try {
      const prod = await mkProducto({ controla: false });
      const ins = await mkInsumo(10);
      const rec = await prisma.receta.create({ data: { producto_id: prod.id } });
      await prisma.recetaLinea.create({ data: { receta_id: rec.id, insumo_id: ins, cantidad: 1 } });
      const ped = await mkPedido();
      await prisma.pedidoLinea.create({ data: { pedido_id: ped, producto_id: prod.id, nombre: 'x', cantidad: 1, precio_unit: 1, area_id: areaId } });
      await Promise.all([1, 2, 3, 4].map(() => stockSvc().descontarPorPedido(ped)));
      expect(await insumoSaldo(ins)).toBe(9);
    } finally {
      await prisma.parametro.update({ where: { clave: 'stock_control_activo' }, data: { valor: 'no' } });
    }
  });

  // ── (10) apertura, arrastre y merma ──────────────────────────────────────────
  it('10. apertura: arrastre, «Produje hoy» suma, no pisa lo vendido ni deja negativos; merma resta; agotado reactiva', async () => {
    const p = await mkProducto({ saldo: 2 });
    const fecha = fechaLimaHoy();
    const abrir = (quedaron: number, produccion: number) =>
      prisma.$transaction((tx) => registrarAperturaArrastre(tx, { productoId: p.id, saborId: null, quedaron, produccion, areaId, por: POR, ahora: new Date(), fecha }));
    await abrir(2, 10); // quedaron 2, produje 10 → 12
    expect(await saldo(p.id)).toBe(12);
    await vender(await mkPedido(), [{ productoId: p.id, cantidad: 5, areaId }]); // vendí 5 → 7 (más que lo de ayer)
    expect(await saldo(p.id)).toBe(7);
    // La pantalla propone «Quedaron» = max(0, saldo − producido) = 0; al sumar 3 más NO debe subir lo vendido
    await abrir(0, 3);
    expect(await saldo(p.id)).toBe(10); // 7 + 3, no 13 ni 10+3
    // merma resta
    await prisma.$transaction((tx) => mermarProductoControlado(tx, { productoId: p.id, nombre: 'x', saborId: null, cantidad: 4, motivo: 'VENCIDO', areaId, por: POR, ahora: new Date(), fecha }));
    expect(await saldo(p.id)).toBe(6);
    expect(await codigo409(prisma.$transaction((tx) => mermarProductoControlado(tx, { productoId: p.id, nombre: 'x', saborId: null, cantidad: 7, motivo: 'OTRO', nota: 'n', areaId, por: POR, ahora: new Date(), fecha })))).toBe('STOCK_INSUFICIENTE');
    // agota → agotado AUTOMATICO; producir lo reactiva
    await prisma.$transaction((tx) => mermarProductoControlado(tx, { productoId: p.id, nombre: 'x', saborId: null, cantidad: 6, motivo: 'DANADO', areaId, por: POR, ahora: new Date(), fecha }));
    expect((await prodDb(p.id)).agotado_origen).toBe('AUTOMATICO');
    await abrir(0, 4);
    expect(await saldo(p.id)).toBe(4);
    expect((await prodDb(p.id)).agotado_hasta).toBeNull();
  });

  // ── (11) concurrencia ────────────────────────────────────────────────────────
  it('11. concurrencia: 8 pedidos por la última unidad → uno gana, 7 dan 409, saldo nunca negativo', async () => {
    const p = await mkProducto({ saldo: 1 });
    const peds = await Promise.all(Array.from({ length: 8 }, () => mkPedido()));
    const r = await Promise.all(peds.map((id) => codigo409(vender(id, [{ productoId: p.id, cantidad: 1, areaId }]))));
    expect(r.filter((x) => x === null)).toHaveLength(1);
    expect(r.filter((x) => x === 'STOCK_INSUFICIENTE')).toHaveLength(7);
    expect(await saldo(p.id)).toBe(0);
    expect(await prisma.movimientoStock.count({ where: { producto_id: p.id, tipo: 'VENTA' } })).toBe(1);
  });

  it('11b. concurrencia por sabor: 2 docenas contra 12 → una pasa, otra 409; sin negativos', async () => {
    const dona = await mkProducto({ sabores: [['A', 12]] });
    const linea = (id: bigint) => [{ productoId: dona.id, cantidad: 12, sabores: [{ saborId: id, nombre: 'A', cantidad: 12 }] }];
    const peds = await Promise.all([mkPedido(), mkPedido()]);
    const r = await Promise.all(peds.map((id) => codigo409(vender(id, linea(dona.sabores[0].id)))));
    expect(r.filter((x) => x === null)).toHaveLength(1);
    expect(await sab(dona.sabores[0].id)).toBe(0);
  });

  it('11c. concurrencia: venta y edición del mismo producto no dejan saldo negativo', async () => {
    const p = await mkProducto({ saldo: 5 });
    const ped = await mkPedido();
    await vender(ped, [{ productoId: p.id, cantidad: 2, areaId }]);
    const otros = await Promise.all([mkPedido(), mkPedido(), mkPedido()]);
    await Promise.all([
      ...otros.map((id) => codigo409(vender(id, [{ productoId: p.id, cantidad: 1, areaId }]))),
      codigo409(prisma.$transaction((tx) => ajustarVentaProductos(tx, ped, [{ productoId: p.id, cantidad: 2 }], [{ productoId: p.id, cantidad: 4 }], POR))),
    ]);
    expect(await saldo(p.id)).toBeGreaterThanOrEqual(0);
  });
});
