import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { HORAS_TURNO, resolverFiltros, type FiltrosAnalisis, type RangoAnalisis } from '../comun/filtros';
import { margenDeProducto, marcarExtremos, promedioPorDiaSemana, tendencia, type DiaVenta, type GrupoMargen, type GrupoVendido, type RecetaCosto } from './productos.calculo';

const TOP_FECHAS = 10;
const MAX_OPCIONES_PRODUCTO = 30;
const MAX_MODIFICADORES_GLOBAL = 50;
const DIA_MS = 86_400_000;

const num = (v: unknown) => Number(v ?? 0);
const centimos = (v: unknown) => Math.round(num(v) * 100);

export interface FilaLinea {
  producto_id: bigint;
  tamano: string | null;
  unidades: bigint | number;
  venta: unknown;
}
export interface FilaDia {
  fecha: string;
  pedidos: bigint | number;
  monto: unknown;
}
export interface FilaOpcion {
  producto_id: bigint;
  grupo: string;
  opcion: string;
  veces: bigint | number;
}
export interface ProductoCatalogo {
  id: bigint;
  nombre: string;
  precio: unknown;
  categoria: { nombre: string } | null;
  tamanos: Array<{ precio: unknown; tamano_valor_id: bigint; tamano_valor: { nombre: string } }>;
  recetas: RecetaCosto[];
}
export interface DatosProductos {
  catalogo: ProductoCatalogo[];
  lineas: FilaLinea[];
  /** pedidos distintos por producto */
  pedidosPorProducto: Array<{ producto_id: bigint; pedidos: bigint | number }>;
  /** unidades del período anterior por producto */
  anterior: Array<{ producto_id: bigint; unidades: bigint | number }>;
  dias: FilaDia[];
  opciones: FilaOpcion[];
}

