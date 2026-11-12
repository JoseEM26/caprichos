import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { controlAlmacenActivo } from '../../stock';
import { hoyLimaISO, resolverFiltros, type FiltrosAnalisis } from '../comun/filtros';

/** Un producto terminado con este saldo o menos cuenta como «pocas unidades». */
export const UMBRAL_POCAS_UNIDADES = 5;
export const MAX_INSUMOS = 500;
export const MAX_PRODUCTOS = 200;
export const MAX_MERMAS = 3000;
/** Consumo de insumos: movimientos que descuentan (salvo VENTA, que se toma en valor absoluto; ver `consumoDe`). */
const TIPOS_CONSUMO = ['CONSUMO_RECETA', 'PRODUCCION_CONSUMO', 'VENTA'];

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;
const sumarDiasISO = (iso: string, d: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10);

@Injectable()
export class AlmacenAnalisisService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Consumo contra stock, mermas y productos terminados.
   * Con «Control de almacén» apagado los insumos y sus mermas no se calculan (`almacenActivo: false`); los productos
   * terminados sí, porque controlan su saldo aunque el interruptor esté apagado.
   */
  async resumen(filtros: FiltrosAnalisis, ahora: Date = new Date()) {
    const rango = resolverFiltros(filtros, ahora);
    const activo = await controlAlmacenActivo(this.prisma);
    const hoy = hoyLimaISO(ahora);
    const [insumos, mermas, terminados] = await Promise.all([
      activo ? this.insumos(rango, hoy) : Promise.resolve(null),
      this.mermas(rango, activo),
      this.terminados(rango),
    ]);
    return {
      generadoEn: ahora.toISOString(),
      rango: { desde: rango.desde, hasta: rango.hasta, dias: rango.dias },
      almacenActivo: activo,
      umbralPocas: UMBRAL_POCAS_UNIDADES,
      insumos,
      mermas,
      terminados,
    };
  }

  /** Cuánto dura cada insumo: saldo total ÷ consumo diario del rango. Sin consumo = «Sin consumo» (nunca infinito inventado). */
  private async insumos(rango: ReturnType<typeof resolverFiltros>, hoy: string) {
    const [lista, saldos, mov] = await Promise.all([
      this.prisma.insumo.findMany({ where: { activo: true }, select: { id: true, nombre: true, unidad_almacen: true, minimo: true }, orderBy: { nombre: 'asc' }, take: MAX_INSUMOS + 1 }),
      this.prisma.stock.groupBy({ by: ['insumo_id'], where: { insumo_id: { not: null } }, _sum: { cantidad: true } }),
      this.prisma.movimientoStock.groupBy({
        by: ['insumo_id', 'tipo'],
        where: { insumo_id: { not: null }, tipo: { in: TIPOS_CONSUMO }, en: { gte: rango.inicio, lt: rango.fin }, movimientosRevertidos: { none: {} } },
        _sum: { cantidad: true },
      }),
    ]);
    const saldo = new Map(saldos.map((s) => [String(s.insumo_id), Number(s._sum.cantidad ?? 0)]));
    const consumo = new Map<string, number>();
    for (const m of mov) {
      const suma = Number(m._sum.cantidad ?? 0);
      // CONSUMO_RECETA y PRODUCCION_CONSUMO descuentan con signo negativo; VENTA antigua puede venir en positivo
      const c = m.tipo === 'VENTA' ? Math.abs(suma) : Math.max(0, -suma);
      consumo.set(String(m.insumo_id), (consumo.get(String(m.insumo_id)) ?? 0) + c);
    }
    const items = lista.slice(0, MAX_INSUMOS).map((i) => {
      const id = String(i.id);
      const stock = r2(saldo.get(id) ?? 0);
      const total = consumo.get(id) ?? 0;
      const diario = total > 0 ? total / rango.dias : null;
      const dias = diario && stock > 0 ? r1(stock / diario) : null;
      const agotado = stock <= 0;
      return {
        id,
        nombre: i.nombre,
        unidad: i.unidad_almacen,
        stock,
        minimo: Number(i.minimo),
        consumoRango: r2(total),
        consumoDiario: diario == null ? null : r2(diario),
        diasRestantes: agotado ? 0 : dias,
        seAcabaEl: dias == null || agotado ? null : sumarDiasISO(hoy, Math.floor(dias)),
        estado: agotado ? 'AGOTADO' : dias == null ? 'SIN_CONSUMO' : dias <= 3 ? 'CRITICO' : dias <= 7 ? 'PRONTO' : 'OK',
        bajoMinimo: stock > 0 && stock < Number(i.minimo),
      };
    });
    // Lo que se acaba antes primero; los sin consumo al final
    items.sort((a, b) => (a.diasRestantes ?? Infinity) - (b.diasRestantes ?? Infinity) || a.nombre.localeCompare(b.nombre));
    return { truncado: lista.length > MAX_INSUMOS, limite: MAX_INSUMOS, items };
  }

  /** Mermas del rango por insumo o producto, con cantidad, costo (solo insumos con costo guardado) y motivos más repetidos. */
  private async mermas(rango: ReturnType<typeof resolverFiltros>, activo: boolean) {
    const filas = await this.prisma.movimientoStock.findMany({
      where: {
        tipo: 'MERMA',
        en: { gte: rango.inicio, lt: rango.fin },
        movimientosRevertidos: { none: {} },
        ...(activo ? {} : { insumo_id: null }),
      },
      select: { insumo_id: true, producto_id: true, cantidad: true, nota: true },
      orderBy: { en: 'desc' },
      take: MAX_MERMAS + 1,
    });
    const truncado = filas.length > MAX_MERMAS;
    const uso = truncado ? filas.slice(0, MAX_MERMAS) : filas;
    const insumoIds = [...new Set(uso.map((f) => f.insumo_id).filter((x): x is bigint => x != null))];
    const productoIds = [...new Set(uso.map((f) => f.producto_id).filter((x): x is bigint => x != null))];
    const [insumos, productos] = await Promise.all([
      insumoIds.length ? this.prisma.insumo.findMany({ where: { id: { in: insumoIds } }, select: { id: true, nombre: true, unidad_almacen: true, costo_unit: true } }) : [],
      productoIds.length ? this.prisma.producto.findMany({ where: { id: { in: productoIds } }, select: { id: true, nombre: true } }) : [],
    ]);
    const ins = new Map(insumos.map((i) => [String(i.id), i]));
    const pro = new Map(productos.map((p) => [String(p.id), p.nombre]));

    const grupos = new Map<string, { tipo: 'INSUMO' | 'PRODUCTO'; nombre: string; unidad: string | null; veces: number; cantidad: number; costo: number | null; motivos: Map<string, number> }>();
    for (const f of uso) {
      const esInsumo = f.insumo_id != null;
      const id = String(esInsumo ? f.insumo_id : f.producto_id);
      const k = `${esInsumo ? 'I' : 'P'}${id}`;
      const i = esInsumo ? ins.get(id) : undefined;
      const g = grupos.get(k) ?? {
        tipo: esInsumo ? ('INSUMO' as const) : ('PRODUCTO' as const),
        nombre: (esInsumo ? i?.nombre : pro.get(id)) ?? `#${id}`,
        unidad: i?.unidad_almacen ?? null,
        veces: 0,
        cantidad: 0,
        costo: null,
        motivos: new Map<string, number>(),
      };
      const cant = Math.abs(Number(f.cantidad));
      g.veces++;
      g.cantidad += cant;
      if (i?.costo_unit != null) g.costo = (g.costo ?? 0) + cant * Number(i.costo_unit);
      const motivo = f.nota?.trim().toLowerCase().slice(0, 80) || 'Sin motivo';
      g.motivos.set(motivo, (g.motivos.get(motivo) ?? 0) + 1);
      grupos.set(k, g);
    }
    const items = [...grupos.values()]
      .map((g) => ({
        tipo: g.tipo,
        nombre: g.nombre,
        unidad: g.unidad,
        veces: g.veces,
        cantidad: r2(g.cantidad),
        costo: g.costo == null ? null : r2(g.costo),
        motivos: [...g.motivos.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([motivo, veces]) => ({ motivo, veces })),
      }))
      .sort((a, b) => (b.costo ?? -1) - (a.costo ?? -1) || b.cantidad - a.cantidad);
    return {
      truncado,
      limite: MAX_MERMAS,
      registros: uso.length,
      costoTotal: items.some((x) => x.costo != null) ? r2(items.reduce((s, x) => s + (x.costo ?? 0), 0)) : null,
      items: items.slice(0, 50),
    };
  }

  /** Productos terminados (donas, galletas…): saldo actual, ritmo de venta del rango y cuáles tienen pocas unidades. */
  private async terminados(rango: ReturnType<typeof resolverFiltros>) {
    const productos = await this.prisma.producto.findMany({
      where: { controla_stock: true },
      select: { id: true, nombre: true, agotado_hasta: true, sabores: { where: { activo: true }, select: { id: true } } },
      orderBy: { nombre: 'asc' },
      take: MAX_PRODUCTOS + 1,
    });
    const lista = productos.slice(0, MAX_PRODUCTOS);
    const ids = lista.map((p) => p.id);
    const saborIds = lista.flatMap((p) => p.sabores.map((s) => s.id));
    const [saldos, saldosSabor, ventas] = ids.length
      ? await Promise.all([
          this.prisma.stock.groupBy({ by: ['producto_id'], where: { producto_id: { in: ids } }, _sum: { cantidad: true } }),
          saborIds.length ? this.prisma.stockSabor.findMany({ where: { sabor_id: { in: saborIds } }, select: { sabor_id: true, cantidad: true } }) : Promise.resolve([]),
          this.prisma.movimientoStock.groupBy({
            by: ['producto_id'],
            where: { tipo: 'VENTA', producto_id: { in: ids }, en: { gte: rango.inicio, lt: rango.fin }, movimientosRevertidos: { none: {} } },
            _sum: { cantidad: true },
          }),
        ])
      : [[], [], []];
    const saldo = new Map(saldos.map((s) => [String(s.producto_id), Number(s._sum.cantidad ?? 0)]));
    const porSabor = new Map(saldosSabor.map((s) => [String(s.sabor_id), Number(s.cantidad)]));
    const vendido = new Map(ventas.map((v) => [String(v.producto_id), Math.abs(Number(v._sum.cantidad ?? 0))]));
    const items = lista.map((p) => {
      const id = String(p.id);
      const conSabores = p.sabores.length > 0;
      const unidades = conSabores ? p.sabores.reduce((s, x) => s + (porSabor.get(String(x.id)) ?? 0), 0) : (saldo.get(id) ?? 0);
      const v = vendido.get(id) ?? 0;
      const diario = v > 0 ? v / rango.dias : null;
      return {
        id,
        nombre: p.nombre,
        unidades: r2(unidades),
        vendidasRango: r2(v),
        ventaDiaria: diario == null ? null : r2(diario),
        diasRestantes: diario && unidades > 0 ? r1(unidades / diario) : null,
        agotado: unidades <= 0,
        pocas: unidades <= UMBRAL_POCAS_UNIDADES,
      };
    });
    items.sort((a, b) => a.unidades - b.unidades || a.nombre.localeCompare(b.nombre));
    return { truncado: productos.length > MAX_PRODUCTOS, limite: MAX_PRODUCTOS, items };
  }
}
