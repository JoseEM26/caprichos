import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { HORAS_TURNO, TURNOS, enTurno, horaLima, resolverFiltros, type FiltrosAnalisis } from '../comun/filtros';

/** Tope de pedidos leídos por consulta (si se pasa, se avisa y se leen los más recientes). */
export const MAX_PEDIDOS_VENTAS = 5000;
const TOP = 10;
const MAX_FILAS = 50;
/** Hasta este número de días la evolución es diaria; más allá, semanal (lunes a domingo). */
export const MAX_DIAS_DIARIO = 31;

const MEDIOS = ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'];
const centimos = (v: unknown) => Math.round(Number(v ?? 0) * 100);
const diaLima = (d: Date) => new Date(d.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
const lunesDe = (dia: string) => {
  const f = new Date(`${dia}T12:00:00Z`);
  f.setUTCDate(f.getUTCDate() - ((f.getUTCDay() + 6) % 7));
  return f.toISOString().slice(0, 10);
};

export interface PedidoVenta {
  canal: string | null;
  modalidad: string;
  estado: string;
  creado_en: Date;
  total: unknown;
  descuento: unknown;
  envio: unknown;
  propina: unknown;
  descuento_detalle: unknown;
  lineas: Array<{
    nombre: string;
    cantidad: number;
    subtotal: unknown;
    producto_id: bigint | null;
    oferta_id: bigint | null;
    es_cortesia: boolean;
    producto?: { categoria?: { nombre: string } | null } | null;
  }>;
  cobros: Array<{ pagos: Array<{ medio: string | null; monto: unknown }> }>;
}

interface Acum {
  pedidos: number;
  c: number;
}
const sumar = (m: Map<string, Acum>, k: string, c: number) => {
  const a = m.get(k) ?? { pedidos: 0, c: 0 };
  a.pedidos += 1;
  a.c += c;
  m.set(k, a);
};

/**
 * Definición de venta (la misma del escritorio y de Reportes): total del pedido (subtotal - descuento + envío, sin propina)
 * de los pedidos que no están ANULADO ni RECHAZADO. Productos: líneas de cuenta (las partes de un combo no se cuentan, su precio
 * ya va en la línea del combo) sin cortesías, a precio de lista (antes del descuento global del pedido, que se muestra aparte).
 * Medios de pago: CobroPago.monto de los cobros vigentes (sin propina), como el Cierre.
 * Todo monto sale null si `esAdmin` es false.
 */
export function agregarVentas(todos: PedidoVenta[], rango: { dias: number; turno: string | null }, esAdmin: boolean) {
  const $ = (c: number) => (esAdmin ? c / 100 : null);
  const pedidos = todos.filter((p) => p.estado !== 'ANULADO' && p.estado !== 'RECHAZADO' && (!rango.turno || enTurno(p.creado_en, rango.turno as (typeof TURNOS)[number])));
  const semanal = rango.dias > MAX_DIAS_DIARIO;
  const periodoDe = (d: Date) => (semanal ? lunesDe(diaLima(d)) : diaLima(d));

  const porCanal = new Map<string, Acum>();
  const porModalidad = new Map<string, Acum>();
  const porTurno = new Map<string, Acum>();
  const porCanalPeriodo = new Map<string, Map<string, Acum>>();
  const porMedioPeriodo = new Map<string, Map<string, Acum>>();
  const porMedio = new Map<string, Acum>();
  const productos = new Map<string, { nombre: string; categoria: string; unidades: number; c: number; ids: Set<number>; combo: boolean }>();
  const combos = new Map<string, { nombre: string; unidades: number; c: number; pedidos: number }>();
  const descuentos = new Map<string, { tipo: string; nombre: string; c: number; pedidos: number }>();
  let totalC = 0;
  let envioC = 0;
  let descuentoC = 0;
  let propinaC = 0;
  let conOfertaC = 0;
  let conOferta = 0;
  let conDescuento = 0;
  let sinCobro = 0;

  pedidos.forEach((p, idx) => {
    const c = centimos(p.total);
    totalC += c;
    envioC += centimos(p.envio);
    descuentoC += centimos(p.descuento);
    propinaC += centimos(p.propina);
    const canal = p.canal || 'OTRO';
    sumar(porCanal, canal, c);
    sumar(porModalidad, p.modalidad || 'OTRA', c);
    const h = horaLima(p.creado_en);
    sumar(porTurno, TURNOS.find((t) => h >= HORAS_TURNO[t][0] && h < HORAS_TURNO[t][1]) ?? 'NOCHE', c);
    const per = periodoDe(p.creado_en);
    const celdaCanal = porCanalPeriodo.get(canal) ?? new Map<string, Acum>();
    sumar(celdaCanal, per, c);
    porCanalPeriodo.set(canal, celdaCanal);

    const pagos = p.cobros.flatMap((x) => x.pagos);
    if (p.cobros.length === 0) sinCobro += 1;
    for (const g of pagos) {
      const medio = (g.medio || '').trim().toUpperCase() || 'OTRO';
      const m = centimos(g.monto);
      sumar(porMedio, medio, m);
      const celdaMedio = porMedioPeriodo.get(medio) ?? new Map<string, Acum>();
      sumar(celdaMedio, per, m);
      porMedioPeriodo.set(medio, celdaMedio);
    }

    let tieneOferta = false;
    for (const l of p.lineas) {
      if (l.es_cortesia) continue; // cortesía: no es venta
      const lc = centimos(l.subtotal);
      const esCombo = l.oferta_id != null;
      const clave = esCombo ? `o${l.oferta_id}` : l.producto_id != null ? `p${l.producto_id}` : `n${l.nombre}`;
      const f = productos.get(clave) ?? { nombre: l.nombre, categoria: esCombo ? 'Combos' : (l.producto?.categoria?.nombre ?? 'Sin categoría'), unidades: 0, c: 0, ids: new Set<number>(), combo: esCombo };
      f.unidades += l.cantidad;
      f.c += lc; // las opciones ya van dentro del subtotal de su línea: no se suman aparte
      f.ids.add(idx);
      productos.set(clave, f);
      if (esCombo) {
        tieneOferta = true;
        const co = combos.get(clave) ?? { nombre: l.nombre, unidades: 0, c: 0, pedidos: 0 };
        co.unidades += l.cantidad;
        co.c += lc;
        co.pedidos += 1;
        combos.set(clave, co);
      }
    }
    if (tieneOferta) {
      conOferta += 1;
      conOfertaC += c;
    }
    const detalle = Array.isArray(p.descuento_detalle) ? (p.descuento_detalle as Array<Record<string, unknown>>) : [];
    let tuvo = false;
    for (const d of detalle) {
      const monto = centimos(d?.montoDescontado);
      if (monto <= 0) continue;
      tuvo = true;
      const tipo = String(d.tipo ?? 'DESCUENTO');
      const nombre = String(d.nombre ?? 'Descuento');
      const k = `${tipo}|${nombre}`;
      const a = descuentos.get(k) ?? { tipo, nombre, c: 0, pedidos: 0 };
      a.c += monto;
      a.pedidos += 1;
      descuentos.set(k, a);
    }
    if (tuvo) conDescuento += 1;
  });

  const n = pedidos.length;
  const ticket = (a: Acum) => (a.pedidos > 0 ? $(Math.round(a.c / a.pedidos)) : null);
  const pct = (parte: number, total: number) => (total > 0 ? Math.round((parte / total) * 1000) / 10 : null);
  const filas = (m: Map<string, Acum>) =>
    [...m.entries()]
      .sort((a, b) => b[1].pedidos - a[1].pedidos)
      .map(([id, a]) => ({ id, pedidos: a.pedidos, monto: $(a.c), ticket: ticket(a), porcentaje: pct(esAdmin ? a.c : a.pedidos, esAdmin ? totalC : n) }));

  const lista = [...productos.values()].map((f) => ({ nombre: f.nombre, categoria: f.categoria, unidades: f.unidades, monto: $(f.c), pedidos: f.ids.size, combo: f.combo, _c: f.c }));
  const quitar = ({ _c, ...r }: (typeof lista)[number]) => r;
  const masVendidos = [...lista].sort((a, b) => b.unidades - a.unidades || b._c - a._c).slice(0, TOP).map(quitar);
  const menosVendidos = [...lista].sort((a, b) => a.unidades - b.unidades || a._c - b._c).slice(0, TOP).map(quitar);
  const masMonto = esAdmin ? [...lista].sort((a, b) => b._c - a._c).slice(0, TOP).map(quitar) : [];

  const categorias = new Map<string, { unidades: number; c: number }>();
  for (const f of lista) {
    const a = categorias.get(f.categoria) ?? { unidades: 0, c: 0 };
    a.unidades += f.unidades;
    a.c += f._c;
    categorias.set(f.categoria, a);
  }

  const periodos = [...new Set([...porCanalPeriodo.values(), ...porMedioPeriodo.values()].flatMap((m) => [...m.keys()]))].sort();
  const serie = (mapa: Map<string, Map<string, Acum>>) =>
    [...mapa.entries()]
      .sort((a, b) => [...b[1].values()].reduce((s, x) => s + x.pedidos, 0) - [...a[1].values()].reduce((s, x) => s + x.pedidos, 0))
      .map(([id, m]) => ({ id, valores: periodos.map((p) => (esAdmin ? (m.get(p)?.c ?? 0) / 100 : (m.get(p)?.pedidos ?? 0))) }));

  const totalPagos = [...porMedio.values()].reduce((s, a) => s + (esAdmin ? a.c : a.pedidos), 0);
  const medios = [...porMedio.entries()]
    .sort((a, b) => (MEDIOS.indexOf(a[0]) + 1 || 99) - (MEDIOS.indexOf(b[0]) + 1 || 99))
    .map(([id, a]) => ({ id, pagos: a.pedidos, monto: $(a.c), porcentaje: pct(esAdmin ? a.c : a.pedidos, totalPagos) }));

  return {
    pedidos: n,
    ventas: { monto: $(totalC), ticket: n > 0 ? $(Math.round(totalC / n)) : null, envio: $(envioC), descuento: $(descuentoC), propinaAparte: $(propinaC) },
    porCanal: filas(porCanal),
    porModalidad: filas(porModalidad),
    porTurno: filas(porTurno),
    evolucion: {
      granularidad: semanal ? ('semana' as const) : ('dia' as const),
      /** Con ADMIN los valores son soles; con SUPERVISOR, pedidos. */
      unidad: esAdmin ? ('soles' as const) : ('pedidos' as const),
      periodos,
      canales: serie(porCanalPeriodo),
      medios: serie(porMedioPeriodo),
    },
    productos: {
      masVendidos,
      menosVendidos,
      masMonto,
      categorias: [...categorias.entries()]
        .sort((a, b) => b[1].unidades - a[1].unidades)
        .slice(0, MAX_FILAS)
        .map(([nombre, a]) => ({ nombre, unidades: a.unidades, monto: $(a.c) })),
      distintos: lista.length,
    },
    medios: { filas: medios, pedidosSinCobro: sinCobro },
    ofertas: {
      pedidosConCombo: conOferta,
      aporteCombos: $(conOfertaC),
      porcentajeAporte: pct(esAdmin ? conOfertaC : conOferta, esAdmin ? totalC : n),
      combos: [...combos.values()].sort((a, b) => b.unidades - a.unidades).slice(0, MAX_FILAS).map((c) => ({ nombre: c.nombre, unidades: c.unidades, monto: $(c.c), pedidos: c.pedidos })),
      pedidosConDescuento: conDescuento,
      descuentos: [...descuentos.values()]
        .sort((a, b) => b.c - a.c)
        .slice(0, MAX_FILAS)
        .map((d) => ({ tipo: d.tipo, nombre: d.nombre, pedidos: d.pedidos, monto: $(d.c) })),
    },
  };
}

@Injectable()
export class VentasService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen(filtros: FiltrosAnalisis, esAdmin: boolean, ahora: Date = new Date()) {
    const rango = resolverFiltros(filtros, ahora);
    const filas = await this.prisma.pedido.findMany({
      where: {
        creado_en: { gte: rango.inicio, lt: rango.fin },
        estado: { notIn: ['ANULADO', 'RECHAZADO'] },
        ...(rango.modalidad ? { modalidad: rango.modalidad } : {}),
        ...(rango.canal ? { canal: rango.canal } : {}),
      },
      select: {
        canal: true,
        modalidad: true,
        estado: true,
        creado_en: true,
        total: true,
        descuento: true,
        envio: true,
        propina: true,
        descuento_detalle: true,
        lineas: {
          where: { linea_combo_id: null },
          select: { nombre: true, cantidad: true, subtotal: true, producto_id: true, oferta_id: true, es_cortesia: true, producto: { select: { categoria: { select: { nombre: true } } } } },
        },
        cobros: { where: { anulado_en: null }, select: { pagos: { select: { medio: true, monto: true } } } },
      },
      orderBy: { creado_en: 'desc' },
      take: MAX_PEDIDOS_VENTAS + 1,
    });
    const truncado = filas.length > MAX_PEDIDOS_VENTAS;
    const datos = agregarVentas((truncado ? filas.slice(0, MAX_PEDIDOS_VENTAS) : filas) as unknown as PedidoVenta[], rango, esAdmin);
    return {
      generadoEn: ahora.toISOString(),
      rango: { desde: rango.desde, hasta: rango.hasta, dias: rango.dias },
      filtros: { modalidad: rango.modalidad, canal: rango.canal, turno: rango.turno },
      truncado,
      limite: MAX_PEDIDOS_VENTAS,
      conDinero: esAdmin,
      ...datos,
    };
  }
}
