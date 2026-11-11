/**
 * Consumo de insumos por receta, tandas, pendientes de Almacén y recuento contra un Postgres REAL (no mocks).
 * Solo corre con una base desechable con TODAS las migraciones aplicadas:
 *   docker run -d --name pg-almacen -e POSTGRES_PASSWORD=x -e POSTGRES_DB=t -p 55433:5432 postgres:16-alpine
 *   DATABASE_URL=<url> npx prisma migrate deploy
 *   ALMACEN_PG_URL=<url> npx jest consumo-receta.pg
 * Sin ALMACEN_PG_URL se omite (CI normal). Todos los datos son inventados.
 */
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../clientes/party-puntos.service', () => ({ PartyPuntosService: class {} }));
import { PrismaClient } from '@prisma/client';
import { ConsumoRecetaService } from './consumo-receta.service';
import { PendientesAlmacenService } from './pendientes-almacen.service';
import { AlmacenService } from './almacen.service';
import { ComandasService } from '../cocina/comandas.service';
import { StockService } from '../stock/stock.service';
import { consumoRealConMerma, lugarCocina } from './stock-cocina';

const URL_PG = process.env.ALMACEN_PG_URL;
const suite = URL_PG ? describe : describe.skip;
const ADMIN: any = { partyId: BigInt(1), rol: 'ADMIN' };

