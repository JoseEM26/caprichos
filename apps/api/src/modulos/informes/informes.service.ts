import { Injectable } from '@nestjs/common';
import { controlAlmacenActivo } from '../stock/control-almacen';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { inicioDiaLimaIso, finDiaLimaIso, horaLimaEntera } from '../../comun/fechas-lima';
import { COORDENADAS_LOCAL_DEFAULT, DATOS_LOCAL_DEFAULT } from '../local/local.service';
import { cobroVigente } from '../caja/caja.calculo';
import { FiltroInformeDto, FiltroMapaDto } from './dto/filtro-informe.dto';
import {
  IndicadoresData,
  MapaEntregasData,
  ReporteDetalle,
  ReporteItemCatalogo,
  KpiItem,
  PuntoEntregaMapa,
  ResumenEscritorio,
  ZonaVentasFila,
  RadioDistanciaFila,
} from './informes.tipos';

// Catálogo oficial de los 23 reportes requeridos (FT-INF-01 / HU-CAP-162)
export const CATALOGO_REPORTES = [
  { id: 'resumen', n: 'Resumen del día', cat: 'Ventas', que: 'Pedidos, ventas, ticket promedio y cuánto falta cobrar, por estado del pedido.', fil: 'Fecha, local', exp: 'PDF · Excel' },
  { id: 'dia', n: 'Ventas por día', cat: 'Ventas', que: 'Pedidos, ventas y ticket promedio de cada día del período, con el mejor y el peor día.', fil: 'Fecha, canal, pago', exp: 'PDF · Excel' },
  { id: 'producto', n: 'Ventas por producto', cat: 'Ventas', que: 'Unidades y monto estimado de cada plato, del más al menos vendido.', fil: 'Fecha, categoría', exp: 'PDF · Excel' },
  { id: 'categoria', n: 'Ventas por categoría', cat: 'Ventas', que: 'Qué categoría de la carta deja más: frappes, waffles, salados, postres…', fil: 'Fecha', exp: 'PDF · Excel' },
  { id: 'canal', n: 'Ventas por canal', cat: 'Ventas', que: 'Salón, mostrador, carta web y WhatsApp: pedidos, monto y ticket.', fil: 'Fecha', exp: 'PDF · Excel' },
  { id: 'modalidad', n: 'Ventas por modalidad', cat: 'Ventas', que: 'Cuánto se vende en el local, para llevar y por delivery.', fil: 'Fecha', exp: 'PDF · Excel' },
  { id: 'pago', n: 'Ventas por método de pago', cat: 'Ventas', que: 'Efectivo, Yape, Plin, transferencia y tarjeta: lo de hoy y lo de los últimos cierres.', fil: 'Fecha', exp: 'PDF · Excel' },
  { id: 'rechazados', n: 'Pedidos rechazados', cat: 'Ventas', que: 'Pedidos que no se aceptaron o se anularon, con cliente y monto.', fil: 'Fecha, canal', exp: 'PDF · Excel' },
  { id: 'cierres', n: 'Cierres de caja', cat: 'Caja', que: 'Cada cierre con sus ventas, lo esperado, lo contado y la diferencia.', fil: 'Fecha, caja', exp: 'PDF' },
  { id: 'medios', n: 'Caja por medio de pago', cat: 'Caja', que: 'Por día: efectivo, Yape, Plin, transferencia, tarjeta y otros lado a lado.', fil: 'Fecha, caja', exp: 'PDF · Excel' },
  { id: 'arqueo', n: 'Arqueo y diferencias', cat: 'Caja', que: 'Solo los cierres donde faltó o sobró efectivo, con la explicación que dejó el cajero.', fil: 'Fecha, caja', exp: 'PDF' },
  { id: 'cobrar', n: 'Pendiente de cobro', cat: 'Caja', que: 'Pedidos aceptados que todavía no se cobraron, con su método de pago.', fil: 'Canal, estado', exp: 'PDF · Excel' },
  { id: 'stockbajo', n: 'Stock bajo', cat: 'Inventario', que: 'Insumos por debajo del mínimo: cuánto hay en almacén y cocina, y cuánto falta.', fil: 'Almacén', exp: 'PDF · Excel', sinFecha: true },
  { id: 'kardex', n: 'Kardex de insumos', cat: 'Inventario', que: 'Entradas, salidas y mermas más recientes, con origen y destino.', fil: 'Fecha, insumo', exp: 'Excel' },
  { id: 'mermas', n: 'Mermas', cat: 'Inventario', que: 'Pérdidas por insumo y motivo.', fil: 'Fecha', exp: 'Excel' },
  { id: 'produccion', n: 'Producción registrada', cat: 'Inventario', que: 'Lo que se produjo (donas, galletas, pan, gelatina) y de dónde salió la materia prima.', fil: 'Fecha', exp: 'PDF · Excel' },
  { id: 'proveedor', n: 'Compras por proveedor', cat: 'Compras', que: 'Cuánto se compró a cada proveedor y cuánto sigue pendiente.', fil: 'Fecha, proveedor', exp: 'PDF · Excel' },
  { id: 'comprasestado', n: 'Compras por estado y pago', cat: 'Compras', que: 'Recibidas, pendientes y anuladas; contado frente a crédito.', fil: 'Fecha', exp: 'PDF · Excel' },
  { id: 'topclientes', n: 'Mejores clientes', cat: 'Clientes', que: 'Quién pide más y cuántos puntos acumula.', fil: 'Tipo', exp: 'Excel', sinFecha: true },
  { id: 'cumple', n: 'Próximos cumpleaños', cat: 'Clientes', que: 'Quién cumple años pronto, para saludarlo o darle un detalle.', fil: 'Días por delante', exp: 'Excel', sinFecha: true },
  { id: 'creditos', n: 'Créditos del personal por mes', cat: 'Clientes', que: 'Lo consumido por cada trabajador, mes a mes, para descontarlo a fin de mes.', fil: 'Trabajador, mes', exp: 'PDF · Excel' },
  { id: 'repartidor', n: 'Delivery por repartidor', cat: 'Delivery', que: 'Pedidos y monto que lleva cada repartidor.', fil: 'Fecha, repartidor', exp: 'PDF · Excel' },
  { id: 'zonas', n: 'Delivery por zona', cat: 'Delivery', que: 'Pedidos a domicilio por barrio, para ver dónde conviene reforzar el reparto.', fil: 'Fecha, zona', exp: 'PDF' },
];

/** Meta de entrega del local: 13 minutos. */
const META_ENTREGA_MIN = 13;
const SIN_COMPARAR = { dTxt: 'Sin datos del período anterior', dCol: 'var(--cp-soft)' };
const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
/** Colores con contraste sobre fondo claro; los gráficos además rotulan cada serie con texto. */
const COLORES_SERIE = ['#E67929', '#0B2C3E', '#2B824E', '#8B5CF6', '#D99E39', '#3B82F6', '#EC4899'];

/** Grupos de canal del filtro del escritorio: el primero que coincide gana (un delivery por WhatsApp cuenta en WhatsApp). */
const GRUPOS_CANAL = [
  { id: 'salon', nombre: 'Salón', color: '#E67929' },
  { id: 'delivery', nombre: 'Delivery', color: '#0B2C3E' },
  { id: 'web', nombre: 'Web (recojo)', color: '#D99E39' },
  { id: 'whatsapp', nombre: 'WhatsApp', color: '#2B824E' },
] as const;

const MODALIDADES = [
  { nombre: 'En el local', color: '#E67929' },
  { nombre: 'Para llevar', color: '#D99E39' },
  { nombre: 'Delivery', color: '#0B2C3E' },
  { nombre: 'Otra', color: '#8B5CF6' },
] as const;

const MODALIDAD_LOCAL = ['MESA', 'COMER_LOCAL', 'LOCAL', 'SALON'];
const MODALIDAD_LLEVAR = ['LLEVAR', 'RECOGER', 'RECOJO'];

export function grupoDePedido(p: { canal: string | null; modalidad: string | null }): (typeof GRUPOS_CANAL)[number]['id'] {
  const c = (p.canal || '').toUpperCase();
  const m = (p.modalidad || '').toUpperCase();
  if (c === 'WHATSAPP' || c === 'BOT') return 'whatsapp';
  if (m === 'DELIVERY' || c === 'DELIVERY') return 'delivery';
  if (MODALIDAD_LOCAL.includes(m) || c === 'MOZO' || c === 'LOCAL' || c === 'CAJA') return 'salon';
  return 'web';
}

const nombreModalidad = (modalidad: string | null): (typeof MODALIDADES)[number]['nombre'] => {
  const m = (modalidad || '').toUpperCase();
  if (MODALIDAD_LOCAL.includes(m)) return 'En el local';
  if (MODALIDAD_LLEVAR.includes(m)) return 'Para llevar';
  if (m === 'DELIVERY') return 'Delivery';
  return 'Otra';
};