/** Arma toda la respuesta a partir de los agregados. Con `esAdmin` false ningún monto ni margen sale (solo conteos). */
export function armarProductos(d: DatosProductos, esAdmin: boolean) {
  const $ = (c: number | null) => (esAdmin && c != null ? c / 100 : null);
  const porProducto = new Map<string, GrupoVendido[]>();
  for (const l of d.lineas) {
    const k = String(l.producto_id);
    const g = porProducto.get(k) ?? [];
    g.push({ tamano: l.tamano, unidades: num(l.unidades), ventaC: centimos(l.venta) });
    porProducto.set(k, g);
  }
  const pedidos = new Map(d.pedidosPorProducto.map((x) => [String(x.producto_id), num(x.pedidos)]));
  const antes = new Map(d.anterior.map((x) => [String(x.producto_id), num(x.unidades)]));

  const base = d.catalogo.map((p) => {
    const vend = porProducto.get(String(p.id)) ?? [];
    const unidades = vend.reduce((s, g) => s + g.unidades, 0);
    const ventaC = vend.reduce((s, g) => s + g.ventaC, 0);
    return { p, vend, unidades, ventaC };
  });
  const totalU = base.reduce((s, x) => s + x.unidades, 0);
  const totalC = base.reduce((s, x) => s + x.ventaC, 0);
  const ordenadas = [...base].sort((a, b) => b.unidades - a.unidades || b.ventaC - a.ventaC || a.p.nombre.localeCompare(b.p.nombre, 'es'));
  const filas = marcarExtremos(
    ordenadas.map((x) => ({
      id: String(x.p.id),
      nombre: x.p.nombre,
      categoria: x.p.categoria?.nombre ?? 'Sin categoría',
      unidades: x.unidades,
      monto: $(x.ventaC),
      porcentaje: totalU > 0 ? Math.round((x.unidades / totalU) * 1000) / 10 : null,
      pedidos: pedidos.get(String(x.p.id)) ?? 0,
      unidadesAnterior: antes.get(String(x.p.id)) ?? 0,
      tendencia: tendencia(x.unidades, antes.get(String(x.p.id)) ?? 0),
    })),
  );

  // Días: ranking de fechas y promedio por día de la semana
  const dias: DiaVenta[] = d.dias.map((x) => ({ fecha: x.fecha, pedidos: num(x.pedidos), c: centimos(x.monto) }));
  const clave = (x: DiaVenta) => (esAdmin ? x.c : x.pedidos);
  const fila = (x: DiaVenta) => ({ fecha: x.fecha, pedidos: x.pedidos, monto: $(x.c) });
  const porMas = [...dias].sort((a, b) => clave(b) - clave(a) || b.pedidos - a.pedidos);
  const porMenos = [...dias].sort((a, b) => clave(a) - clave(b) || a.pedidos - b.pedidos);

  // Modificadores
  const nombres = new Map(d.catalogo.map((p) => [String(p.id), p.nombre]));
  const mods = new Map<string, Array<{ grupo: string; opcion: string; veces: number }>>();
  const globales = new Map<string, { grupo: string; opcion: string; veces: number }>();
  const sumar = (pid: string, grupo: string, opcion: string, veces: number) => {
    const l = mods.get(pid) ?? [];
    l.push({ grupo, opcion, veces });
    mods.set(pid, l);
    const g = globales.get(`${grupo}|${opcion}`) ?? { grupo, opcion, veces: 0 };
    g.veces += veces;
    globales.set(`${grupo}|${opcion}`, g);
  };
  for (const o of d.opciones) sumar(String(o.producto_id), o.grupo, o.opcion, num(o.veces));
  for (const [pid, gs] of porProducto) for (const g of gs) if (g.tamano) sumar(pid, 'Tamaño', g.tamano, g.unidades);
  const porVeces = <T extends { veces: number }>(a: T, b: T) => b.veces - a.veces;
  const modificadores = {
    porProducto: [...mods.entries()]
      .filter(([pid]) => nombres.has(pid))
      .map(([pid, opciones]) => ({
        id: pid,
        nombre: nombres.get(pid) as string,
        total: opciones.reduce((s, o) => s + o.veces, 0),
        opciones: opciones.sort(porVeces).slice(0, MAX_OPCIONES_PRODUCTO),
      }))
      .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre, 'es')),
    global: [...globales.values()].sort(porVeces).slice(0, MAX_MODIFICADORES_GLOBAL),
  };

  // Margen (dinero: solo ADMIN)
  let margen = null as null | {
    grupos: Record<GrupoMargen, number>;
    ponderado: { margen: number | null; ingresos: number; costo: number; productos: number };
    filas: Array<Record<string, unknown>>;
  };
  if (esAdmin) {
    const grupos: Record<GrupoMargen, number> = { BAJO: 0, MEDIO: 0, ALTO: 0, SIN_COSTO: 0 };
    let ingC = 0;
    let cosC = 0;
    let conCosto = 0;
    const lista = base.map((x) => {
      const tamanos = new Map(x.p.tamanos.map((t) => [t.tamano_valor.nombre, t.tamano_valor_id]));
      const ref = x.p.tamanos[0];
      const m = margenDeProducto(x.p.recetas, tamanos, x.vend, { tamano: ref?.tamano_valor.nombre ?? null, precio: num(ref?.precio ?? x.p.precio) });
      grupos[m.grupo] += 1;
      if (m.costoC != null && m.base === 'ventas') {
        ingC += m.ventaC;
        cosC += m.costoC;
        conCosto += 1;
      }
      return {
        id: String(x.p.id),
        nombre: x.p.nombre,
        categoria: x.p.categoria?.nombre ?? 'Sin categoría',
        grupo: m.grupo,
        margen: m.margen,
        precio: m.unidades > 0 ? Math.round(m.ventaC / m.unidades) / 100 : null,
        costo: m.costoC == null || m.unidades === 0 ? null : Math.round(m.costoC / m.unidades) / 100,
        unidades: x.unidades,
        base: m.base,
        motivos: m.motivos,
      };
    });
    margen = {
      grupos,
      ponderado: { margen: ingC > 0 ? Math.round(((ingC - cosC) / ingC) * 1000) / 10 : null, ingresos: ingC / 100, costo: cosC / 100, productos: conCosto },
      filas: lista.sort((a, b) => (a.margen == null ? 1 : b.margen == null ? -1 : (a.margen as number) - (b.margen as number))),
    };
  }

  return {
    productos: {
      total: filas.length,
      conVentas: filas.filter((f) => f.unidades > 0).length,
      sinVentas: filas.filter((f) => f.unidades === 0).length,
      unidades: totalU,
      monto: $(totalC),
      categorias: [...new Set(filas.map((f) => f.categoria))].sort((a, b) => a.localeCompare(b, 'es')),
      filas,
    },
    dias: {
      porSemana: promedioPorDiaSemana(dias).map(({ c, promedioC, ...r }) => ({ ...r, monto: $(c), promedioMonto: $(promedioC) })),
      masVentas: porMas.slice(0, TOP_FECHAS).map(fila),
      menosVentas: porMenos.slice(0, TOP_FECHAS).map(fila),
      diasConVentas: dias.length,
    },
    modificadores,
    margen,
  };
}

@Injectable()
export class ProductosAnalisisService {
  constructor(private readonly prisma: PrismaService) {}