suite('Consumo por receta y pendientes en Postgres real', () => {
  let prisma: PrismaClient;
  let consumo: ConsumoRecetaService;
  let pend: PendientesAlmacenService;
  let almacenSvc: AlmacenService;
  let comandas: ComandasService;
  let cocinaId: bigint;
  let saladosId: bigint; // lugar de siempre: stock de productos terminados y descuento al cobrar (flujo anterior)
  let almacenId: bigint;
  let areaId: bigint;
  let catId: bigint;
  let n = 0;
  const uniq = (p: string) => `${p}-${Date.now()}-${++n}`;
  const auditoria: any = { registrar: jest.fn(async () => undefined) };

  const setParam = (clave: string, valor: string) =>
    prisma.parametro.upsert({ where: { clave }, update: { valor }, create: { clave, valor } });
  const encender = async (alPreparar = 'si', negativa = 'si') => {
    await setParam('stock_control_activo', 'si');
    await setParam('almacen_consumir_al_preparar', alPreparar);
    await setParam('almacen_permitir_cocina_negativa', negativa);
  };

  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url: URL_PG! } } });
    consumo = new ConsumoRecetaService(prisma as any, auditoria);
    pend = new PendientesAlmacenService(prisma as any, auditoria);
    almacenSvc = new AlmacenService(prisma as any, auditoria, undefined, undefined, consumo);
    comandas = new ComandasService(prisma as any, auditoria, undefined, undefined, undefined, undefined, consumo);
    // «Salados» es el lugar de cocina que el sistema ya usaba: existe antes de pedir «la Cocina» (regla: «Cocina» si existe, si no «Salados»)
    if (!(await prisma.lugarStock.findUnique({ where: { nombre: 'Salados' } }))) await prisma.lugarStock.create({ data: { nombre: 'Salados', tipo: 'AREA' } });
    saladosId = (await prisma.lugarStock.findUniqueOrThrow({ where: { nombre: 'Salados' } })).id;
    cocinaId = (await lugarCocina(prisma)).id;
    const alm = await prisma.lugarStock.findFirst({ where: { nombre: 'Almacén central' } });
    almacenId = alm?.id ?? (await prisma.lugarStock.create({ data: { nombre: 'Almacén central', tipo: 'ALMACEN' } })).id;
    areaId = (await prisma.areaCocina.create({ data: { nombre: uniq('Area') } })).id;
    catId = (await prisma.categoria.create({ data: { nombre: uniq('Cat'), area_id: areaId } })).id;
  });
  afterAll(() => prisma.$disconnect());
  beforeEach(() => encender());

  const mkInsumo = async (nombre: string, o: { unidad?: string; unidadReceta?: string; factor?: number; cocina?: number; almacen?: number; merma?: number } = {}) => {
    const i = await prisma.insumo.create({
      data: {
        nombre: uniq(nombre), unidad_compra: o.unidad ?? 'unidad', unidad_almacen: o.unidad ?? 'unidad', unidad_receta: o.unidadReceta ?? o.unidad ?? 'unidad',
        factor_compra: 1, factor_receta: o.factor ?? 1, minimo: 0, maximo: 100, merma_pct: o.merma ?? 0,
      },
    });
    if (o.cocina !== undefined) await prisma.stock.create({ data: { insumo_id: i.id, lugar_id: cocinaId, cantidad: o.cocina } });
    if (o.almacen !== undefined) await prisma.stock.create({ data: { insumo_id: i.id, lugar_id: almacenId, cantidad: o.almacen } });
    return i;
  };
  const saldo = async (insumoId: bigint, lugarId: bigint) =>
    Number((await prisma.stock.findFirst({ where: { insumo_id: insumoId, lugar_id: lugarId } }))?.cantidad ?? 0);
  const mkClub = async (lineas: Array<[bigint, number]>) => {
    const p = await prisma.producto.create({ data: { nombre: uniq('Club'), precio: 20, categoria_id: catId } });
    const r = await prisma.receta.create({ data: { producto_id: p.id, es_produccion: false } });
    for (const [insumo_id, cantidad] of lineas) await prisma.recetaLinea.create({ data: { receta_id: r.id, insumo_id, cantidad } });
    return p;
  };
  const mkPedido = async (productoId: bigint, cantidad: number, listas = 0) => {
    const ped = await prisma.pedido.create({ data: { codigo: uniq('P'), modalidad: 'MESA', subtotal: 0, total: 0, estado: 'COLA' } });
    const linea = await prisma.pedidoLinea.create({ data: { pedido_id: ped.id, producto_id: productoId, nombre: 'Club', cantidad, precio_unit: 20, area_id: areaId, listas } });
    return { pedidoId: ped.id, lineaId: linea.id };
  };
  const setListas = (lineaId: bigint, listas: number) => prisma.pedidoLinea.update({ where: { id: lineaId }, data: { listas } });
  const movs = (lineaId: bigint) => prisma.movimientoStock.count({ where: { pedido_linea_id: lineaId } });

  it('preparar 1 club sándwich descuenta pan, lechuga y huevo de COCINA (no de almacén) y es idempotente', async () => {
    const pan = await mkInsumo('Pan', { cocina: 10, almacen: 50 });
    const lechuga = await mkInsumo('Lechuga', { cocina: 10, almacen: 50 });
    const huevo = await mkInsumo('Huevo', { cocina: 10, almacen: 50 });
    const club = await mkClub([[pan.id, 3], [lechuga.id, 1], [huevo.id, 2]]);
    const { pedidoId, lineaId } = await mkPedido(club.id, 1);

    await consumo.reconciliarPedido(pedidoId, ADMIN.partyId);
    expect(await saldo(pan.id, cocinaId)).toBe(10); // aún no se preparó: nada

    await setListas(lineaId, 1);
    await consumo.reconciliarPedido(pedidoId);
    await consumo.reconciliarPedido(pedidoId);
    await Promise.all([consumo.reconciliarPedido(pedidoId), consumo.reconciliarPedido(pedidoId)]);
    expect([await saldo(pan.id, cocinaId), await saldo(lechuga.id, cocinaId), await saldo(huevo.id, cocinaId)]).toEqual([7, 9, 8]);
    expect(await saldo(pan.id, almacenId)).toBe(50); // almacén intacto
    expect(await prisma.pendienteAlmacen.count({ where: { pedido_linea_id: lineaId } })).toBe(0);

    // desmarcar devuelve; marcar de nuevo descuenta una sola vez
    await setListas(lineaId, 0);
    await consumo.reconciliarPedido(pedidoId);
    expect(await saldo(pan.id, cocinaId)).toBe(10);
    await setListas(lineaId, 1);
    await consumo.reconciliarPedido(pedidoId);
    await consumo.reconciliarPedido(pedidoId);
    expect(await saldo(pan.id, cocinaId)).toBe(7);
    expect((await prisma.movimientoStock.findFirst({ where: { pedido_linea_id: lineaId, insumo_id: pan.id } }))?.tipo).toBe('CONSUMO_RECETA');
  });

  it('cantidad 3 con unidades parciales (2 de 3 listas) y merma habitual del insumo (10 %: neta ÷ 0,9)', async () => {
    const pan = await mkInsumo('Pan', { cocina: 100, merma: 10 });
    const club = await mkClub([[pan.id, 2]]); // neta 2 → real 2 ÷ 0,9 = 2,222 por unidad
    const { pedidoId, lineaId } = await mkPedido(club.id, 3);
    await setListas(lineaId, 2);
    await consumo.reconciliarPedido(pedidoId);
    expect(await saldo(pan.id, cocinaId)).toBeCloseTo(100 - 4.444, 3);
    await setListas(lineaId, 3);
    await consumo.reconciliarPedido(pedidoId);
    expect(await saldo(pan.id, cocinaId)).toBeCloseTo(100 - 6.666, 2);
    await setListas(lineaId, 1); // se deshace una
    await consumo.reconciliarPedido(pedidoId);
    expect(await saldo(pan.id, cocinaId)).toBeCloseTo(100 - 2.222, 2);
    await setListas(lineaId, 0);
    await consumo.reconciliarPedido(pedidoId);
    expect(await saldo(pan.id, cocinaId)).toBe(100); // vuelve exacto
  });

  it('anular ANTES de preparar no descuenta; anular después: MERMA (defecto) conserva el consumo y DEVOLVER lo regresa', async () => {
    const pan = await mkInsumo('Pan', { cocina: 20 });
    const club = await mkClub([[pan.id, 2]]);
    const a = await mkPedido(club.id, 1);
    await prisma.pedido.update({ where: { id: a.pedidoId }, data: { estado: 'ANULADO' } });
    await consumo.reconciliarPedido(a.pedidoId);
    await consumo.decidirAnulacion(a.pedidoId, 'DEVOLVER', 'x');
    expect(await movs(a.lineaId)).toBe(0);
    expect(await consumo.tieneConsumo(a.pedidoId)).toBe(false);

    const b = await mkPedido(club.id, 2, 2);
    await consumo.reconciliarPedido(b.pedidoId);
    expect(await saldo(pan.id, cocinaId)).toBe(16);
    expect(await consumo.tieneConsumo(b.pedidoId)).toBe(true);
    await prisma.pedido.update({ where: { id: b.pedidoId }, data: { estado: 'ANULADO' } });
    await consumo.decidirAnulacion(b.pedidoId, undefined, 'Se quemó'); // defecto = MERMA
    expect(await saldo(pan.id, cocinaId)).toBe(16);
    await consumo.decidirAnulacion(b.pedidoId, 'DEVOLVER', 'Nunca se preparó');
    expect(await saldo(pan.id, cocinaId)).toBe(20);
    await consumo.decidirAnulacion(b.pedidoId, 'DEVOLVER', 'otra vez');
    expect(await saldo(pan.id, cocinaId)).toBe(20); // idempotente
  });

  it('faltante en cocina: queda negativa con un pendiente exacto; al deshacer se anula', async () => {
    const pan = await mkInsumo('Pan', { cocina: 1, almacen: 30 });
    const club = await mkClub([[pan.id, 3]]);
    const { pedidoId, lineaId } = await mkPedido(club.id, 1, 1);
    await consumo.reconciliarPedido(pedidoId);
    expect(await saldo(pan.id, cocinaId)).toBe(-2);
    const p = await prisma.pendienteAlmacen.findFirstOrThrow({ where: { pedido_linea_id: lineaId } });
    expect(p.estado).toBe('PENDIENTE');
    expect(Number(p.cantidad)).toBe(2);
    expect(p.origen_tipo).toBe('LINEA');
    await setListas(lineaId, 0);
    await consumo.reconciliarPedido(pedidoId);
    expect(await saldo(pan.id, cocinaId)).toBe(1);
    expect((await prisma.pendienteAlmacen.findUniqueOrThrow({ where: { id: p.id } })).estado).toBe('ANULADO');
  });

  it('emitir un pendiente crea un traslado real y deja cocina en cero; emitir parcial si almacén no alcanza', async () => {
    const pan = await mkInsumo('Pan', { cocina: 0, almacen: 5 });
    const club = await mkClub([[pan.id, 3]]);
    const a = await mkPedido(club.id, 1, 1);
    await consumo.reconciliarPedido(a.pedidoId);
    expect(await saldo(pan.id, cocinaId)).toBe(-3);
    const p = await prisma.pendienteAlmacen.findFirstOrThrow({ where: { pedido_linea_id: a.lineaId } });
    const r = await pend.emitir({ ids: [p.id.toString()] }, ADMIN);
    expect(r.resultados[0]).toMatchObject({ emitido: 3, faltaAlmacen: 0, parcial: false });
    expect(await saldo(pan.id, cocinaId)).toBe(0);
    expect(await saldo(pan.id, almacenId)).toBe(2);
    const after = await prisma.pendienteAlmacen.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.estado).toBe('EMITIDO');
    expect(after.traslado_id).not.toBeNull();
    expect((await prisma.traslado.findUniqueOrThrow({ where: { id: after.traslado_id! } })).estado).toBe('RECIBIDO');
    await expect(pend.emitir({ ids: [p.id.toString()] }, ADMIN)).rejects.toMatchObject({ response: { codigo: 'SIN_PENDIENTES' } });

    // parcial: pedimos 2 pedidos más (6 en total) y almacén solo tiene 2
    const b = await mkPedido(club.id, 1, 1);
    const c = await mkPedido(club.id, 1, 1);
    await consumo.reconciliarPedido(b.pedidoId);
    await consumo.reconciliarPedido(c.pedidoId);
    const todos = await pend.emitir({ insumoId: pan.id.toString() }, ADMIN);
    expect(todos.resultados[0]).toMatchObject({ emitido: 2, faltaAlmacen: 4, parcial: true });
    expect(await saldo(pan.id, almacenId)).toBe(0);
    expect(await saldo(pan.id, cocinaId)).toBe(-4);
    const quedan = await prisma.pendienteAlmacen.findMany({ where: { insumo_id: pan.id, estado: 'PENDIENTE' } });
    expect(quedan.reduce((a2, x) => a2 + Number(x.cantidad) - Number(x.emitido), 0)).toBe(4);
  });

  it('tanda de 10 donas: insumos ÷ rendimiento con conversión kg/g, suma terminados; vender no descuenta insumos', async () => {
    const harina = await mkInsumo('Harina', { unidad: 'kg', unidadReceta: 'g', factor: 1000, cocina: 5 });
    const dona = await prisma.producto.create({ data: { nombre: uniq('Dona'), precio: 5, categoria_id: catId } });
    const rec = await prisma.receta.create({ data: { producto_id: dona.id, es_produccion: true, rinde: 24 } });
    await prisma.recetaLinea.create({ data: { receta_id: rec.id, insumo_id: harina.id, cantidad: 2400 } }); // 2400 g por tanda de 24
    const r = await almacenSvc.registrarProduccion({ recetaId: rec.id.toString(), unidadesObtenidas: 10 } as any, ADMIN);
    expect(await saldo(harina.id, cocinaId)).toBeCloseTo(5 - 1, 3); // 10/24 × 2400 g = 1000 g = 1 kg
    expect(Number((await prisma.stock.findFirst({ where: { producto_id: dona.id, lugar_id: saladosId } }))?.cantidad)).toBe(10);
    const mov = await prisma.movimientoStock.findFirstOrThrow({ where: { produccion_id: BigInt(r.id), insumo_id: harina.id } });
    expect(mov.tipo).toBe('PRODUCCION_CONSUMO');

    // venta de 2 donas: baja el terminado, NO los insumos
    const ped = await prisma.pedido.create({ data: { codigo: uniq('P'), modalidad: 'MESA', subtotal: 0, total: 0, estado: 'COLA' } });
    await prisma.pedidoLinea.create({ data: { pedido_id: ped.id, producto_id: dona.id, nombre: 'Dona', cantidad: 2, precio_unit: 5, area_id: areaId } });
    await new StockService(prisma as any, auditoria).descontarPorPedido(ped.id);
    expect(Number((await prisma.stock.findFirst({ where: { producto_id: dona.id, lugar_id: saladosId } }))?.cantidad)).toBe(8);
    expect(await saldo(harina.id, cocinaId)).toBeCloseTo(4, 3);

    // anular la tanda devuelve exactamente lo descontado
    await almacenSvc.anularProduccion(r.id, 'Se quemó la tanda', ADMIN);
    expect(await saldo(harina.id, cocinaId)).toBeCloseTo(5, 3);
  });

  it('tanda con faltante: cocina negativa + pendiente de TANDA; el recuento lo ajusta (AJUSTADO)', async () => {
    const harina = await mkInsumo('Harina', { unidad: 'kg', unidadReceta: 'g', factor: 1000, cocina: 0.4 });
    const dona = await prisma.producto.create({ data: { nombre: uniq('Dona'), precio: 5, categoria_id: catId } });
    const rec = await prisma.receta.create({ data: { producto_id: dona.id, es_produccion: true, rinde: 10 } });
    await prisma.recetaLinea.create({ data: { receta_id: rec.id, insumo_id: harina.id, cantidad: 1000 } });
    const r = await almacenSvc.registrarProduccion({ recetaId: rec.id.toString(), unidadesObtenidas: 10 } as any, ADMIN);
    expect(await saldo(harina.id, cocinaId)).toBeCloseTo(-0.6, 3);
    const p = await prisma.pendienteAlmacen.findFirstOrThrow({ where: { produccion_id: BigInt(r.id) } });
    expect(Number(p.cantidad)).toBeCloseTo(0.6, 3);
    expect(p.origen_tipo).toBe('TANDA');

    // Con «permitir cocina negativa» en «no», la tanda se bloquea como siempre
    await encender('si', 'no');
    await expect(almacenSvc.registrarProduccion({ recetaId: rec.id.toString(), unidadesObtenidas: 10 } as any, ADMIN)).rejects.toMatchObject({
      response: { codigo: 'STOCK_MATERIA_PRIMA_INSUFICIENTE' },
    });
    await encender();

    // Recuento nocturno de cocina: se contaron 0 kg (el almacén había mandado lo que faltaba sin registrar)
    const lista = await pend.listarRecuento('COCINA');
    expect(lista.find((x) => x.insumoId === harina.id.toString())).toMatchObject({ sistema: -0.6, pendiente: 0.6 });
    const rec2 = await pend.aplicarRecuento({ lugar: 'COCINA', filas: [{ insumoId: harina.id.toString(), contado: 0 }], motivo: 'Cierre' }, ADMIN);
    expect(rec2.filas[0]).toMatchObject({ diferencia: 0.6, pendientesResueltos: 1 });
    expect(await saldo(harina.id, cocinaId)).toBe(0);
    expect((await prisma.pendienteAlmacen.findUniqueOrThrow({ where: { id: p.id } })).estado).toBe('AJUSTADO');
    const aj = await prisma.movimientoStock.findFirstOrThrow({ where: { insumo_id: harina.id, tipo: 'DIFERENCIA_CONTEO' } });
    expect(aj.nota).toContain('Recuento nocturno');
    // recuento de almacén: ajusta a lo contado sin tocar pendientes
    await prisma.stock.create({ data: { insumo_id: harina.id, lugar_id: almacenId, cantidad: 10 } });
    const rec3 = await pend.aplicarRecuento({ lugar: 'ALMACEN', filas: [{ insumoId: harina.id.toString(), contado: 7 }] }, ADMIN);
    expect(rec3.filas[0].diferencia).toBe(-3);
    expect(await saldo(harina.id, almacenId)).toBe(7);

    // anular la tanda con pendiente abierto: todo vuelve y el pendiente de otra tanda se anula
    const r2 = await almacenSvc.registrarProduccion({ recetaId: rec.id.toString(), unidadesObtenidas: 10 } as any, ADMIN);
    const p2 = await prisma.pendienteAlmacen.findFirstOrThrow({ where: { produccion_id: BigInt(r2.id) } });
    expect(Number(p2.cantidad)).toBe(1);
    await almacenSvc.anularProduccion(r2.id, 'Error', ADMIN);
    expect((await prisma.pendienteAlmacen.findUniqueOrThrow({ where: { id: p2.id } })).estado).toBe('ANULADO');
    expect(await saldo(harina.id, cocinaId)).toBe(0);
  });

  it('ALMACÉN APAGADO = cero efecto: ninguna escritura, y la tanda usa el flujo de siempre', async () => {
    await setParam('stock_control_activo', 'no');
    const pan = await mkInsumo('Pan', { cocina: 10 });
    const club = await mkClub([[pan.id, 3]]);
    const { pedidoId, lineaId } = await mkPedido(club.id, 1, 1);
    await consumo.reconciliarPedido(pedidoId);
    await consumo.decidirAnulacion(pedidoId, 'DEVOLVER', 'x');
    expect(await saldo(pan.id, cocinaId)).toBe(10);
    expect(await movs(lineaId)).toBe(0);
    expect(await prisma.consumoLinea.count({ where: { pedido_linea_id: lineaId } })).toBe(0);
    expect(await prisma.pendienteAlmacen.count({ where: { insumo_id: pan.id } })).toBe(0);
    expect(await consumo.tieneConsumo(pedidoId)).toBe(false);
    expect(await consumo.modoTanda()).toBeNull();
  });

  it('Cocina real: marcar, deshacer (ventana de 15 s) y despejar no duplican el consumo; un fallo no rompe la cocina', async () => {
    const pan = await mkInsumo('Pan', { cocina: 10 });
    const club = await mkClub([[pan.id, 2]]);
    const { pedidoId, lineaId } = await mkPedido(club.id, 2);
    await prisma.comandaArea.create({ data: { pedido_id: pedidoId, area_id: areaId } });
    const u: any = { partyId: BigInt(77), rol: 'COCINA' };
    await comandas.marcarListas(lineaId, 1, u);
    expect(await saldo(pan.id, cocinaId)).toBe(8);
    await comandas.marcarListas(lineaId, 2, u); // completa: despeja el área
    expect(await saldo(pan.id, cocinaId)).toBe(6);
    expect((await prisma.comandaArea.findFirstOrThrow({ where: { pedido_id: pedidoId } })).estado).toBe('DESPEJADA');
    await comandas.marcarListas(lineaId, 1, u); // deshacer dentro de 15 s: reabre y devuelve una unidad
    expect(await saldo(pan.id, cocinaId)).toBe(8);
    expect((await prisma.comandaArea.findFirstOrThrow({ where: { pedido_id: pedidoId } })).estado).toBe('EN_COCINA');
    await comandas.marcarListas(lineaId, 2, u);
    expect(await saldo(pan.id, cocinaId)).toBe(6);

    // fallo del consumo: la cocina sigue
    const roto = new ConsumoRecetaService({ parametro: { findUnique: async () => { throw new Error('bd caída'); } } } as any, auditoria);
    await expect(roto.reconciliarPedido(pedidoId)).resolves.toBeUndefined();
    const prismaFalla: any = new Proxy(prisma, { get: (t: any, k) => (k === '$transaction' ? () => { throw new Error('boom'); } : t[k]) });
    const fallando = new ConsumoRecetaService(prismaFalla, auditoria);
    const { pedidoId: p2, lineaId: l2 } = await mkPedido(club.id, 1, 1);
    await expect(fallando.reconciliarPedido(p2)).resolves.toBeUndefined();
    expect(await movs(l2)).toBe(0);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'CONSUMO_RECETA_FALLO' }));
    await consumo.reintentarPedido(p2); // el reintento lo reconcilia
    expect(await movs(l2)).toBeGreaterThan(0);
  });

  it('tamaño: la receta del tamaño elegido es la que descuenta', async () => {
    const pan = await mkInsumo('Pan', { cocina: 50 });
    const lista = await prisma.lista.create({ data: { codigo: uniq('tam'), nombre: 'Tamaños' } });
    const grande = await prisma.listaValor.create({ data: { lista_id: lista.id, nombre: 'Grande' } });
    const p = await prisma.producto.create({ data: { nombre: uniq('Club'), precio: 20, categoria_id: catId } });
    await prisma.productoTamano.create({ data: { producto_id: p.id, tamano_valor_id: grande.id, precio: 25 } });
    const base = await prisma.receta.create({ data: { producto_id: p.id, es_produccion: false } });
    await prisma.recetaLinea.create({ data: { receta_id: base.id, insumo_id: pan.id, cantidad: 2 } });
    const rg = await prisma.receta.create({ data: { producto_id: p.id, tamano_valor_id: grande.id, es_produccion: false } });
    await prisma.recetaLinea.create({ data: { receta_id: rg.id, insumo_id: pan.id, cantidad: 4 } });
    const ped = await prisma.pedido.create({ data: { codigo: uniq('P'), modalidad: 'MESA', subtotal: 0, total: 0, estado: 'COLA' } });
    await prisma.pedidoLinea.create({ data: { pedido_id: ped.id, producto_id: p.id, nombre: 'Club', tamano: 'Grande', cantidad: 1, precio_unit: 25, area_id: areaId, listas: 1 } });
    await consumo.reconciliarPedido(ped.id);
    expect(await saldo(pan.id, cocinaId)).toBe(46);
  });

  it('producto sin receta: no descuenta, sin pendiente ni error', async () => {
    const p = await prisma.producto.create({ data: { nombre: uniq('SinReceta'), precio: 5, categoria_id: catId } });
    const { pedidoId, lineaId } = await mkPedido(p.id, 1, 1);
    await consumo.reconciliarPedido(pedidoId);
    expect(await movs(lineaId)).toBe(0);
    expect(auditoria.registrar).not.toHaveBeenCalledWith(expect.objectContaining({ entidadId: pedidoId, accion: 'CONSUMO_RECETA_FALLO' }));
  });

  it('con «consumir al preparar» en sí, cobrar (descontarPorPedido) ya no descuenta insumos por receta', async () => {
    const pan = await mkInsumo('Pan', { cocina: 10 });
    const club = await mkClub([[pan.id, 2]]);
    const { pedidoId } = await mkPedido(club.id, 1, 0);
    await new StockService(prisma as any, auditoria).descontarPorPedido(pedidoId);
    expect(await saldo(pan.id, cocinaId)).toBe(10);
    await setParam('almacen_consumir_al_preparar', 'no');
    if (saladosId !== cocinaId) await prisma.stock.create({ data: { insumo_id: pan.id, lugar_id: saladosId, cantidad: 10 } });
    await new StockService(prisma as any, auditoria).descontarPorPedido(pedidoId); // método de siempre (Salados)
    expect(await saldo(pan.id, saladosId)).toBe(8);
  });

  it('merma del insumo: 0 %, 10 % y 100 % inválido (se ignora); validación del DTO', async () => {
    expect(consumoRealConMerma(9, 0)).toBe(9);
    expect(consumoRealConMerma(9, 10)).toBe(10);
    expect(consumoRealConMerma(2, 10)).toBe(2.222);
    expect(consumoRealConMerma(5, 100)).toBe(5);
    expect(consumoRealConMerma(5, null)).toBe(5);
  });

  it('receta por sabor: usa la del sabor; si no hay, la general; tanda con sabor usa su receta', async () => {
    const leche = await mkInsumo('Leche', { cocina: 100 });
    const fresa = await mkInsumo('Fresa', { cocina: 100 });
    const p = await prisma.producto.create({ data: { nombre: uniq('Frappe'), precio: 12, categoria_id: catId } });
    const sFresa = await prisma.sabor.create({ data: { producto_id: p.id, nombre: 'Fresa' } });
    const sVainilla = await prisma.sabor.create({ data: { producto_id: p.id, nombre: 'Vainilla' } });
    const general = await prisma.receta.create({ data: { producto_id: p.id, es_produccion: false } });
    await prisma.recetaLinea.create({ data: { receta_id: general.id, insumo_id: leche.id, cantidad: 2 } });
    const rf = await prisma.receta.create({ data: { producto_id: p.id, es_produccion: false, sabor_id: sFresa.id } });
    await prisma.recetaLinea.create({ data: { receta_id: rf.id, insumo_id: leche.id, cantidad: 3 } });
    await prisma.recetaLinea.create({ data: { receta_id: rf.id, insumo_id: fresa.id, cantidad: 5 } });
    const mk = async (sabor: string, cant: number) => {
      const ped = await prisma.pedido.create({ data: { codigo: uniq('P'), modalidad: 'MESA', subtotal: 0, total: 0, estado: 'COLA' } });
      await prisma.pedidoLinea.create({ data: { pedido_id: ped.id, producto_id: p.id, nombre: 'Frappe', sabor, cantidad: cant, precio_unit: 12, area_id: areaId, listas: cant } });
      return ped.id;
    };
    await consumo.reconciliarPedido(await mk('Fresa', 2));
    expect([await saldo(leche.id, cocinaId), await saldo(fresa.id, cocinaId)]).toEqual([94, 90]); // receta de Fresa ×2
    await consumo.reconciliarPedido(await mk('Vainilla', 1));
    expect([await saldo(leche.id, cocinaId), await saldo(fresa.id, cocinaId)]).toEqual([92, 90]); // sin receta propia: la general
    // reparto mixto en una línea: 1 fresa + 1 vainilla
    const ped = await prisma.pedido.create({ data: { codigo: uniq('P'), modalidad: 'MESA', subtotal: 0, total: 0, estado: 'COLA' } });
    const lin = await prisma.pedidoLinea.create({ data: { pedido_id: ped.id, producto_id: p.id, nombre: 'Frappe', cantidad: 2, precio_unit: 12, area_id: areaId, listas: 2 } });
    await prisma.pedidoLineaSabor.createMany({ data: [{ pedido_linea_id: lin.id, sabor_id: sFresa.id, sabor_nombre: 'Fresa', cantidad: 1 }, { pedido_linea_id: lin.id, sabor_id: sVainilla.id, sabor_nombre: 'Vainilla', cantidad: 1 }] });
    await consumo.reconciliarPedido(ped.id);
    expect([await saldo(leche.id, cocinaId), await saldo(fresa.id, cocinaId)]).toEqual([87, 85]); // leche 3 + 2; fresa 5 (solo la unidad de fresa)

    // la receta general no se confunde con la del sabor en el resto del sistema
    expect((await prisma.receta.findMany({ where: { producto_id: p.id, sabor_id: null } })).length).toBe(1);

    // tanda con sabor: usa la receta del sabor
    const harina = await mkInsumo('Harina', { cocina: 50 });
    const cacao = await mkInsumo('Cacao', { cocina: 50 });
    const dona = await prisma.producto.create({ data: { nombre: uniq('Dona'), precio: 5, categoria_id: catId, controla_stock: true } });
    const choco = await prisma.sabor.create({ data: { producto_id: dona.id, nombre: 'Chocolate' } });
    const rg = await prisma.receta.create({ data: { producto_id: dona.id, es_produccion: true, rinde: 12 } });
    await prisma.recetaLinea.create({ data: { receta_id: rg.id, insumo_id: harina.id, cantidad: 12 } });
    const rc = await prisma.receta.create({ data: { producto_id: dona.id, es_produccion: true, rinde: 12, sabor_id: choco.id } });
    await prisma.recetaLinea.create({ data: { receta_id: rc.id, insumo_id: harina.id, cantidad: 12 } });
    await prisma.recetaLinea.create({ data: { receta_id: rc.id, insumo_id: cacao.id, cantidad: 6 } });
    const r = await almacenSvc.registrarProduccion({ recetaId: rg.id.toString(), unidadesObtenidas: 24, saborId: choco.id.toString() } as any, ADMIN);
    expect([await saldo(harina.id, cocinaId), await saldo(cacao.id, cocinaId)]).toEqual([26, 38]); // ×2 con la receta de chocolate
    expect(Number((await prisma.stockSabor.findUnique({ where: { sabor_id: choco.id } }))?.cantidad)).toBe(24);
    await almacenSvc.anularProduccion(r.id, 'Prueba', ADMIN);
    expect([await saldo(harina.id, cocinaId), await saldo(cacao.id, cocinaId)]).toEqual([50, 50]);
  });
});