const MEDIOS: Record<string, string> = { EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin', TRANSFERENCIA: 'Transferencia', TARJETA: 'Tarjeta' };
const medioLegible = (medio: string) => MEDIOS[(medio || '').toUpperCase()] ?? 'Otro';

const diaLima = (d: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(d);
const diaSemanaLima = (d: Date): number => new Date(`${diaLima(d)}T12:00:00Z`).getUTCDay();

@Injectable()
export class InformesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Formatea montos en soles peruanos */
  private soles(n: number): string {
    const num = isNaN(n) ? 0 : n;
    const abs = Math.abs(Math.round(num * 100) / 100).toFixed(2);
    const formatted = Number(abs).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return (num < 0 ? '-s/ ' : 's/ ') + formatted;
  }

  /**
   * Construye el filtro de Prisma según fechas y atributos de pedido
   */
  private armarWherePedidos(filtro: FiltroInformeDto) {
    const { desde, hasta, canal, pago, modalidad } = filtro;
    const where: any = {};
    if (desde || hasta) {
      where.creado_en = {};
      if (desde) where.creado_en.gte = inicioDiaLimaIso(desde);
      if (hasta) where.creado_en.lte = finDiaLimaIso(hasta);
    }
    if (canal && canal !== 'todos' && canal !== 'all') {
      where.canal = canal.toUpperCase();
    }
    if (modalidad && modalidad !== 'todos' && modalidad !== 'all') {
      where.modalidad = modalidad.toUpperCase();
    }
    if (pago && pago !== 'todos' && pago !== 'all') {
      where.pago_metodo = pago.toUpperCase();
    }
    return where;
  }

  /**
   * Escritorio del ADMIN: KPIs, gráficos y tareas pendientes desde la base de datos real.
   * Dinero del negocio (ventas, ticket, comparativos, montos por canal, medio de pago, categoría o producto, por cobrar)
   * SOLO sale para ADMIN. Para cualquier otra cuenta el servidor arma la respuesta sin esos campos: conteos y tiempos.
   */
  async obtenerResumen(filtro: FiltroInformeDto, usuario?: { rol: string; roles?: string[] }): Promise<ResumenEscritorio> {
    const esAdmin = !!usuario && (usuario.roles ?? [usuario.rol]).includes('ADMIN');
    // El filtro de canal del escritorio usa grupos (Salón, Delivery, Web, WhatsApp): se aplica sobre los pedidos ya traídos
    const grupoCanal = GRUPOS_CANAL.find((g) => g.id === (filtro.canal ?? '').toLowerCase());
    const where = this.armarWherePedidos(grupoCanal ? { ...filtro, canal: undefined } : filtro);
    const delGrupo = <T extends { canal: string | null; modalidad: string | null }>(ps: T[]) =>
      grupoCanal ? ps.filter((p) => grupoDePedido(p) === grupoCanal.id) : ps;
    const sumar = (ns: number[]) => ns.reduce((a, b) => a + b, 0);
    const media = (ns: number[]) => (ns.length ? Math.round(sumar(ns) / ns.length) : 0);

    const pedidos = delGrupo(
      await this.prisma.pedido.findMany({
        where,
        include: {
          lineas: { include: { producto: { include: { categoria: true } } } },
          cobros: { include: { pagos: true } },
        },
        orderBy: { creado_en: 'asc' },
      }),
    );

    const noRechazados = pedidos.filter((p) => p.estado !== 'RECHAZADO' && p.estado !== 'ANULADO');
    const totalVentas = sumar(noRechazados.map((p) => Number(p.total || 0)));
    const cantidadPedidos = noRechazados.length;
    const ticketPromedio = cantidadPedidos > 0 ? totalVentas / cantidadPedidos : 0;

    // Tiempo real de entrega: de creado a entregado, en minutos
    const minutosEntrega = (p: { entregado_en: Date | null; creado_en: Date | null; confirmado_en: Date | null }) =>
      Math.max(1, Math.round((p.entregado_en!.getTime() - (p.creado_en || p.confirmado_en)!.getTime()) / 60000));
    const tiempoEntregaPromedio = media(noRechazados.filter((p) => p.entregado_en).map(minutosEntrega));

    const kpisS: KpiItem[] = [
      ...(esAdmin ? [{ n: 'VENTAS', v: this.soles(totalVentas), ...SIN_COMPARAR }] : []),
      { n: 'PEDIDOS', v: String(cantidadPedidos), ...SIN_COMPARAR },
      ...(esAdmin ? [{ n: 'TICKET PROMEDIO', v: this.soles(ticketPromedio), ...SIN_COMPARAR }] : []),
      {
        n: 'TIEMPO DE ENTREGA',
        v: tiempoEntregaPromedio > 0 ? `${tiempoEntregaPromedio} min` : '- min',
        dTxt:
          tiempoEntregaPromedio === 0
            ? 'Sin datos en el período'
            : tiempoEntregaPromedio <= META_ENTREGA_MIN
              ? `Meta ${META_ENTREGA_MIN} min · Cumple la meta`
              : `Meta ${META_ENTREGA_MIN} min · +${tiempoEntregaPromedio - META_ENTREGA_MIN} min sobre la meta`,
        dCol: tiempoEntregaPromedio === 0 ? 'var(--cp-soft)' : tiempoEntregaPromedio <= META_ENTREGA_MIN ? 'var(--cp-ok)' : 'var(--cp-rust)',
      },
    ];

    // Comparación con el período anterior de la misma duración, con los mismos filtros (solo ADMIN: son montos)
    const comparar = async () => {
      if (!(esAdmin && filtro.desde && filtro.hasta)) return;
      const d1 = inicioDiaLimaIso(filtro.desde).getTime();
      const duracionMs = Math.max(86400000, finDiaLimaIso(filtro.hasta).getTime() - d1);
      const otrosFiltros = { ...where };
      delete otrosFiltros.creado_en;
      const anteriores = delGrupo(
        await this.prisma.pedido.findMany({
          where: { ...otrosFiltros, creado_en: { gte: new Date(d1 - duracionMs), lte: new Date(d1 - 1) }, estado: { notIn: ['RECHAZADO', 'ANULADO'] } },
          select: { total: true, canal: true, modalidad: true },
        }),
      );
      const prevTotal = sumar(anteriores.map((p) => Number(p.total || 0)));
      const prevCant = anteriores.length;
      const variacion = (actual: number, previo: number) => {
        if (!(previo > 0)) return null;
        const d = ((actual - previo) / previo) * 100;
        return { dTxt: `${d >= 0 ? '+' : ''}${d.toFixed(1)}% frente al período anterior`, dCol: d >= 0 ? 'var(--cp-ok)' : 'var(--cp-rust)' };
      };
      const cambios: Record<string, ReturnType<typeof variacion>> = {
        VENTAS: variacion(totalVentas, prevTotal),
        PEDIDOS: variacion(cantidadPedidos, prevCant),
        'TICKET PROMEDIO': variacion(ticketPromedio, prevCant > 0 ? prevTotal / prevCant : 0),
      };
      for (const k of kpisS) if (cambios[k.n]) Object.assign(k, cambios[k.n]);
    };

    // Tareas pendientes «Para hacer ahora» (todo el local, no solo el período)
    const stockActivo = await controlAlmacenActivo(this.prisma);
    const [, porConfirmarCount, enCocinaCount, repartosActivosCount, insumosBajoMinimo] = await Promise.all([
      comparar(),
      this.prisma.pedido.count({ where: { estado: 'NUEVO' } }),
      this.prisma.pedido.count({ where: { estado: { in: ['COLA', 'PREPARANDO'] } } }),
      this.prisma.pedido.count({ where: { estado: 'EN_CAMINO' } }),
      stockActivo ? this.prisma.stock.count({ where: { insumo: { activo: true }, cantidad: { lt: 10 } } }) : Promise.resolve(0),
    ]);
    const pending = [
      { n: 'Por confirmar', v: porConfirmarCount, view: '/admin/caja' },
      { n: 'En cocina', v: enCocinaCount, view: '/admin/cocina' },
      { n: 'Repartos activos', v: repartosActivosCount, view: '/admin/repartos' },
      // Con el «Control de almacén» apagado no se muestran avisos de insumos
      ...(stockActivo ? [{ n: 'Insumos con stock bajo', v: insumosBajoMinimo, view: '/admin/stock' }] : []),
    ];

    // Una sola pasada por los pedidos: canal, modalidad, hora, día, día de la semana, medio de pago, productos y categorías
    type Fila = { pedidos: number; monto: number };
    const porGrupo = new Map<string, Fila>();
    const porModalidad = new Map<string, Fila>();
    const porHora = new Map<number, Fila>();
    const porDia = new Map<string, Fila>();
    const entregaPorDia = new Map<string, number[]>();
    const porSemana = new Map<number, Fila>();
    const porPago = new Map<string, Fila>();
    const porProducto = new Map<string, { q: number; monto: number }>();
    const porCategoria = new Map<string, { monto: number; q: number }>();
    const acumular = <K>(m: Map<K, Fila>, k: K, monto: number) => {
      const f = m.get(k) ?? { pedidos: 0, monto: 0 };
      f.pedidos += 1;
      f.monto += monto;
      m.set(k, f);
    };
    for (const p of noRechazados) {
      const monto = Number(p.total || 0);
      const dia = diaLima(p.creado_en);
      acumular(porGrupo, grupoDePedido(p), monto);
      acumular(porModalidad, nombreModalidad(p.modalidad), monto);
      acumular(porHora, horaLimaEntera(p.creado_en), monto);
      acumular(porSemana, diaSemanaLima(p.creado_en), monto);
      acumular(porDia, dia, monto);
      if (p.entregado_en) entregaPorDia.set(dia, [...(entregaPorDia.get(dia) ?? []), minutosEntrega(p)]);
      for (const c of (p.cobros || []).filter((c: any) => !c.anulado_en)) {
        for (const pg of c.pagos) acumular(porPago, medioLegible(pg.medio), Number(pg.monto || 0));
      }
      for (const l of p.lineas) {
        const nombre = l.nombre || l.producto?.nombre || 'Producto';
        const cat = l.producto?.categoria?.nombre || 'General';
        const q = Number(l.cantidad || 1);
        const sub = Number(l.subtotal || 0);
        const pr = porProducto.get(nombre) ?? { q: 0, monto: 0 };
        pr.q += q;
        pr.monto += sub;
        porProducto.set(nombre, pr);
        const ca = porCategoria.get(cat) ?? { monto: 0, q: 0 };
        ca.monto += sub;
        ca.q += q;
        porCategoria.set(cat, ca);
      }
    }
    // Conteos siempre; montos solo para ADMIN
    const conMonto = (monto: number) => (esAdmin ? { monto: this.soles(monto), valor: Math.round(monto * 100) / 100 } : {});
    const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
    const parte = (f: Fila) => (esAdmin ? pct(f.monto, totalVentas) : pct(f.pedidos, cantidadPedidos));

    const legend = GRUPOS_CANAL.map((g) => {
      const f = porGrupo.get(g.id) ?? { pedidos: 0, monto: 0 };
      return { n: g.nombre, c: g.color, pedidos: f.pedidos, pct: parte(f), ...conMonto(f.monto) };
    });
    const modalidades = MODALIDADES.map((m) => {
      const f = porModalidad.get(m.nombre) ?? { pedidos: 0, monto: 0 };
      return { n: m.nombre, c: m.color, pedidos: f.pedidos, pct: parte(f), ...conMonto(f.monto) };
    });

    const horasConDatos = [...porHora.keys()];
    const horaMin = horasConDatos.length ? Math.min(...horasConDatos) : 0;
    const horaMax = horasConDatos.length ? Math.max(...horasConDatos) : -1;
    const porHoraLista = Array.from({ length: horaMax - horaMin + 1 }, (_, i) => {
      const f = porHora.get(horaMin + i) ?? { pedidos: 0, monto: 0 };
      return { hora: horaMin + i, pedidos: f.pedidos, ...conMonto(f.monto) };
    });
    // Lunes primero
    const porSemanaLista = [1, 2, 3, 4, 5, 6, 0].map((d) => {
      const f = porSemana.get(d) ?? { pedidos: 0, monto: 0 };
      return { dia: DIAS_SEMANA[d], pedidos: f.pedidos, ...conMonto(f.monto) };
    });
    const porDiaLista = [...porDia.keys()].sort().map((fecha) => {
      const f = porDia.get(fecha)!;
      return { fecha, pedidos: f.pedidos, entregaMin: media(entregaPorDia.get(fecha) ?? []), ...conMonto(f.monto) };
    });
    const conteoEstados = new Map<string, number>();
    for (const p of pedidos) conteoEstados.set(p.estado, (conteoEstados.get(p.estado) ?? 0) + 1);

    // Productos: el ranking es por unidades (operativo); el monto solo sale para ADMIN
    const tops2 = [...porProducto.entries()]
      .sort((a, b) => b[1].q - a[1].q)
      .slice(0, 8)
      .map(([n, d]) => ({ n, unidades: d.q, ...conMonto(d.monto) }));
    const base = {
      kpisS,
      rechazados: pedidos.length - noRechazados.length,
      legend,
      modalidades,
      porHora: porHoraLista,
      porDiaSemana: porSemanaLista,
      porDia: porDiaLista,
      porEstado: [...conteoEstados.entries()].map(([estado, n]) => ({ estado, n })),
      tops2,
      pending,
      metaEntregaMin: META_ENTREGA_MIN,
    };
    if (!esAdmin) return base;

    // Solo ADMIN: por cobrar (aceptados sin entregar ni cobro vigente), medios de pago, categorías y el día pico
    const porCobrar = sumar(
      pedidos
        .filter((p) => p.estado !== 'RECHAZADO' && p.estado !== 'ANULADO' && p.estado !== 'ENTREGADO' && !(p.cobros || []).some((c: any) => !c.anulado_en))
        .map((p) => Number(p.total || 0)),
    );
    const diaPico = porDiaLista.reduce<(typeof porDiaLista)[number] | null>((m, d) => (!m || (d.valor ?? 0) > (m.valor ?? 0) ? d : m), null);
    const totalPagos = sumar([...porPago.values()].map((f) => f.monto));
    return {
      ...base,
      porCobrar: this.soles(porCobrar),
      peak: diaPico ? `Pico: ${diaPico.monto} el ${diaPico.fecha.slice(8)}/${diaPico.fecha.slice(5, 7)}` : 'Sin ventas en el período',
      pagos: [...porPago.entries()]
        .sort((a, b) => b[1].monto - a[1].monto)
        .map(([n, f], i) => ({ n, c: COLORES_SERIE[i % COLORES_SERIE.length], pedidos: f.pedidos, pct: pct(f.monto, totalPagos), ...conMonto(f.monto) })),
      cats2: [...porCategoria.entries()]
        .sort((a, b) => b[1].monto - a[1].monto)
        .map(([n, d], i) => ({ n, c: COLORES_SERIE[i % COLORES_SERIE.length], unidades: d.q, ...conMonto(d.monto) })),
    };
  }

  /**
   * Catálogo de los 23 reportes con sus contadores calculados dinámicamente desde la BD
   */
  async obtenerCatalogo(filtro: FiltroInformeDto): Promise<ReporteItemCatalogo[]> {
    const where = this.armarWherePedidos(filtro);

    // Consultas agregadas de conteo
    const totalPedidos = await this.prisma.pedido.count({ where });
    const ventasSuma = await this.prisma.pedido.aggregate({
      where: { ...where, estado: { notIn: ['RECHAZADO', 'ANULADO'] } },
      _sum: { total: true },
    });
    const totalVentasStr = this.soles(Number(ventasSuma._sum.total || 0));

    const productosDistintos = await this.prisma.pedidoLinea.groupBy({
      by: ['producto_id'],
      where: { pedido: where },
    });

    const canalesDistintos = await this.prisma.pedido.groupBy({
      by: ['canal'],
      where: { ...where, estado: { notIn: ['RECHAZADO', 'ANULADO'] } },
    });
    const modalidadesDistintas = await this.prisma.pedido.groupBy({
      by: ['modalidad'],
      where: { ...where, estado: { notIn: ['RECHAZADO', 'ANULADO'] } },
    });

    const categoriasDistintas = await this.prisma.categoria.count({ where: { oculta: false } });
    const rechazadosCount = await this.prisma.pedido.count({
      where: { ...where, estado: { in: ['RECHAZADO', 'ANULADO'] } },
    });
    const cierresCount = await this.prisma.cierreCaja.count();
    const cobrarCount = await this.prisma.pedido.count({
      where: { ...where, estado: { notIn: ['RECHAZADO', 'ANULADO', 'ENTREGADO'] }, cobros: { none: { anulado_en: null } } },
    });
    const stockBajoCount = await this.prisma.stock.count({
      where: { insumo: { activo: true }, cantidad: { lt: 10 } },
    });
    const kardexCount = await this.prisma.movimientoStock.count();
    const mermasCount = await this.prisma.movimientoStock.count({ where: { tipo: 'MERMA' } });
    const produccionCount = await this.prisma.produccion.count();
    const comprasCount = await this.prisma.compra.count();
    const clientesCount = await this.prisma.customerAccount.count();
    const cumpleCount = await this.prisma.person.count({
      where: { cumple_dia: { not: null }, cumple_mes: { not: null } },
    });
    const creditosCount = await this.prisma.consumoPersonal.count();
    const deliveryCount = await this.prisma.pedido.count({
      where: { ...where, OR: [{ canal: 'CARTA' }, { modalidad: 'DELIVERY' }] },
    });
    const zonasCount = await this.prisma.zonaReparto.count({ where: { activa: true } });

    return CATALOGO_REPORTES.map((d) => {
      let kn = 'Ventas';
      let kv = totalVentasStr;
      let filasTotal = totalPedidos;

      if (d.id === 'producto') {
        kn = 'Productos distintos';
        kv = String(productosDistintos.length);
        filasTotal = productosDistintos.length;
      } else if (d.id === 'categoria') {
        kn = 'Categorías';
        kv = String(categoriasDistintas);
        filasTotal = categoriasDistintas;
      } else if (d.id === 'canal') {
        kn = 'Ventas';
        kv = totalVentasStr;
        filasTotal = canalesDistintos.length;
      } else if (d.id === 'modalidad') {
        kn = 'Ventas';
        kv = totalVentasStr;
        filasTotal = modalidadesDistintas.length;
      } else if (d.id === 'pago') {
        kn = 'Total pedidos';
        kv = String(totalPedidos);
        filasTotal = totalPedidos;
      } else if (d.id === 'rechazados') {
        kn = 'Pedidos rechazados';
        kv = String(rechazadosCount);
        filasTotal = rechazadosCount;
      } else if (d.id === 'cierres') {
        kn = 'Cierres';
        kv = String(cierresCount);
        filasTotal = cierresCount;
      } else if (d.id === 'medios') {
        kn = 'Cierres registrados';
        kv = String(cierresCount);
        filasTotal = cierresCount;
      } else if (d.id === 'arqueo') {
        kn = 'Cierres totales';
        kv = String(cierresCount);
        filasTotal = cierresCount;
      } else if (d.id === 'cobrar') {
        kn = 'Pedidos sin cobrar';
        kv = String(cobrarCount);
        filasTotal = cobrarCount;
      } else if (d.id === 'stockbajo') {
        kn = 'Insumos bajo el mínimo';
        kv = String(stockBajoCount);
        filasTotal = stockBajoCount;
      } else if (d.id === 'kardex') {
        kn = 'Movimientos';
        kv = String(kardexCount);
        filasTotal = kardexCount;
      } else if (d.id === 'mermas') {
        kn = 'Registros';
        kv = String(mermasCount);
        filasTotal = mermasCount;
      } else if (d.id === 'produccion') {
        kn = 'Producciones registradas';
        kv = String(produccionCount);
        filasTotal = produccionCount;
      } else if (d.id === 'proveedor') {
        kn = 'Compras';
        kv = String(comprasCount);
        filasTotal = comprasCount;
      } else if (d.id === 'comprasestado') {
        kn = 'Compras';
        kv = String(comprasCount);
        filasTotal = comprasCount;
      } else if (d.id === 'topclientes') {
        kn = 'Clientes con cuenta';
        kv = String(clientesCount);
        filasTotal = clientesCount;
      } else if (d.id === 'cumple') {
        kn = 'Cumpleaños registrados';
        kv = String(cumpleCount);
        filasTotal = cumpleCount;
      } else if (d.id === 'creditos') {
        kn = 'Consumos del personal';
        kv = String(creditosCount);
        filasTotal = creditosCount;
      } else if (d.id === 'repartidor') {
        kn = 'Pedidos delivery';
        kv = String(deliveryCount);
        filasTotal = deliveryCount;
      } else if (d.id === 'zonas') {
        kn = 'Zonas activas';
        kv = String(zonasCount);
        filasTotal = zonasCount;
      }

      return {
        id: d.id,
        nombre: d.n,
        categoria: d.cat,
        queResponde: d.que,
        filtrosTexto: d.fil,
        exportaTexto: d.exp,
        kpiClave: kn,
        kpiValor: kv,
        filasTotal,
        sinFecha: (d as any).sinFecha,
      };
    });
  }

  /**
   * Detalle completo de un reporte específico con columnas y filas reales.
   * Sin datos inventados ni filas de ejemplo copiadas a mano.
   */
  async obtenerDetalle(id: string, filtro: FiltroInformeDto): Promise<ReporteDetalle> {
    const d = CATALOGO_REPORTES.find((x) => x.id === id) || CATALOGO_REPORTES[0];
    const periodoTexto =
      filtro.desde && filtro.hasta ? `Del ${filtro.desde} al ${filtro.hasta}` : 'Todo el historial';
    const filtrosActivosTexto =
      filtro.canal || filtro.pago || filtro.modalidad ? 'Con filtros aplicados' : 'Sin filtros de pedidos';

    const where = this.armarWherePedidos(filtro);

    switch (id) {
      case 'resumen': {
        const grupos = await this.prisma.pedido.groupBy({
          by: ['estado'],
          where,
          _count: { id: true },
          _sum: { total: true },
        });
        const totalVentas = grupos
          .filter((g) => g.estado !== 'RECHAZADO' && g.estado !== 'ANULADO')
          .reduce((acc, g) => acc + Number(g._sum.total || 0), 0);
        const totalPedidos = grupos.reduce((acc, g) => acc + g._count.id, 0);
        const rechazados = grupos.find((g) => g.estado === 'RECHAZADO' || g.estado === 'ANULADO');

        const rows = grupos.map((g) => [g.estado, g._count.id, this.soles(Number(g._sum.total || 0))]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Pedidos', v: String(totalPedidos) },
            { n: 'Ventas', v: this.soles(totalVentas) },
            { n: 'Ticket promedio', v: this.soles(totalPedidos > 0 ? totalVentas / totalPedidos : 0) },
            { n: 'Rechazados', v: String(rechazados?._count.id || 0) },
          ],
          cols: ['Estado', 'Pedidos', 'Monto'],
          rows,
        };
      }

      case 'dia': {
        const pedidos = await this.prisma.pedido.findMany({
          where: { ...where, estado: { notIn: ['RECHAZADO', 'ANULADO'] } },
          orderBy: { creado_en: 'desc' },
        });
        const diasMap: Record<string, { pedidos: number; ventas: number }> = {};
        for (const p of pedidos) {
          const fechaStr = new Date(p.creado_en).toLocaleDateString('es-PE', { timeZone: 'America/Lima' });
          diasMap[fechaStr] = diasMap[fechaStr] || { pedidos: 0, ventas: 0 };
          diasMap[fechaStr].pedidos += 1;
          diasMap[fechaStr].ventas += Number(p.total || 0);
        }
        const totPeriodo = pedidos.reduce((acc, p) => acc + Number(p.total || 0), 0);
        const rows = Object.entries(diasMap).map(([f, data]) => [
          f,
          data.pedidos,
          this.soles(data.ventas),
          this.soles(data.pedidos > 0 ? data.ventas / data.pedidos : 0),
          totPeriodo > 0 ? `${Math.round((data.ventas / totPeriodo) * 100)} %` : '0 %',
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Días con ventas', v: String(rows.length) },
            { n: 'Ventas totales', v: this.soles(totPeriodo) },
          ],
          cols: ['Fecha', 'Pedidos', 'Ventas', 'Ticket promedio', '% del período'],
          rows,
        };
      }

      case 'producto': {
        // Las cortesías no son ventas: no cuentan unidades ni montos (van en el informe «Cortesías»)
        const lineas = await this.prisma.pedidoLinea.findMany({
          where: { es_cortesia: false, pedido: { ...where, estado: { notIn: ['RECHAZADO', 'ANULADO'] } } },
          include: { producto: true },
        });
        const pMap: Record<string, { q: number; sub: number }> = {};
        let totU = 0;
        for (const l of lineas) {
          const n = l.nombre || l.producto?.nombre || 'Producto';
          const q = Number(l.cantidad || 1);
          const sub = Number(l.subtotal || 0);
          pMap[n] = pMap[n] || { q: 0, sub: 0 };
          pMap[n].q += q;
          pMap[n].sub += sub;
          totU += q;
        }
        const rows = Object.entries(pMap)
          .sort((a, b) => b[1].q - a[1].q)
          .map(([n, data]) => [
            n,
            data.q,
            this.soles(data.sub),
            totU > 0 ? `${Math.round((data.q / totU) * 100)} %` : '0 %',
          ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Productos distintos', v: String(rows.length) },
            { n: 'Unidades vendidas', v: String(totU) },
          ],
          cols: ['Producto', 'Unidades', 'Monto estimado', '% de unidades'],
          rows,
        };
      }

      case 'categoria': {
        const lineas = await this.prisma.pedidoLinea.findMany({
          where: { es_cortesia: false, pedido: { ...where, estado: { notIn: ['RECHAZADO', 'ANULADO'] } } },
          include: { producto: { include: { categoria: true } } },
        });
        const cMap: Record<string, { q: number; sub: number }> = {};
        let totMonto = 0;
        for (const l of lineas) {
          const cat = l.producto?.categoria?.nombre || 'General';
          const q = Number(l.cantidad || 1);
          const sub = Number(l.subtotal || 0);
          cMap[cat] = cMap[cat] || { q: 0, sub: 0 };
          cMap[cat].q += q;
          cMap[cat].sub += sub;
          totMonto += sub;
        }
        const rows = Object.entries(cMap)
          .sort((a, b) => b[1].sub - a[1].sub)
          .map(([cat, data]) => [
            cat,
            data.q,
            this.soles(data.sub),
            totMonto > 0 ? `${Math.round((data.sub / totMonto) * 100)} %` : '0 %',
          ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Categorías con ventas', v: String(rows.length) },
            { n: 'Monto total', v: this.soles(totMonto) },
          ],
          cols: ['Categoría', 'Unidades', 'Monto estimado', '% del monto'],
          rows,
        };
      }

      case 'canal': {
        const pedidos = await this.prisma.pedido.findMany({
          where: { ...where, estado: { notIn: ['RECHAZADO', 'ANULADO'] } },
        });
        const cMap: Record<string, { pedidos: number; ventas: number }> = {};
        let totV = 0;
        for (const p of pedidos) {
          const c = p.canal || 'LOCAL';
          cMap[c] = cMap[c] || { pedidos: 0, ventas: 0 };
          cMap[c].pedidos += 1;
          cMap[c].ventas += Number(p.total || 0);
          totV += Number(p.total || 0);
        }
        const rows = Object.entries(cMap).map(([c, data]) => [
          c,
          data.pedidos,
          this.soles(data.ventas),
          this.soles(data.pedidos > 0 ? data.ventas / data.pedidos : 0),
          totV > 0 ? `${Math.round((data.ventas / totV) * 100)} %` : '0 %',
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Ventas', v: this.soles(totV) },
            { n: 'Pedidos', v: String(pedidos.length) },
          ],
          cols: ['Canal', 'Pedidos', 'Ventas', 'Ticket promedio', '% del total'],
          rows,
        };
      }

      case 'modalidad': {
        const pedidos = await this.prisma.pedido.findMany({
          where: { ...where, estado: { notIn: ['RECHAZADO', 'ANULADO'] } },
        });
        const mMap: Record<string, { pedidos: number; ventas: number }> = {};
        let totV = 0;
        for (const p of pedidos) {
          const m = p.modalidad || 'LOCAL';
          mMap[m] = mMap[m] || { pedidos: 0, ventas: 0 };
          mMap[m].pedidos += 1;
          mMap[m].ventas += Number(p.total || 0);
          totV += Number(p.total || 0);
        }
        const rows = Object.entries(mMap).map(([m, data]) => [
          m,
          data.pedidos,
          this.soles(data.ventas),
          this.soles(data.pedidos > 0 ? data.ventas / data.pedidos : 0),
          totV > 0 ? `${Math.round((data.ventas / totV) * 100)} %` : '0 %',
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Ventas', v: this.soles(totV) },
            { n: 'Pedidos', v: String(pedidos.length) },
          ],
          cols: ['Modalidad', 'Pedidos', 'Ventas', 'Ticket promedio', '% del total'],
          rows,
        };
      }

      case 'pago': {
        const cobroPagos = await this.prisma.cobroPago.findMany({
          where: { cobro: { anulado_en: null, pedido: where } },
        });
        const pMap: Record<string, { count: number; monto: number }> = {};
        let totP = 0;
        for (const cp of cobroPagos) {
          const m = cp.medio || 'EFECTIVO';
          pMap[m] = pMap[m] || { count: 0, monto: 0 };
          pMap[m].count += 1;
          pMap[m].monto += Number(cp.monto || 0);
          totP += Number(cp.monto || 0);
        }
        const rows = Object.entries(pMap).map(([m, data]) => [
          m,
          data.count,
          this.soles(data.monto),
          totP > 0 ? `${Math.round((data.monto / totP) * 100)} %` : '0 %',
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Total cobrado', v: this.soles(totP) },
            { n: 'Pagos registrados', v: String(cobroPagos.length) },
          ],
          cols: ['Medio de pago', 'Pagos', 'Ventas', '% de las ventas'],
          rows,
        };
      }

      case 'rechazados': {
        const rechazados = await this.prisma.pedido.findMany({
          where: { ...where, estado: { in: ['RECHAZADO', 'ANULADO'] } },
          orderBy: { creado_en: 'desc' },
        });
        const totRech = rechazados.reduce((acc, p) => acc + Number(p.total || 0), 0);
        const rows = rechazados.map((p) => [
          p.codigo || `CP-${p.id}`,
          p.cliente_nombre || 'Cliente',
          p.canal || 'Carta',
          this.soles(Number(p.total || 0)),
          p.motivo_anulacion || p.motivo_falla || p.nota || 'Anulado/Rechazado',
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Pedidos rechazados', v: String(rechazados.length) },
            { n: 'Monto no vendido', v: this.soles(totRech) },
          ],
          cols: ['Pedido', 'Cliente', 'Canal', 'Monto', 'Nota'],
          rows,
        };
      }

      case 'cierres': {
        const cierres = await this.prisma.cierreCaja.findMany({
          include: { caja: true },
        });
        const rows = cierres.map((c) => [
          `CIE-${c.caja_id}`,
          c.caja?.fecha ? new Date(c.caja.fecha).toLocaleDateString('es-PE') : '-',
          'Cajero',
          this.soles(Number(c.caja?.apertura || 0)),
          c.resultado || 'OK',
          c.nota || 'Sin observaciones',
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Cierres', v: String(cierres.length) },
            { n: 'Estado general', v: cierres.length > 0 ? 'Conforme' : 'Sin cierres' },
          ],
          cols: ['Cierre', 'Fecha', 'Cajero', 'Apertura', 'Resultado', 'Nota'],
          rows,
        };
      }

      case 'medios': {
        const cobroPagos = await this.prisma.cobroPago.findMany({
          where: { cobro: { anulado_en: null } },
          include: { cobro: true },
        });
        const fMap: Record<string, Record<string, number>> = {};
        for (const cp of cobroPagos) {
          const f = new Date(cp.cobro.en).toLocaleDateString('es-PE');
          fMap[f] = fMap[f] || {};
          const medio = cp.medio?.toUpperCase() || 'EFECTIVO';
          fMap[f][medio] = (fMap[f][medio] || 0) + Number(cp.monto || 0);
        }
        const rows = Object.entries(fMap).map(([f, mData]) => {
          const ef = mData['EFECTIVO'] || 0;
          const yap = mData['YAPE'] || 0;
          const pli = mData['PLIN'] || 0;
          const tr = mData['TRANSFERENCIA'] || 0;
          const tar = mData['TARJETA'] || 0;
          const tot = ef + yap + pli + tr + tar;
          return [f, this.soles(ef), this.soles(yap), this.soles(pli), this.soles(tr), this.soles(tar), this.soles(tot)];
        });
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Días con pagos', v: String(rows.length) },
            { n: 'Transacciones', v: String(cobroPagos.length) },
          ],
          cols: ['Fecha', 'Efectivo', 'Yape', 'Plin', 'Transferencia', 'Tarjeta', 'Total'],
          rows,
        };
      }

      case 'arqueo': {
        const diferencias = await this.prisma.cierreCaja.findMany({
          where: { resultado: { not: 'OK' } },
          include: { caja: true },
        });
        const rows = diferencias.map((c) => [
          c.caja?.fecha ? new Date(c.caja.fecha).toLocaleDateString('es-PE') : '-',
          'Cajero',
          this.soles(Number(c.caja?.apertura || 0)),
          c.resultado,
          c.nota || 'Sin nota de descargo',
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [{ n: 'Cierres con diferencia', v: String(diferencias.length) }],
          cols: ['Fecha', 'Cajero', 'Esperado', 'Resultado', 'Observación'],
          rows,
        };
      }

      case 'cobrar': {
        const pendientes = await this.prisma.pedido.findMany({
          where: { ...where, estado: { notIn: ['RECHAZADO', 'ANULADO', 'ENTREGADO'] }, cobros: { none: { anulado_en: null } } },
          orderBy: { creado_en: 'desc' },
        });
        const totPend = pendientes.reduce((acc, p) => acc + Number(p.total || 0), 0);
        const rows = pendientes.map((p) => [
          p.codigo || `CP-${p.id}`,
          p.cliente_nombre || 'Cliente',
          p.canal || 'Salón',
          p.pago_metodo || 'Pendiente',
          this.soles(Number(p.total || 0)),
          p.estado,
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Pedidos sin cobrar', v: String(pendientes.length) },
            { n: 'Monto por cobrar', v: this.soles(totPend) },
          ],
          cols: ['Pedido', 'Cliente', 'Canal', 'Método', 'Monto', 'Estado'],
          rows,
        };
      }

      case 'stockbajo': {
        const stocks = await this.prisma.stock.findMany({
          where: { insumo: { activo: true }, cantidad: { lt: 10 } },
          include: { insumo: true, lugar: true },
        });
        const rows = stocks.map((s) => [
          s.insumo?.nombre || 'Insumo',
          `${Number(s.cantidad)} ${s.insumo?.unidad_almacen || 'u.'}`,
          s.lugar?.nombre || 'Almacén',
          '10.0',
          `${Math.max(0, 10 - Number(s.cantidad)).toFixed(1)} ${s.insumo?.unidad_almacen || 'u.'}`,
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto: 'Al día de hoy',
          filtrosActivosTexto: 'Sin filtros de fecha',
          sinFecha: true,
          kpis: [
            { n: 'Insumos bajo el mínimo', v: String(stocks.length) },
            { n: 'Alerta', v: stocks.length > 0 ? 'Reposición requerida' : 'Stock óptimo' },
          ],
          cols: ['Insumo', 'En inventario', 'Ubicación', 'Mínimo', 'Falta para el mínimo'],
          rows,
        };
      }

      case 'kardex': {
        const movs = await this.prisma.movimientoStock.findMany({
          include: { insumo: true, lugar: true },
          orderBy: { en: 'desc' },
          take: 50,
        });
        const rows = movs.map((m) => [
          new Date(m.en).toLocaleDateString('es-PE'),
          m.tipo,
          m.insumo?.nombre || 'Insumo',
          `${Number(m.cantidad)} ${m.insumo?.unidad_almacen || 'u.'}`,
          m.lugar?.nombre || 'Almacén',
          m.nota || '-',
          `MOV-${m.id}`,
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Movimientos mostrados', v: String(rows.length) },
            { n: 'Entradas', v: String(movs.filter((m) => m.tipo === 'ENTRADA').length) },
            { n: 'Salidas', v: String(movs.filter((m) => m.tipo === 'SALIDA').length) },
          ],
          cols: ['Fecha', 'Tipo', 'Insumo', 'Cantidad', 'Ubicación', 'Nota', 'Código'],
          rows,
        };
      }

      case 'mermas': {
        const mermas = await this.prisma.movimientoStock.findMany({
          where: { tipo: 'MERMA' },
          include: { insumo: true, lugar: true, producto: { select: { nombre: true } }, sabor: { select: { nombre: true } } },
          orderBy: { en: 'desc' },
        });
        // Incluye las mermas de productos terminados que salen de Apertura del día (con su motivo en la nota)
        const rows = mermas.map((m) => [
          new Date(m.en).toLocaleDateString('es-PE'),
          m.insumo?.nombre || (m.producto ? `${m.producto.nombre}${m.sabor ? ` · ${m.sabor.nombre}` : ''}` : 'Insumo'),
          `${Number(m.cantidad)} ${m.insumo?.unidad_almacen || 'u.'}`,
          m.lugar?.nombre || 'Salados',
          m.nota || 'Desecho de producción',
          `MER-${m.id}`,
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Registros de merma', v: String(mermas.length) },
            { n: 'Ítems afectados', v: String(new Set(mermas.map((m) => `${m.insumo_id ?? ''}/${m.producto_id ?? ''}/${m.sabor_id ?? ''}`)).size) },
          ],
          cols: ['Fecha', 'Insumo o producto', 'Cantidad', 'Origen', 'Motivo', 'Código'],
          rows,
        };
      }

      case 'produccion': {
        const producciones = await this.prisma.produccion.findMany({
          include: { receta: { include: { producto: true } } },
          orderBy: { producido_en: 'desc' },
        });
        const rows = producciones.map((p) => [
          new Date(p.producido_en).toLocaleDateString('es-PE'),
          'Producción',
          p.receta?.producto?.nombre || 'Receta',
          `${Number(p.unidades)} unidades`,
          'Área de producción',
          'Almacén central',
          `PRD-${p.id}`,
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Movimientos de producción', v: String(producciones.length) },
            { n: 'Lotes producidos', v: String(producciones.reduce((a, b) => a + Number(b.tandas || 1), 0)) },
          ],
          cols: ['Fecha', 'Tipo', 'Insumo / producto', 'Cantidad', 'Origen', 'Destino', 'Código'],
          rows,
        };
      }

      case 'proveedor': {
        const compras = await this.prisma.compra.findMany({
          include: { proveedor: { include: { organizacion: true, persona: true } } },
        });
        const provMap: Record<string, { compras: number; total: number; pendiente: number }> = {};
        for (const c of compras) {
          const nombre =
            c.proveedor?.organizacion?.nombre_comercial ||
            c.proveedor?.organizacion?.razon_social ||
            (c.proveedor?.persona ? `${c.proveedor.persona.nombres} ${c.proveedor.persona.apellidos || ''}`.trim() : null) ||
            `Proveedor #${c.proveedor_party_id}`;
          provMap[nombre] = provMap[nombre] || { compras: 0, total: 0, pendiente: 0 };
          provMap[nombre].compras += 1;
          const tot = Number(c.total || 0);
          provMap[nombre].total += tot;
          if (!c.pagada_en && !c.anulada_en) {
            provMap[nombre].pendiente += tot;
          }
        }
        const rows = Object.entries(provMap).map(([prov, data]) => [
          prov,
          data.compras,
          this.soles(data.total),
          this.soles(data.pendiente),
        ]);
        const totComprado = compras.reduce((acc, c) => acc + Number(c.total || 0), 0);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Proveedores', v: String(rows.length) },
            { n: 'Total comprado', v: this.soles(totComprado) },
          ],
          cols: ['Proveedor', 'Compras', 'Total', 'Pendiente de recibir'],
          rows,
        };
      }

      case 'comprasestado': {
        const compras = await this.prisma.compra.findMany({
          orderBy: { fecha_compra: 'desc' },
        });
        const estMap: Record<string, { count: number; monto: number }> = {};
        for (const c of compras) {
          const estado = c.anulada_en ? 'Anulada' : c.pagada_en ? 'Recibida' : 'Pendiente';
          const k = `${estado} · ${c.condicion}`;
          estMap[k] = estMap[k] || { count: 0, monto: 0 };
          estMap[k].count += 1;
          estMap[k].monto += Number(c.total || 0);
        }
        const rows = Object.entries(estMap).map(([k, data]) => {
          const [estado, condicion] = k.split(' · ');
          return [estado, condicion, String(data.count), this.soles(data.monto)];
        });
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Compras registradas', v: String(compras.length) },
            { n: 'Anuladas', v: String(compras.filter((c) => c.anulada_en).length) },
          ],
          cols: ['Estado', 'Pago', 'Compras', 'Monto'],
          rows,
        };
      }

      case 'topclientes': {
        const cuentas = await this.prisma.customerAccount.findMany({
          include: {
            party: {
              include: {
                persona: true,
                pedidos: true,
                roles: { include: { customer_detail: true } },
              },
            },
          },
        });
        const rows = cuentas
          .map((c) => {
            const persona = c.party?.persona;
            const nombre = persona ? `${persona.nombres} ${persona.apellidos || ''}`.trim() : `Cliente #${c.party_id}`;
            const pedidosCount = c.party?.pedidos?.length || 0;
            const puntos = Number(c.party?.roles?.[0]?.customer_detail?.puntos || 0);
            return [nombre, 'Cliente frecuente', String(pedidosCount), String(puntos)];
          })
          .sort((a, b) => Number(b[2]) - Number(a[2]));

        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto: 'Histórico acumulado',
          filtrosActivosTexto: 'Sin filtros de fecha',
          sinFecha: true,
          kpis: [
            { n: 'Clientes con cuenta', v: String(cuentas.length) },
            { n: 'Pedidos en total', v: String(rows.reduce((acc, r) => acc + Number(r[2]), 0)) },
          ],
          cols: ['Cliente', 'Tipo', 'Pedidos', 'Puntos'],
          rows,
        };
      }

      case 'cumple': {
        const cumpleaneros = await this.prisma.person.findMany({
          where: { cumple_dia: { not: null }, cumple_mes: { not: null } },
          include: {
            party: {
              include: {
                contactos: { where: { activo: true } },
              },
            },
          },
        });

        const hoy = new Date();
        const diaHoy = hoy.getDate();
        const mesHoy = hoy.getMonth() + 1;

        const rows = cumpleaneros.map((p) => {
          const nombre = `${p.nombres} ${p.apellidos || ''}`.trim();
          const dC = p.cumple_dia!;
          const mC = p.cumple_mes!;
          let diasFaltan = (mC - mesHoy) * 30 + (dC - diaHoy);
          if (diasFaltan < 0) diasFaltan += 365;

          const tel = p.party?.contactos?.find((cm) => cm.tipo === 'TELEFONO')?.valor || '-';
          const cor = p.correo || p.party?.contactos?.find((cm) => cm.tipo === 'CORREO')?.valor || '-';

          return [nombre, `${String(dC).padStart(2, '0')}/${String(mC).padStart(2, '0')}`, `${diasFaltan} días`, tel, cor];
        });

        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto: 'Próximos 30 días',
          filtrosActivosTexto: 'Sin filtros de fecha',
          sinFecha: true,
          kpis: [
            { n: 'Con cumpleaños registrado', v: String(cumpleaneros.length) },
            { n: 'En los próximos 30 días', v: String(rows.filter((r) => parseInt(String(r[2]), 10) <= 30).length) },
          ],
          cols: ['Cliente', 'Cumpleaños', 'Faltan', 'Teléfono', 'Correo'],
          rows,
          nota: 'Solo aparecen los clientes que dejaron su cumpleaños con su visto bueno.',
        };
      }

      case 'creditos': {
        const consumos = await this.prisma.consumoPersonal.findMany({
          include: { party: { include: { persona: true } } },
          orderBy: { fecha: 'desc' },
        });
        const trabMap: Record<string, { total: number; count: number }> = {};
        for (const c of consumos) {
          const persona = c.party?.persona;
          const nombre = persona ? `${persona.nombres} ${persona.apellidos || ''}`.trim() : `Trabajador #${c.party_id}`;
          trabMap[nombre] = trabMap[nombre] || { total: 0, count: 0 };
          trabMap[nombre].total += Number(c.monto || 0);
          trabMap[nombre].count += 1;
        }
        const rows = Object.entries(trabMap).map(([t, data]) => [
          t,
          String(data.count),
          this.soles(data.total),
          this.soles(data.total),
        ]);
        const totConsumo = consumos.reduce((acc, c) => acc + Number(c.monto || 0), 0);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Trabajadores con consumo', v: String(rows.length) },
            { n: 'Total acumulado', v: this.soles(totConsumo) },
          ],
          cols: ['Trabajador', 'Consumos', 'Mes actual', 'Total'],
          rows,
          nota: 'El descuento del pago se hace fuera del sistema.',
        };
      }

      case 'repartidor': {
        const pedidos = await this.prisma.pedido.findMany({
          where: {
            ...where,
            OR: [{ canal: 'CARTA' }, { modalidad: 'DELIVERY' }],
          },
          include: { cobros: true },
        });
        const repMap: Record<string, { count: number; monto: number; cobrados: number }> = {};
        for (const p of pedidos) {
          const repNombre = p.repartidor_party_id ? `Repartidor #${p.repartidor_party_id}` : 'Sin asignar';
          repMap[repNombre] = repMap[repNombre] || { count: 0, monto: 0, cobrados: 0 };
          repMap[repNombre].count += 1;
          repMap[repNombre].monto += Number(p.total || 0);
          if (cobroVigente(p.cobros)) repMap[repNombre].cobrados += 1;
        }
        const rows = Object.entries(repMap).map(([r, data]) => [
          r,
          String(data.count),
          this.soles(data.monto),
          String(data.cobrados),
        ]);
        const totMonto = pedidos.reduce((acc, p) => acc + Number(p.total || 0), 0);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Pedidos delivery', v: String(pedidos.length) },
            { n: 'Monto total', v: this.soles(totMonto) },
            { n: 'Sin repartidor', v: String(repMap['Sin asignar']?.count || 0) },
          ],
          cols: ['Repartidor', 'Pedidos', 'Monto', 'Ya cobrados'],
          rows,
        };
      }

      case 'zonas': {
        const pedidos = await this.prisma.pedido.findMany({
          where: {
            ...where,
            OR: [{ canal: 'CARTA' }, { modalidad: 'DELIVERY' }],
          },
          include: { zona: true },
        });
        const zMap: Record<string, { count: number; monto: number }> = {};
        for (const p of pedidos) {
          const zNom = p.zona?.codigo ? `Zona ${p.zona.codigo}` : 'Sin zona';
          zMap[zNom] = zMap[zNom] || { count: 0, monto: 0 };
          zMap[zNom].count += 1;
          zMap[zNom].monto += Number(p.total || 0);
        }
        const rows = Object.entries(zMap).map(([zNom, data]) => [
          zNom,
          String(data.count),
          this.soles(data.monto),
          this.soles(data.count > 0 ? data.monto / data.count : 0),
        ]);
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [
            { n: 'Zonas con pedidos', v: String(rows.length) },
            { n: 'Pedidos delivery', v: String(pedidos.length) },
          ],
          cols: ['Zona', 'Pedidos', 'Monto', 'Ticket promedio'],
          rows,
        };
      }

      default:
        return {
          id: d.id,
          nombre: d.n,
          categoria: d.cat,
          queResponde: d.que,
          periodoTexto,
          filtrosActivosTexto,
          kpis: [],
          cols: ['Columna 1', 'Columna 2'],
          rows: [],
        };
    }
  }

  /**
   * Metas, más vendidos por categoría y promociones para «Indicadores»
   * Todo calculado con datos reales de la base de datos.
   */
  async obtenerIndicadores(): Promise<IndicadoresData> {
    // 1. Cálculo real de entrega promedio
    const pedidosEntregados = await this.prisma.pedido.findMany({
      where: {
        confirmado_en: { not: null },
        OR: [{ entregado_en: { not: null } }, { despachado_en: { not: null } }],
        estado: { notIn: ['RECHAZADO', 'ANULADO'] },
      },
      select: { confirmado_en: true, entregado_en: true, despachado_en: true },
    });
    const tiempos = pedidosEntregados.map((p) => {
      const fin = (p.entregado_en || p.despachado_en)!.getTime();
      const inicio = p.confirmado_en!.getTime();
      return Math.max(1, Math.round((fin - inicio) / 60000));
    });
    const promEntrega = tiempos.length > 0 ? Math.round(tiempos.reduce((a, b) => a + b, 0) / tiempos.length) : 0;
    const entregaOk = promEntrega > 0 && promEntrega <= 13;

    // 2. Ventas de productos agotados
    const lineasAgotadas = await this.prisma.pedidoLinea.count({
      where: { producto: { agotado_hasta: { not: null } } },
    });

    // 3. Platos con receta y margen visible
    const totalProductos = await this.prisma.producto.count({ where: { oculto: false } });
    const conReceta = await this.prisma.receta.count();

    // 4. Reclamos de delivery y pedidos por canal
    const reclamosCount = await this.prisma.reclamo.count();
    const totalPedidosValidos = await this.prisma.pedido.count({
      where: { estado: { notIn: ['RECHAZADO', 'ANULADO'] } },
    });
    const pedidosDigitales = await this.prisma.pedido.count({
      where: {
        canal: { in: ['CARTA', 'WHATSAPP', 'WEB'] },
        estado: { notIn: ['RECHAZADO', 'ANULADO'] },
      },
    });
    const pctDigital = totalPedidosValidos > 0 ? Math.round((pedidosDigitales / totalPedidosValidos) * 100) : 0;

    // 5. Rotación de mesas
    const totalMesas = await this.prisma.elementoPlano.count({ where: { tipo: 'MESA', activo: true } });
    const pedidosSalon = await this.prisma.pedido.count({
      where: { modalidad: 'LOCAL', estado: { notIn: ['RECHAZADO', 'ANULADO'] } },
    });
    const rotacionMesas = totalMesas > 0 ? (pedidosSalon / totalMesas).toFixed(1) : '0';

    const metas = [
      {
        n: 'Tiempo de entrega',
        meta: 'Meta: 13 min como máximo',
        v: promEntrega > 0 ? `${promEntrega} min` : 'Sin datos',
        w: promEntrega > 0 ? `${Math.min(100, Math.round((promEntrega / 16) * 100))}%` : '0%',
        bar: entregaOk ? 'var(--cp-soft)' : 'var(--cp-rust)',
        ok: entregaOk,
      },
      {
        n: 'Ventas de productos agotados',
        meta: 'Meta: cero',
        v: `${lineasAgotadas} registradas`,
        w: lineasAgotadas === 0 ? '100%' : '20%',
        bar: lineasAgotadas === 0 ? 'var(--cp-soft)' : 'var(--cp-rust)',
        ok: lineasAgotadas === 0,
      },
      {
        n: 'Platos con margen visible',
        meta: 'Meta: todos los platos con receta',
        v: `${conReceta} de ${totalProductos}`,
        w: totalProductos > 0 ? `${Math.round((conReceta / totalProductos) * 100)}%` : '0%',
        bar: conReceta === totalProductos && totalProductos > 0 ? 'var(--cp-soft)' : 'var(--cp-rust)',
        ok: conReceta === totalProductos && totalProductos > 0,
      },
      {
        n: 'Pedidos por carta o chatbot sin reingreso',
        meta: 'Meta: por definir con el cliente',
        v: `${pctDigital}%`,
        w: `${pctDigital}%`,
        bar: 'var(--cp-soft)',
        ok: true,
      },
      {
        n: 'Rotación de mesas',
        meta: 'Mesas atendidas por turno',
        v: rotacionMesas,
        w: `${Math.min(100, Math.round(Number(rotacionMesas) * 20))}%`,
        bar: 'var(--cp-soft)',
        ok: true,
      },
      {
        n: 'Reclamos de delivery',
        meta: 'Meta: menos de 2 por semana',
        v: String(reclamosCount),
        w: reclamosCount <= 2 ? '30%' : '80%',
        bar: reclamosCount <= 2 ? 'var(--cp-soft)' : 'var(--cp-rust)',
        ok: reclamosCount <= 2,
      },
    ];

    // Ranking actual por categoría y producto (desde líneas de pedidos no anulados)
    const lineas = await this.prisma.pedidoLinea.findMany({
      where: { es_cortesia: false, pedido: { estado: { notIn: ['RECHAZADO', 'ANULADO'] } } },
      include: { producto: { include: { categoria: true } } },
    });

    const catProdMap: Record<string, Record<string, number>> = {};
    for (const l of lineas) {
      const cat = l.producto?.categoria?.nombre || 'General';
      const prod = l.nombre || l.producto?.nombre || 'Producto';
      const q = Number(l.cantidad || 1);
      catProdMap[cat] = catProdMap[cat] || {};
      catProdMap[cat][prod] = (catProdMap[cat][prod] || 0) + q;
    }

    const topActual = Object.entries(catProdMap).map(([categoria, prodCounts]) => {
      const topProd = Object.entries(prodCounts).sort((a, b) => b[1] - a[1])[0];
      const maxUnidades = Math.max(...Object.values(prodCounts), 1);
      return {
        categoria,
        producto: topProd ? topProd[0] : '-',
        unidades: topProd ? topProd[1] : 0,
        estrellas: '★',
        porcentaje: topProd ? `${Math.round((topProd[1] / maxUnidades) * 100)}%` : '0%',
      };
    });

    // Historial de ranking desde RankingMes si existe en la BD
    const rankingHist = await this.prisma.rankingMes.findMany({
      include: { producto: true },
      orderBy: [{ anio_mes: 'desc' }, { puesto: 'asc' }],
      take: 10,
    });
    const histMap: Record<string, string[]> = {};
    for (const r of rankingHist) {
      histMap[r.anio_mes] = histMap[r.anio_mes] || [];
      if (r.producto?.nombre) {
        histMap[r.anio_mes].push(`${r.puesto || '-'}. ${r.producto.nombre}`);
      }
    }
    const topHistorial = Object.entries(histMap).map(([mes, top]) => ({
      mes,
      top,
    }));

    // 7. Promociones vendidas
    const combosVendidos = await this.prisma.pedidoLinea.findMany({
      where: {
        OR: [{ oferta_id: { not: null } }, { linea_combo_id: { not: null } }],
        pedido: { estado: { notIn: ['RECHAZADO', 'ANULADO'] } },
      },
      take: 10,
    });
    const promoMap: Record<string, number> = {};
    for (const cv of combosVendidos) {
      const nom = cv.nombre;
      promoMap[nom] = (promoMap[nom] || 0) + Number(cv.cantidad || 1);
    }
    const promocionesVendidas = Object.entries(promoMap).map(([nombre, unidades]) => ({
      nombre,
      unidades: `${unidades} unidades`,
      desc: 'Combo o promoción aplicada en venta',
    }));

    // 8. Productos con descuento aplicado
    const productosDescontados: { nombre: string; unidades: string }[] = [];

    return {
      metas,
      topActual,
      topHistorial,
      promocionesVendidas,
      productosDescontados,
    };
  }

  /**
   * Datos para el «Mapa de entregas» (calor, zonas de reparto y radios desde la tienda)
   * Extrae los puntos de coordenadas reales de los pedidos delivery en la base de datos.
   */
  async obtenerMapaEntregas(filtro: FiltroMapaDto & { periodo?: string }): Promise<MapaEntregasData> {
    const where: any = {
      OR: [{ canal: 'CARTA' }, { modalidad: 'DELIVERY' }],
      entrega_lat: { not: null },
      entrega_lng: { not: null },
    };
    const dias = Number(filtro.periodo && filtro.periodo !== 'todo' ? filtro.periodo : filtro.dias);
    if (dias > 0) where.creado_en = { gte: new Date(Date.now() - dias * 86400000) };
    // Valores del CHECK ck_pedido_canal: el bot guarda BOT o WHATSAPP; el call center es TELEFONO
    const canalBd: Record<string, string[]> = { Web: ['CARTA'], WhatsApp: ['WHATSAPP', 'BOT'], 'Call center': ['TELEFONO'] };
    if (filtro.canal && canalBd[filtro.canal]) where.canal = { in: canalBd[filtro.canal] };

    const [pedidosDelivery, zonasBd, parametroLocal] = await Promise.all([
      this.prisma.pedido.findMany({ where, include: { zona: true } }),
      this.prisma.zonaReparto.findMany({ where: { activa: true }, orderBy: { codigo: 'asc' } }),
      this.prisma.parametro?.findUnique({ where: { clave: 'local_datos' } }),
    ]);

    // Sede real: la misma que usa la carta (parametro local_datos); si falta, la de Caprichos Campoy
    const datosLocal: any = parametroLocal?.valor ?? {};
    const sede = {
      lat: typeof datosLocal.lat === 'number' ? datosLocal.lat : COORDENADAS_LOCAL_DEFAULT.lat,
      lng: typeof datosLocal.lng === 'number' ? datosLocal.lng : COORDENADAS_LOCAL_DEFAULT.lng,
      nombre: datosLocal.nombre || DATOS_LOCAL_DEFAULT.nombre,
    };

    const puntos: PuntoEntregaMapa[] = pedidosDelivery.map((p) => {
      const lat = Number(p.entrega_lat);
      const lng = Number(p.entrega_lng);
      const enZona = !!p.zona_id;
      return {
        lat,
        lng,
        canal: p.canal || 'Carta',
        total: Number(p.total || 0),
        enZona,
        zona: p.zona?.codigo,
      };
    });

    const inZona = puntos.filter((p) => p.enZona);
    const outZona = puntos.filter((p) => !p.enZona);
    const totVentas = inZona.reduce((acc, p) => acc + p.total, 0);

    const kpis: KpiItem[] = [
      { n: 'Pedidos con entrega', v: String(inZona.length) },
      { n: 'Ventas', v: this.soles(totVentas) },
      { n: 'Ticket promedio', v: this.soles(inZona.length ? totVentas / inZona.length : 0) },
      { n: 'Intentos fuera de cobertura', v: String(outZona.length) },
    ];

    const zonas: ZonaVentasFila[] = zonasBd.map((z) => {
      const pedidosDeZona = inZona.filter((p) => p.zona === z.codigo);
      const cant = pedidosDeZona.length;
      const ventas = pedidosDeZona.reduce((acc, p) => acc + p.total, 0);
      const pct = totVentas > 0 ? Math.round((ventas / totVentas) * 100) : 0;
      return {
        zona: z.codigo,
        nombre: `Zona ${z.codigo}`,
        // El color lo asigna el front con la misma paleta de Configuración (orden por código)
        color: '',
        poligono: Array.isArray(z.poligono) ? (z.poligono as unknown as [number, number][]) : [],
        pedidos: cant,
        ventas: this.soles(ventas),
        porcentaje: `${pct} %`,
        barraAncho: `${pct}%`,
      };
    });

    // Anillos desde la sede (distancia aproximada en km)
    const tramos = [0.5, 1, 2, 3];
    const conteo = tramos.map(() => 0);
    for (const p of inZona) {
      const dKm = Math.hypot((p.lat - sede.lat) * 111, (p.lng - sede.lng) * 111 * Math.cos((sede.lat * Math.PI) / 180));
      const i = tramos.findIndex((t) => dKm <= t);
      if (i >= 0) conteo[i]++;
      else conteo[tramos.length - 1]++;
    }
    const etiquetaKm = (km: number) => (km < 1 ? `${km * 1000} m` : `${km} km`);
    const radios: RadioDistanciaFila[] = tramos.map((t, i) => ({
      rango: `${i === 0 ? '0' : etiquetaKm(tramos[i - 1])} a ${etiquetaKm(t)}`,
      etiqueta: etiquetaKm(t),
      metros: t * 1000,
      pedidos: conteo[i],
    }));

    return {
      sede,
      puntos,
      kpis,
      zonas,
      radios,
      fueraCoberturaTexto:
        outZona.length > 0
          ? `${outZona.length} pedidos se intentaron desde fuera de la zona de reparto (puntos azules). Si se repite en una zona, conviene ampliar el reparto.`
          : 'No se registran intentos fuera de la zona de reparto en el período.',
      fueraCoberturaConteo: outZona.length,
    };
  }
}