  /** Condiciones de pedido comunes (mismas de Ventas): sin anulados ni rechazados, más modalidad, canal y turno. */
  private condiciones(r: RangoAnalisis, inicio: Date, fin: Date) {
    const c = [Prisma.sql`p.creado_en >= ${inicio} AND p.creado_en < ${fin}`, Prisma.sql`p.estado NOT IN ('ANULADO', 'RECHAZADO')`];
    if (r.modalidad) c.push(Prisma.sql`p.modalidad = ${r.modalidad}`);
    if (r.canal) c.push(Prisma.sql`p.canal = ${r.canal}`);
    if (r.turno) {
      const [a, b] = HORAS_TURNO[r.turno];
      c.push(Prisma.sql`EXTRACT(HOUR FROM (p.creado_en AT TIME ZONE 'UTC') - INTERVAL '5 hours') >= ${a} AND EXTRACT(HOUR FROM (p.creado_en AT TIME ZONE 'UTC') - INTERVAL '5 hours') < ${b}`);
    }
    return Prisma.join(c, ' AND ');
  }

  async resumen(filtros: FiltrosAnalisis, esAdmin: boolean, ahora: Date = new Date()) {
    const r = resolverFiltros(filtros, ahora);
    const w = this.condiciones(r, r.inicio, r.fin);
    const wAnt = this.condiciones(r, new Date(r.inicio.getTime() - r.dias * DIA_MS), r.inicio);
    // línea de cuenta: sin partes de combo, sin cortesías, producto del catálogo (igual que Ventas)
    const L = Prisma.sql`l.linea_combo_id IS NULL AND l.es_cortesia = false AND l.producto_id IS NOT NULL`;
    const venta = Prisma.sql`COALESCE(l.subtotal, l.precio_unit * l.cantidad)`;
    const [catalogo, lineas, pedidosPorProducto, anterior, dias, opciones] = await Promise.all([
      this.prisma.producto.findMany({
        select: {
          id: true,
          nombre: true,
          precio: true,
          categoria: { select: { nombre: true } },
          tamanos: { where: { activo: true }, orderBy: { id: 'asc' }, select: { precio: true, tamano_valor_id: true, tamano_valor: { select: { nombre: true } } } },
          recetas: {
            where: { sabor_id: null },
            select: { tamano_valor_id: true, es_produccion: true, rinde: true, lineas: { select: { cantidad: true, insumo: { select: { nombre: true, costo_unit: true, factor_receta: true, merma_pct: true } } } } },
          },
        },
      }),
      this.prisma.$queryRaw(Prisma.sql`SELECT l.producto_id, l.tamano, SUM(l.cantidad) AS unidades, SUM(${venta}) AS venta FROM pedido p JOIN pedido_linea l ON l.pedido_id = p.id WHERE ${w} AND ${L} GROUP BY l.producto_id, l.tamano`),
      this.prisma.$queryRaw(Prisma.sql`SELECT l.producto_id, COUNT(DISTINCT l.pedido_id) AS pedidos FROM pedido p JOIN pedido_linea l ON l.pedido_id = p.id WHERE ${w} AND ${L} GROUP BY l.producto_id`),
      this.prisma.$queryRaw(Prisma.sql`SELECT l.producto_id, SUM(l.cantidad) AS unidades FROM pedido p JOIN pedido_linea l ON l.pedido_id = p.id WHERE ${wAnt} AND ${L} GROUP BY l.producto_id`),
      this.prisma.$queryRaw(Prisma.sql`SELECT to_char((p.creado_en AT TIME ZONE 'UTC') - INTERVAL '5 hours', 'YYYY-MM-DD') AS fecha, COUNT(*) AS pedidos, SUM(p.total) AS monto FROM pedido p WHERE ${w} GROUP BY 1 ORDER BY 1`),
      this.prisma.$queryRaw(Prisma.sql`SELECT l.producto_id, o.grupo_nombre AS grupo, o.opcion_nombre AS opcion, SUM(l.cantidad) AS veces FROM pedido p JOIN pedido_linea l ON l.pedido_id = p.id JOIN pedido_linea_opcion o ON o.pedido_linea_id = l.id WHERE ${w} AND ${L} GROUP BY l.producto_id, o.grupo_nombre, o.opcion_nombre`),
    ]);
    const datos = armarProductos({ catalogo, lineas, pedidosPorProducto, anterior, dias, opciones } as unknown as DatosProductos, esAdmin);
    return {
      generadoEn: ahora.toISOString(),
      rango: { desde: r.desde, hasta: r.hasta, dias: r.dias },
      filtros: { modalidad: r.modalidad, canal: r.canal, turno: r.turno },
      conDinero: esAdmin,
      ...datos,
    };
  }
}
