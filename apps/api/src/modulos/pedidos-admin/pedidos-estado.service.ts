import { CANALES_CON_ATENDIDO, nombresDePersonas } from './linea-tiempo.service';
import { totalSegDePedido } from './linea-tiempo.util';
import { cargarAuditoriaPedido } from './auditoria-pedido';
import { explicarPedidosPorId } from '../clientes/explicar-puntos-pedidos';
import { exigirDeliveryUbicado, DELIVERY_SIN_UBICACION_WHERE } from '../pedidos/delivery-ubicacion.util';
import { PuntosService } from '../clientes/puntos.service';
import { MEDIOS_DIGITALES_PLAN, mediosDigitalesDelPedido, montoDigitalDePlan } from '../pedidos/pago-plan.service';
import { totalCobrable } from '../propinas/propinas.util';
import { Prisma } from '@prisma/client';
import { progresoDelPedido, unidadesDeProgreso } from '../pedidos/progreso-pedido';
import { tiemposPreparacion } from '../cocina/tiempo-preparacion';
import { CONFIG_ETA_DEFECTO, leerConfigEta } from '../repartos/eta-entrega';
import { cerrarRutaTrasAnular } from '../repartos/rutas-reparto';
import { FILTRO_CANCELADO_NO_RECIBIR, PAGOS_DEVOLVIBLES, nombresDePartes, salidaDevolucion } from './devolucion-pedido.util';
import { StockService } from '../stock/stock.service';
import { CobrosService } from '../caja/cobros.service';
import { ImpresionService } from '../impresion/impresion.service';
import { SalonService } from '../salon/salon.service';
import { ComandasService, exigirCocinaDespejada } from '../cocina';
import { exigirCobroAntesDeEntregar } from '../pedidos';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { esSoloMozo, puedeAnularPedido, rolesDelUsuario } from '../acceso/roles-usuario';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { esPedidoLocalSinCaptura, exigirComprobanteDigital, mediosQueExigenCodigo, voucherCubreMedio } from '../caja/comprobante-pago.util';
import { puedeCambiarVoucher, puedeSubirVoucher } from '../vouchers/regla-cambio-voucher';
import { MEDIOS_CON_VOUCHER_CAJA } from '../vouchers/vouchers.service';
import { aCentimos, enPesos, exigirCajaAbiertaHoy } from '../caja/caja.calculo';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { enmascararDni } from '../usuarios/usuarios.util';
import { SELECT_PRUEBA_INCIDENTE, construirPruebaEntrega } from '../repartos/prueba-entrega';
import { INCLUIR_EXTRAS, resumenExtras } from './extras-pedido.util';

/** Lo que trae cada pedido de la lista de Caja (también los «relacionados» de una cuenta). */
const INCLUIR_LISTA = {
  lineas: { include: { opcionesElegidas: true, sabores: true, area: true } },
  zona: true,
  cobros: { where: { anulado_en: null }, select: { id: true, en: true, cobrado_por: true, pagos: { select: { medio: true } } }, take: 1 },
  ...INCLUIR_EXTRAS,
};
/** Tope de «todas» en la lista: una jornada normal cabe sobrada. */
export const LIMITE_TODAS = 2000;
import { FiltrarPedidosDto } from './dto/filtrar-pedidos.dto';
import { FiltrosMisPedidos, RangoMisPedidos } from './dto/mis-pedidos-query.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import { AvisosPedidoService } from '../chatbot/servicios/avisos-pedido.service';
import {
  ESTADO_REPROG,
  MOTIVO_RETIRO,
  NUMERO_PREGUNTA_REPROG,
} from '../chatbot/servicios/reprogramacion.service';
import {
  calcularSiguienteMedianocheLima,
  inicioDiaLimaDeFecha,
  obtenerInicioDiaLima,
  sumarDiasFechaIso,
} from '../cocina/cocina.util';
import { ConsumoRecetaService } from '../almacen';
import { lineasDeCuenta } from '../pedidos/lineas-combo.util';
import { ajustesPendientesUbicacion } from './cambio-ubicacion.util';

export type ColorEspera = 'verde' | 'naranja' | 'rojo';

/** Estados en curso que el filtro «Pendientes anteriores» de Caja rescata de días previos. */
const ESTADOS_EN_CURSO_PENDIENTES = ['COLA', 'NUEVO', 'PREPARANDO', 'PREP', 'LISTO', 'EN_CAMINO', 'RUTA'];
/** Fecha sola YYYY-MM-DD (día de Lima). */
const ES_FECHA_SOLA = /^\d{4}-\d{2}-\d{2}$/;

/** Estados todavía no entregados ni anulados (para el resumen de "Mis pedidos"). */
const ESTADOS_EN_CURSO = ['COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO'];

/** Estado de la pregunta de reprogramar (mensaje_reparto etapa 5), en la forma que ve el admin. */
const PREGUNTA_REPROG_VISTA: Record<string, string> = {
  [ESTADO_REPROG.ENVIADO]: 'ESPERANDO',
  [ESTADO_REPROG.REPROGRAMAR]: 'SI',
  [ESTADO_REPROG.NO_REPROGRAMAR]: 'NO',
  [ESTADO_REPROG.SIN_RESPUESTA]: 'SIN_RESPUESTA',
  [ESTADO_REPROG.TOPE_ALCANZADO]: 'TOPE',
};

export const METODOS_PAGO_PERMITIDOS = [
  'EFECTIVO',
  'YAPE',
  'PLIN',
  'TARJETA',
  'TRANSFERENCIA',
] as const;

export interface CobroMozoVista {
  en: Date;
  medio: string;
  mozo: string | null;
  faltaVoucher: boolean;
  /** Mozo confirmó que el cliente ya pagó (Yape/Plin/transferencia) sin captura: Caja no exige voucher. */
  sinCaptura: boolean;
  /** Efectivo que el mozo recibió (Pagó con S/); null si no hubo efectivo o no lo escribió. */
  recibido: number | null;
  vuelto: number | null;
  /** Comprobante que pidió el mozo; null si es nota de venta. */
  pide: 'BOLETA' | 'FACTURA' | null;
}

@Injectable()
export class PedidosEstadoService {
  private readonly logger = new Logger(PedidosEstadoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
    @Optional() private readonly salonService?: SalonService,
    @Optional() private readonly puntosService?: PuntosService,
    @Optional() private readonly stockService?: StockService,
    @Optional() private readonly impresionService?: ImpresionService,
    @Optional() private readonly avisos?: AvisosPedidoService,
    @Optional() private readonly cobros?: CobrosService,
    @Optional() private readonly comandas?: ComandasService,
    @Optional() private readonly consumoAlmacen?: ConsumoRecetaService,
  ) {}

  /**
   * Devuelve puntos y stock de un pedido anulado. Ambas operaciones son idempotentes (no devuelven dos veces).
   * Cada una se reintenta 1 vez; si sigue fallando NO rompe la anulación: queda un log de error, una fila de
   * auditoría y un aviso a Caja para que se revise a mano.
   */
  async devolverAlAnular(pedidoId: bigint, codigo: string | null | undefined, partyId?: bigint, ip?: string) {
    const pasos: Array<[string, () => Promise<unknown> | undefined]> = [
      ['los puntos', () => this.puntosService?.reversarPorPedido(pedidoId)],
      ['el stock', () => this.stockService?.revertirPorPedido(pedidoId, undefined, partyId)],
    ];
    for (const [que, paso] of pasos) {
      let error: unknown;
      for (let intento = 0; intento < 2; intento++) {
        try {
          await paso();
          error = undefined;
          break;
        } catch (e) {
          error = e;
        }
      }
      if (error === undefined) continue;

      const detalle = error instanceof Error ? error.message : String(error);
      const mensaje = `Anulado, pero no se pudo devolver ${que} del pedido ${codigo ?? pedidoId}: revisa.`;
      this.logger.error(
        JSON.stringify({ evento: 'ANULACION_DEVOLUCION_FALLIDA', pedidoId: pedidoId.toString(), pendiente: que, detalle }),
      );
      try {
        await this.auditoria.registrar({
          categoria: 'CAMBIO',
          modulo: 'pedidos',
          accion: 'ANULAR_DEVOLUCION_FALLIDA',
          resultado: 'RECHAZADO',
          entidad: 'pedido',
          entidadId: pedidoId,
          despues: { pendiente: que, detalle },
          partyId,
          ip,
        });
      } catch (e) {
        this.logger.error(`No se pudo auditar la devolución fallida del pedido ${pedidoId}: ${String(e)}`);
      }
      try {
        await this.prisma.notificacion.create({
          data: { tipo: 'ANULACION_SIN_DEVOLUCION', rol_destino: 'CAJERO', titulo: 'Revisa una anulación', mensaje, enlace: '/admin/caja' },
        });
      } catch (e) {
        this.logger.error(`No se pudo avisar a Caja de la devolución fallida del pedido ${pedidoId}: ${String(e)}`);
      }
    }
  }

  private parsearId(id: bigint | string | number): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'El identificador del pedido no es válido',
      });
    }
  }

  /**
   * Obtiene los umbrales configurados para alertas de espera en cocina y reparto (DT-69).
   */
  async obtenerUmbrales(): Promise<{ naranjaMin: number; rojoMin: number }> {
    let naranjaMin = 35;
    let rojoMin = 50;

    try {
      const params = await this.prisma.parametro.findMany({
        where: {
          clave: { in: ['rep_naranja_min', 'rep_rojo_min'] },
        },
      });

      for (const p of params) {
        if (p.clave === 'rep_naranja_min' && p.valor !== null && p.valor !== undefined) {
          const val = typeof p.valor === 'number' ? p.valor : Number(p.valor);
          if (!isNaN(val) && val >= 0) naranjaMin = val;
        }
        if (p.clave === 'rep_rojo_min' && p.valor !== null && p.valor !== undefined) {
          const val = typeof p.valor === 'number' ? p.valor : Number(p.valor);
          if (!isNaN(val) && val >= 0) rojoMin = val;
        }
      }
    } catch {
      // Usar valores por defecto (35 y 50) si falla la consulta
    }

    return { naranjaMin, rojoMin };
  }

  /**
   * Calcula los minutos transcurridos y el color de espera según umbrales de Kevin (DT-69).
   */
  calcularMinutosYColor(
    creadoEn: Date,
    ahora: Date = new Date(),
    naranjaMin = 35,
    rojoMin = 50,
  ): { minutosEspera: number; color: ColorEspera; colorEspera: ColorEspera } {
    const diffMs = ahora.getTime() - new Date(creadoEn).getTime();
    const minutosEspera = Math.max(0, Math.floor(diffMs / 60000));

    let color: ColorEspera = 'verde';
    if (minutosEspera >= rojoMin) {
      color = 'rojo';
    } else if (minutosEspera >= naranjaMin) {
      color = 'naranja';
    }

    return { minutosEspera, color, colorEspera: color };
  }

  /**
   * Lista los pedidos con filtros, paginación, cálculo de espera y enmascaramiento de comprobante (DT-69, DT-75).
   */
  async listar(filtros: FiltrarPedidosDto, usuarioActual?: UsuarioAutenticado) {
    const where: any = {};

    if (filtros.estado) {
      // Uno o varios estados separados por coma
      const estados = filtros.estado.split(',').map((e) => e.trim()).filter(Boolean);
      where.estado = estados.length > 1 ? { in: estados } : estados[0];
    }
    if (filtros.canal) {
      where.canal = filtros.canal;
    }
    if (filtros.modalidad) {
      where.modalidad = filtros.modalidad;
    }
    if (filtros.pendientes === '1') {
      // Días anteriores (hoy en Lima excluido) que siguen en curso o con pago pendiente
      where.creado_en = { lt: obtenerInicioDiaLima() };
      where.estado = { notIn: ['ANULADO', 'RECHAZADO'] };
      where.AND = [
        {
          OR: [
            { estado: { in: ESTADOS_EN_CURSO_PENDIENTES } },
            { pago_estado: { in: ['PENDIENTE', 'COORDINADO'] } },
          ],
        },
      ];
    } else if (filtros.desde || filtros.hasta) {
      // Fechas YYYY-MM-DD = día calendario de Lima, hasta inclusivo; con hora se usa tal cual
      where.creado_en = {};
      if (filtros.desde) {
        where.creado_en.gte = ES_FECHA_SOLA.test(filtros.desde)
          ? inicioDiaLimaDeFecha(filtros.desde)
          : new Date(filtros.desde);
      }
      if (filtros.hasta) {
        if (ES_FECHA_SOLA.test(filtros.hasta)) {
          where.creado_en.lt = inicioDiaLimaDeFecha(sumarDiasFechaIso(filtros.hasta, 1));
        } else {
          where.creado_en.lte = new Date(filtros.hasta);
        }
      }
    }
    if (filtros.buscar) {
      const q = filtros.buscar.trim();
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { cliente_nombre: { contains: q, mode: 'insensitive' } },
        { cliente_telefono: { contains: q } },
        { mesa_nombre: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (filtros.medios) {
      // Medio de algún cobro vigente (basta uno si es pago mixto) o, sin cobro aún, el medio elegido (pago_metodo/pago_preferido)
      const medios = filtros.medios.split(',').filter(Boolean);
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : []),
        {
          OR: [
            { cobros: { some: { anulado_en: null, pagos: { some: { medio: { in: medios } } } } } },
            {
              cobros: { none: { anulado_en: null } },
              OR: medios.flatMap((m) => [{ pago_metodo: { contains: m } }, { pago_preferido: { contains: m } }]),
            },
          ],
        },
      ];
    }

    if (usuarioActual && usuarioActual.rol === 'REPARTIDOR') {
      where.repartidor_party_id = BigInt(usuarioActual.partyId);
    }

    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const limite =
      filtros.limite === 'todas' ? LIMITE_TODAS : Math.min(100, Math.max(1, Number(filtros.limite) || 20));
    const skip = (pagina - 1) * limite;

    const [total, pedidos, umbrales, grupos] = await Promise.all([
      this.prisma.pedido.count({ where }),
      this.prisma.pedido.findMany({
        where,
        skip,
        take: limite,
        orderBy: [{ creado_en: 'desc' }, { id: 'desc' }], // id desempata: la paginación no pierde ni repite pedidos del mismo instante
        include: INCLUIR_LISTA,
      }),
      this.obtenerUmbrales(),
      filtros.resumen === '1'
        ? this.prisma.pedido.groupBy({ by: ['estado', 'pago_estado'], where, _count: { _all: true }, _sum: { total: true } })
        : Promise.resolve(null),
    ]);

    const ahora = new Date();
    const esAdmin = usuarioActual?.rol === 'ADMIN';

    // Cuenta = pedido original + sus extras (enlace pedido_origen_id). Si la página parte una cuenta, los miembros que
    // quedaron fuera viajan aparte en `relacionados` (no cuentan en total/paginación ni en el resumen): la web los une a la tarjeta.
    const idsPagina = pedidos.map((p) => p.id);
    const enPagina = new Set(idsPagina.map(String));
    // Solo las cuentas a las que les falta alguien: el original fuera de la página o algún extra del original fuera de ella
    const raices = [
      ...new Set(
        pedidos
          .filter((p) => p.pedido_origen_id != null || (p.extras?.length ?? 0) > 0)
          .map((p) => p.pedido_origen_id ?? p.id)
          .filter((raiz) => {
            const r = pedidos.find((p) => p.id === raiz);
            return !r || (r.extras ?? []).some((e) => !enPagina.has(String(e.id)));
          }),
      ),
    ];
    const relacionadosCrudos =
      raices.length > 0 && usuarioActual?.rol !== 'REPARTIDOR'
        ? await this.prisma.pedido.findMany({
            where: { id: { notIn: idsPagina }, OR: [{ id: { in: raices } }, { pedido_origen_id: { in: raices } }] },
            orderBy: { id: 'asc' },
            include: INCLUIR_LISTA,
          })
        : [];
    const todos = [...pedidos, ...relacionadosCrudos];
    const cobrosMozo = await this.cobrosMozoDe(todos);
    const ajustes = await ajustesPendientesUbicacion(this.prisma, todos.map((p) => p.id));
    // Columnas de Caja: quién tomó el pedido (mozo/cajero) y quién lo cobró
    const nombres = await nombresDePersonas(
      this.prisma,
      todos.flatMap((p) => [
        ...(CANALES_CON_ATENDIDO.includes(p.canal) && p.party_id != null ? [p.party_id] : []),
        ...(p.cobros?.[0]?.cobrado_por != null ? [p.cobros[0].cobrado_por] : []),
      ]),
    );

    const mapear = (p: (typeof todos)[number]) => {
      const { minutosEspera, color, colorEspera } = this.calcularMinutosYColor(
        p.creado_en,
        ahora,
        umbrales.naranjaMin,
        umbrales.rojoMin,
      );

      const cobro = p.cobros?.[0];
      const cobroVigenteId = cobro?.id ? String(cobro.id) : null;
      const mediosCobro = [...new Set((cobro?.pagos ?? []).map((x) => x.medio))];
      // Sin cobro vigente: el medio elegido (pago_metodo o pago_preferido), marcado como pendiente
      const mediosElegidos = (p.pago_metodo || p.pago_preferido || '').split('+').map((m) => m.trim()).filter(Boolean);
      const sinCobro = !cobro;

      return {
        ...p,
        mediosPago: sinCobro ? mediosElegidos : mediosCobro,
        mediosPagoPendiente: sinCobro && mediosElegidos.length > 0,
        atendidoPorNombre:
          CANALES_CON_ATENDIDO.includes(p.canal) && p.party_id != null ? (nombres.get(String(p.party_id)) ?? null) : null,
        atendidoEn: CANALES_CON_ATENDIDO.includes(p.canal) && p.party_id != null ? p.creado_en : null,
        cobradoPorNombre: cobro?.cobrado_por != null ? (nombres.get(String(cobro.cobrado_por)) ?? null) : null,
        cobradoEn: cobro?.en ?? null,
        tiempoTotalSeg: totalSegDePedido(p),
        ...resumenExtras(p),
        cobro_vigente_id: cobroVigenteId,
        cobroMozo: cobrosMozo.get(String(p.id)) ?? null,
        ajusteUbicacionPendiente: ajustes.get(String(p.id)) ?? null,
        comprobante_doc: esAdmin ? p.comprobante_doc : enmascararDni(p.comprobante_doc || ''),
        minutosEspera,
        color,
        colorEspera,
      };
    };
    const items = pedidos.map(mapear);
    const relacionados = relacionadosCrudos.map(mapear);

    return {
      total,
      pagina,
      limite,
      items,
      relacionados,
      ...(grupos && {
        resumen: grupos.map((g) => ({
          estado: g.estado,
          pago_estado: g.pago_estado,
          n: g._count._all,
          total: Number(g._sum.total ?? 0),
        })),
      }),
    };
  }

  /**
   * "No entregados" (GET /admin/pedidos/no-entregados, pedidos/ver), solo lectura:
   *  - reprogramar: delivery LISTO sin repartidor por NO_CONTESTA (retiro por espera agotada),
   *    salvo los ya reenviados a reparto (REPROGRAMADO).
   *  - cancelados: delivery ANULADO por esa misma causa (el cliente dijo no, sin respuesta o tope).
   * La pregunta de reprogramar sale de mensaje_reparto (etapa 5).
   */
  async listarNoEntregados() {
    const incluir = {
      incidentes: {
        where: { motivo: MOTIVO_RETIRO },
        orderBy: { en: 'desc' as const },
        take: 5,
        select: { ...SELECT_PRUEBA_INCIDENTE, id: true },
      },
      mensajesReparto: {
        where: { numero: NUMERO_PREGUNTA_REPROG },
        take: 1,
        select: { estado: true },
      },
    };
    const [porReprogramar, cancelados] = await Promise.all([
      this.prisma.pedido.findMany({
        where: {
          estado: 'LISTO',
          motivo_falla: MOTIVO_RETIRO,
          repartidor_party_id: null,
          NOT: {
            mensajesReparto: {
              some: { numero: NUMERO_PREGUNTA_REPROG, estado: ESTADO_REPROG.REPROGRAMADO },
            },
          },
        },
        include: incluir,
        orderBy: { creado_en: 'desc' },
        take: 200,
      }),
      this.prisma.pedido.findMany({
        where: FILTRO_CANCELADO_NO_RECIBIR,
        include: { ...incluir, devolucion: true },
        orderBy: { anulado_en: 'desc' },
        take: 200,
      }),
    ]);

    const devoluciones = cancelados.flatMap((p) => (p.devolucion ? [p.devolucion] : []));
    const nombres = await nombresDePartes(
      this.prisma,
      devoluciones.flatMap((d) => [d.por_party_id, d.autorizado_por_party_id]),
    );

    const filas = (p: any, enLista: boolean) => {
      const pago = String(p.pago_estado || '').toUpperCase();
      const pregunta = p.mensajesReparto?.[0]?.estado as string | undefined;
      const devolucion = p.devolucion ? salidaDevolucion(p.devolucion, nombres) : null;
      return {
        id: String(p.id),
        codigo: p.codigo,
        cliente_nombre: p.cliente_nombre ?? null,
        cliente_telefono: p.cliente_telefono ?? null,
        total: Number(p.total),
        motivo: enLista
          ? 'No contestó al repartidor (retiro por espera agotada)'
          : p.motivo_anulacion || 'Sin motivo registrado',
        retirado_en: p.incidentes?.[0]?.en ?? null,
        pregunta: PREGUNTA_REPROG_VISTA[pregunta ?? ''] ?? 'SIN_PREGUNTA',
        pago_estado: p.pago_estado ?? null,
        revisar_devolucion: !enLista && PAGOS_DEVOLVIBLES.includes(pago) && !devolucion,
        devolucion,
      };
    };

    // Prueba de entrega fallida: la última fila de NO_CONTESTA con llegada registrada (si la hay)
    const conPrueba = async (lista: any[]) =>
      Promise.all(
        lista.map(async (p) => ({
          ...filas(p, lista === porReprogramar),
          prueba_entrega: await construirPruebaEntrega(
            this.prisma,
            (p.incidentes ?? []).find((i: any) => i.llego_en),
          ),
        })),
      );
    const reprogramar = await conPrueba(porReprogramar);
    const cancelacion = await conPrueba(cancelados);
    return {
      reprogramar,
      cancelados: cancelacion,
      total: reprogramar.length + cancelacion.length,
    };
  }

  /**
   * "Mis pedidos" del mozo (GET /admin/pedidos/mis-pedidos, pedidos/crear): solo los que él tomó
   * (canal MOZO y party_id propio) en el rango pedido, por día de Lima. El resumen no cuenta los anulados.
   */
  async misPedidos(usuario: UsuarioAutenticado, rango: RangoMisPedidos = 'hoy', filtros: FiltrosMisPedidos = {}) {
    const inicioHoy = obtenerInicioDiaLima();
    const DIA = 24 * 60 * 60 * 1000;
    // `desde`/`hasta` (YYYY-MM-DD, día Lima, inclusivos) mandan sobre `rango`; Lima es UTC-5 todo el año
    const diaLima = (f: string) => new Date(`${f}T05:00:00.000Z`);
    const conFechas = Boolean(
      (filtros.desde && ES_FECHA_SOLA.test(filtros.desde)) || (filtros.hasta && ES_FECHA_SOLA.test(filtros.hasta)),
    );
    let creado_en: { gte?: Date; lt?: Date } | undefined;
    if (conFechas) {
      creado_en = {};
      if (filtros.desde && ES_FECHA_SOLA.test(filtros.desde)) creado_en.gte = diaLima(filtros.desde);
      if (filtros.hasta && ES_FECHA_SOLA.test(filtros.hasta)) creado_en.lt = new Date(diaLima(filtros.hasta).getTime() + DIA);
    } else if (rango === 'todas') creado_en = undefined;
    else if (rango === 'ayer') creado_en = { gte: new Date(inicioHoy.getTime() - DIA), lt: inicioHoy };
    else if (rango === '7dias') creado_en = { gte: new Date(inicioHoy.getTime() - 6 * DIA) };
    else if (rango === '30dias') creado_en = { gte: new Date(inicioHoy.getTime() - 29 * DIA) };
    else creado_en = { gte: inicioHoy };

    // ADMIN y SUPERVISOR ven los pedidos de todos los mozos; el resto (mozo, caja) solo los suyos y `mozo` se ignora
    const veTodos = rolesDelUsuario(usuario).some((r) => r === 'ADMIN' || r === 'SUPERVISOR');
    const mozoFiltro = veTodos && filtros.mozo && /^\d+$/.test(filtros.mozo) ? BigInt(filtros.mozo) : null;
    const estadoFiltro =
      filtros.estado === 'EN_CURSO' ? { in: ESTADOS_EN_CURSO } : filtros.estado ? filtros.estado : undefined;
    const where: Prisma.PedidoWhereInput = {
      canal: 'MOZO',
      ...(veTodos ? (mozoFiltro != null ? { party_id: mozoFiltro } : {}) : { party_id: BigInt(usuario.partyId) }),
      ...(creado_en ? { creado_en } : {}),
      ...(estadoFiltro ? { estado: estadoFiltro } : {}),
    };

    const pedidos = await this.prisma.pedido.findMany({
      where,
      orderBy: { creado_en: 'desc' },
      select: {
        id: true,
        codigo: true,
        estado: true,
        modalidad: true,
        mesa_nombre: true,
        total: true,
        propina: true,
        pago_estado: true,
        pago_metodo: true,
        es_personal: true,
        pago_coordinado_en: true,
        cliente_nombre: true,
        creado_en: true,
        party_id: true,
        pasa_cocina_en: true,
        entregado_mesa_en: true,
        ubicacion_editada_en: true,
        // «Pedido extra»: enlace al original (todos los extras cuelgan del pedido raíz); la web une la cuenta en una tarjeta
        pedido_origen_id: true,
        pedidoOrigen: { select: { codigo: true } },
        repartidor_party_id: true,
        despachado_en: true,
        eta_min: true,
        eta_max: true,
        lineas: {
          select: {
            id: true,
            nombre: true,
            cantidad: true,
            listas: true,
            despachadas: true,
            producto_id: true,
            // Lista del mozo: tamaño, opciones (mismo criterio que constructor-etiquetas.ts), nota y precios
            tamano: true,
            nota: true,
            precio_unit: true,
            subtotal: true,
            // Cortesía: la línea sale a S/ 0; su valor de lista se muestra aparte
            es_cortesia: true,
            cortesia: { select: { valor_lista: true } },
            opcionesElegidas: { select: { opcion_nombre: true }, orderBy: { id: 'asc' } },
            // Producto por sabor: reparto de las unidades entre sabores
            sabores: { select: { sabor_nombre: true, cantidad: true }, orderBy: { id: 'asc' } },
            // Solo para contar líneas por área del progreso; no se devuelven
            area_id: true,
            producto: { select: { categoria: { select: { area_id: true } } } },
          },
          orderBy: { id: 'asc' },
        },
        // Áreas de cocina del pedido y si cada una ya despejó (una sola consulta, sin N+1)
        comandas: { select: { area_id: true, estado: true, area: { select: { nombre: true } } } },
        // Solo el semáforo: sirve para contar y para «legible»; nunca se devuelve al mozo.
        // Incluye los reemplazados (reemplazado_en) para contar el historial; lo vigente decide.
        vouchers: { select: { id: true, semaforo: true, medio: true, reemplazado_en: true } },
        planPago: { select: { medio: true, monto: true }, orderBy: { orden: 'asc' } },
      },
    });

    const validos = pedidos.filter((p) => p.estado !== 'ANULADO');
    const total = validos.reduce((suma, p) => suma + Number(p.total), 0);
    // Parámetros del tiempo (una lectura) para el «llega en» de los pedidos en camino
    const cfg = await leerConfigEta(this.prisma).catch(() => ({ ...CONFIG_ETA_DEFECTO, respaldoMin: 30 }));
    const ahora = new Date();
    // Tiempos de preparación por producto (promedio de 30 días o el defecto) para el «Listo en ~N min»
    const preparacion = await tiemposPreparacion(
      this.prisma,
      [...new Set(pedidos.flatMap((p) => p.lineas.map((l) => l.producto_id)).filter((id) => id != null).map(String))],
      ahora,
    );

    // Nombres de los mozos (una consulta) y, para ADMIN/SUPERVISOR, el desplegable de mozos del rango (sin anulados)
    const conteoMozos = veTodos
      ? await this.prisma.pedido.groupBy({
          by: ['party_id'],
          where: { canal: 'MOZO', estado: { not: 'ANULADO' }, party_id: { not: null }, ...(creado_en ? { creado_en } : {}) },
          _count: { _all: true },
        })
      : [];
    const idsMozo = [...new Set([...pedidos.map((p) => p.party_id), ...conteoMozos.map((c) => c.party_id)].filter((i): i is bigint => i != null))];
    const personas = idsMozo.length
      ? await this.prisma.person
          .findMany({ where: { party_id: { in: idsMozo } }, select: { party_id: true, nombres: true, apellidos: true } })
          .catch(() => [])
      : [];
    const nombreMozo = new Map(personas.map((x) => [String(x.party_id), [x.nombres, x.apellidos].filter(Boolean).join(' ')]));

    const lista = pedidos.map((p) => {
      const enEspera = !['LISTO', 'ENTREGADO', 'ANULADO'].includes(p.estado);
      const desdeEspera = p.pasa_cocina_en ?? p.creado_en;
      return {
        p,
        esperaMinutos: enEspera ? Math.max(0, Math.floor((ahora.getTime() - desdeEspera.getTime()) / 60000)) : null,
      };
    });
    if (filtros.orden === 'mas_espera') {
      // Más tiempo esperando primero; los que ya no esperan al final, por reciente (el orden base ya es reciente)
      lista.sort((a, b) => (b.esperaMinutos ?? -1) - (a.esperaMinutos ?? -1));
    }

    return {
      mozos: veTodos
        ? conteoMozos
            .map((c) => ({ partyId: String(c.party_id), nombre: nombreMozo.get(String(c.party_id)) || `Mozo ${c.party_id}`, pedidos: c._count._all }))
            .sort((a, b) => a.nombre.localeCompare(b.nombre))
        : undefined,
      pedidos: lista.map(({ p, esperaMinutos }) => ({
        id: String(p.id),
        codigo: p.codigo,
        estado: p.estado,
        modalidad: p.modalidad,
        mesaNombre: p.mesa_nombre,
        mozoPartyId: p.party_id != null ? String(p.party_id) : null,
        mozoNombre: p.party_id != null ? nombreMozo.get(String(p.party_id)) || null : null,
        esperaMinutos,
        pedidoOrigenId: p.pedido_origen_id != null ? String(p.pedido_origen_id) : null,
        pedidoOrigenCodigo: p.pedidoOrigen?.codigo ?? null,
        // Último cambio de ubicación (la insignia «Dirección editada»); null si la dirección es la original
        ubicacionEditadaEn: p.ubicacion_editada_en ?? null,
        // Nombre del cliente para reconocer el pedido; nunca teléfono ni DNI. Mesa sin nombre: la mesa.
        clienteNombre: p.cliente_nombre?.trim() || (p.modalidad === 'MESA' ? p.mesa_nombre : null) || null,
        total: Number(p.total),
        // Propina del pedido (va aparte); lo que el cliente paga = total + propina
        propina: Number(p.propina ?? 0),
        pagoEstado: p.pago_estado,
        pagoMetodo: p.pago_metodo,
        // Pago dividido: plan por medio y la parte digital (lo que lleva voucher)
        plan: p.planPago.map((f) => ({ medio: f.medio, monto: Number(f.monto) })),
        montoDigital: montoDigitalDePlan(p.planPago.map((f) => ({ medio: f.medio, monto: Number(f.monto) }))),
        // Solo vigentes deciden; historialVouchers cuenta también los reemplazados (se pliega en la web)
        vouchers: p.vouchers.filter((v) => v.reemplazado_en == null).length,
        historialVouchers: p.vouchers.length,
        // Misma regla que el cobro: un voucher ILEGIBLE no cuenta como comprobante
        tieneVoucherLegible: p.vouchers.some((v) => v.reemplazado_en == null && v.semaforo !== 'ILEGIBLE'),
        // Regla de cambio de voucher (regla-cambio-voucher.ts): la web no la duplica
        puedeCambiarVoucher: puedeCambiarVoucher(p, 'MOZO'),
        puedeSubirVoucher: puedeSubirVoucher(p, 'MOZO'),
        // Un voucher por medio digital del plan: cada uno subido o falta, con su monto
        vouchersPorMedio: mediosDigitalesDelPedido(
          p.planPago.map((f) => ({ medio: f.medio, monto: Number(f.monto) })),
          p.pago_metodo,
          totalCobrable(p),
        ).map((m) => ({
          medio: m.medio,
          monto: m.monto,
          subido: p.vouchers.some(
            (v) => v.reemplazado_en == null && v.semaforo !== 'ILEGIBLE' && voucherCubreMedio(v.medio, m.medio),
          ),
          // Voucher vigente de ese medio (para «Quitar voucher» desde la tarjeta)
          voucherId:
            p.vouchers.find((v) => v.reemplazado_en == null && voucherCubreMedio(v.medio, m.medio))?.id?.toString() ?? null,
        })),
        creadoEn: p.creado_en,
        lineas: lineasDeCuenta(p.lineas).map((l) => ({
          id: String(l.id),
          nombre: l.nombre,
          cantidad: l.cantidad,
          tamano: l.tamano || null,
          // Nombres de las opciones elegidas, como en las etiquetas de cocina
          opciones: l.opcionesElegidas.map((o) => o.opcion_nombre).filter(Boolean),
          // Reparto por sabor («2 Fresa · 3 Oreo»): cada sabor con sus unidades
          sabores: (l.sabores ?? []).map((sb) => ({ nombre: sb.sabor_nombre, cantidad: sb.cantidad })),
          nota: l.nota || null,
          precioUnit: Number(l.precio_unit),
          subtotal: l.subtotal != null ? Number(l.subtotal) : null,
          // Solo en las cortesías: el resto de las líneas conserva su forma
          ...(l.es_cortesia ? { esCortesia: true, valorLista: l.cortesia ? Number(l.cortesia.valor_lista) : null } : {}),
          // Cocina ya tiene todas las unidades de la línea listas (listas = cantidad)
          lista: l.listas >= l.cantidad,
        })),
        // Estado de cocina y entrega (misma función que el seguimiento de la carta)
        progreso: { ...progresoDelPedido(p, { cfg, ahora, preparacion }), ...unidadesDeProgreso(p) },
      })),
      resumen: {
        cantidad: validos.length,
        total: Math.round(total * 100) / 100,
        enCurso: validos.filter((p) => ESTADOS_EN_CURSO.includes(p.estado)).length,
        entregados: validos.filter((p) => p.estado === 'ENTREGADO').length,
      },
    };
  }

  /**
   * Vista de cocina: solo COLA y PREPARANDO, más viejos primero (DT-58).
   * Si historial=true, muestra los pedidos preparados hoy.
   */
  async listarCocina(historial?: string | boolean, usuarioActual?: UsuarioAutenticado) {
    const umbrales = await this.obtenerUmbrales();
    const ahora = new Date();
    const esHistorial = historial === true || historial === 'true' || historial === '1';

    let pedidos: any[];

    if (esHistorial) {
      const inicioDia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), 0, 0, 0, 0);
      pedidos = await this.prisma.pedido.findMany({
        where: {
          listo_en: { gte: inicioDia },
          estado: { in: ['LISTO', 'EN_CAMINO', 'ENTREGADO'] },
        },
        orderBy: { listo_en: 'desc' },
        include: {
          lineas: {
            include: {
              opcionesElegidas: true,
              sabores: true,
              area: true,
            },
          },
          zona: true,
        },
      });
    } else {
      pedidos = await this.prisma.pedido.findMany({
        where: {
          estado: { in: ['COLA', 'PREPARANDO'] },
          // El pago digital sin captura NO frena a cocina (la captura es opcional y se puede subir después).
          NOT: [
            // Delivery sin ubicación (punto o zona): sin envío calculado no pasa a cocina
            { ...DELIVERY_SIN_UBICACION_WHERE, OR: [...DELIVERY_SIN_UBICACION_WHERE.OR] },
          ],
        },
        orderBy: { creado_en: 'asc' }, // Más viejos primero
        include: {
          lineas: {
            include: {
              opcionesElegidas: true,
              sabores: true,
              area: true,
            },
          },
          zona: true,
        },
      });
      // Desempate por id en caso de misma hora de llegada
      pedidos.sort((a, b) => {
        const diff = new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime();
        if (diff !== 0) return diff;
        return Number(a.id - b.id);
      });
    }

    // Cocina solo ve qué preparar y para quién: sin teléfono, dirección, pago ni comprobante (Ley 29733)
    return pedidos.map((p) => {
      const { minutosEspera, color, colorEspera } = this.calcularMinutosYColor(
        p.creado_en,
        ahora,
        umbrales.naranjaMin,
        umbrales.rojoMin,
      );

      return {
        id: p.id,
        codigo: p.codigo,
        canal: p.canal,
        modalidad: p.modalidad,
        estado: p.estado,
        cliente_nombre: p.cliente_nombre,
        nota: p.nota,
        creado_en: p.creado_en,
        listo_en: p.listo_en,
        lineas: lineasDeCuenta(p.lineas),
        minutosEspera,
        color,
        colorEspera,
      };
    });
  }

  /**
   * Obtiene el detalle completo de un pedido con enmascaramiento de DNI/RUC según rol (DT-75).
   */
  /**
   * Cobro por mozo (Caja y Pedidos): cuándo lo envió, medio(s), nombre del mozo y si falta el voucher digital.
   * null si no lo envió o el pedido ya está PAGADO (la etiqueta se quita al confirmar el cobro).
   */
  private async cobrosMozoDe(
    pedidos: Array<{
      id: bigint;
      pago_estado: string | null;
      cobro_mozo_en: Date | null;
      cobro_mozo_medio: string | null;
      cobro_mozo_party_id: bigint | null;
      cobro_mozo_recibido?: unknown;
      comprobante_tipo?: string | null;
    }>,
  ): Promise<Map<string, CobroMozoVista | null>> {
    const mapa = new Map<string, CobroMozoVista | null>();
    const vigentes = pedidos.filter((p) => p.cobro_mozo_en && p.pago_estado !== 'PAGADO');
    const idsPedidos = vigentes.map((p) => p.id);
    const idsMozos = [...new Set(vigentes.map((p) => p.cobro_mozo_party_id).filter((v): v is bigint => v != null))];

    const [conVoucher, personas, efectivos] = await Promise.all([
      idsPedidos.length
        ? this.prisma.voucherPago.findMany({
            // Misma regla que enviarACaja: voucher vigente y legible
            where: { pedido_id: { in: idsPedidos }, reemplazado_en: null, semaforo: { not: 'ILEGIBLE' } },
            select: { pedido_id: true },
            distinct: ['pedido_id'],
          })
        : Promise.resolve([]),
      idsMozos.length
        ? this.prisma.person.findMany({
            where: { party_id: { in: idsMozos } },
            select: { party_id: true, nombres: true, apellidos: true },
          })
        : Promise.resolve([]),
      // Efectivo del plan: el vuelto es lo recibido menos esto
      idsPedidos.length
        ? this.prisma.pedidoPagoPlan.findMany({
            where: { pedido_id: { in: idsPedidos }, medio: 'EFECTIVO' },
            select: { pedido_id: true, monto: true },
          })
        : Promise.resolve([]),
    ]);
    const pedidosConVoucher = new Set(conVoucher.map((v) => String(v.pedido_id)));
    const nombreMozo = new Map(
      personas.map((per) => [String(per.party_id), `${per.nombres} ${per.apellidos || ''}`.trim()]),
    );
    const efectivoDe = new Map<string, number>();
    for (const e of efectivos) {
      efectivoDe.set(String(e.pedido_id), (efectivoDe.get(String(e.pedido_id)) ?? 0) + Number(e.monto));
    }

    for (const p of pedidos) {
      if (!p.cobro_mozo_en || p.pago_estado === 'PAGADO' || !p.cobro_mozo_medio) {
        mapa.set(String(p.id), null);
        continue;
      }
      const medios = p.cobro_mozo_medio.split('+');
      const conVouch = medios.some((m) => (MEDIOS_CON_VOUCHER_CAJA as readonly string[]).includes(m));
      const digital = medios.some((m) => ['YAPE', 'PLIN', 'TRANSFERENCIA'].includes(m));
      const sinCaptura = digital && !pedidosConVoucher.has(String(p.id));
      const recibido = p.cobro_mozo_recibido != null ? Number(p.cobro_mozo_recibido) : null;
      const vuelto =
        recibido != null ? Math.round((recibido - (efectivoDe.get(String(p.id)) ?? 0)) * 100) / 100 : null;
      const tipo = p.comprobante_tipo;
      mapa.set(String(p.id), {
        en: p.cobro_mozo_en,
        medio: p.cobro_mozo_medio,
        mozo: p.cobro_mozo_party_id != null ? nombreMozo.get(String(p.cobro_mozo_party_id)) || null : null,
        faltaVoucher: conVouch && !pedidosConVoucher.has(String(p.id)) && !sinCaptura,
        sinCaptura,
        recibido,
        vuelto,
        pide: tipo === 'BOLETA' || tipo === 'FACTURA' ? tipo : null,
      });
    }
    return mapa;
  }

  async obtenerPorId(
    id: bigint | string | number,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(id);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        lineas: {
          include: {
            opcionesElegidas: true,
            // Cortesía: valor de lista (la línea sale a S/ 0)
            cortesia: { select: { valor_lista: true } },
            sabores: true,
            area: true,
          },
        },
        historial: {
          orderBy: { en: 'asc' },
        },
        zona: true,
        planPago: { orderBy: { orden: 'asc' } },
        cobros: {
          where: { anulado_en: null },
          select: { id: true },
          take: 1,
        },
        ...INCLUIR_EXTRAS,
        // Última prueba de entrega fallida (cliente no salió con llegada registrada)
        incidentes: {
          where: { motivo: 'NO_CONTESTA', llego_en: { not: null } },
          orderBy: { en: 'desc' },
          take: 1,
          select: SELECT_PRUEBA_INCIDENTE,
        },
      },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuarioActual && usuarioActual.rol === 'REPARTIDOR') {
      if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== BigInt(usuarioActual.partyId)) {
        throw new ForbiddenException({
          codigo: 'NO_ASIGNADO',
          mensaje: 'Este pedido no está asignado a tu usuario',
        });
      }
    }

    const umbrales = await this.obtenerUmbrales();
    const { minutosEspera, color, colorEspera } = this.calcularMinutosYColor(
      pedido.creado_en,
      new Date(),
      umbrales.naranjaMin,
      umbrales.rojoMin,
    );

    const esAdmin = usuarioActual?.rol === 'ADMIN';

    if (esAdmin && pedido.comprobante_doc) {
      await this.auditoria.registrar({
        categoria: 'LECTURA_SENSIBLE',
        modulo: 'pedidos',
        accion: 'VER_COMPROBANTE',
        resultado: 'OK',
        entidad: 'pedido',
        entidadId: pedido.id,
        partyId: usuarioActual?.partyId,
        ip,
      });
    }

    const cobroVigenteId = pedido.cobros?.[0]?.id ? String(pedido.cobros[0].id) : null;

    const puntos = (await explicarPedidosPorId(this.prisma, [pedido.id]).catch(() => null))?.get(String(pedido.id)) ?? null;

    const cobroMozo = (await this.cobrosMozoDe([pedido])).get(String(pedido.id)) ?? null;
    const ajusteUbicacionPendiente = (await ajustesPendientesUbicacion(this.prisma, [pedido.id])).get(String(pedido.id)) ?? null;

    // Quién hizo qué: una sola línea de tiempo del pedido y la ficha de cada cortesía (en vez de auditoría por producto)
    const { eventos: eventosPedido, cortesiaPorLinea } = await cargarAuditoriaPedido(this.prisma, pedido.id, pedido.historial as any).catch(
      () => ({ eventos: [], cortesiaPorLinea: new Map<string, any>() }),
    );
    const { incidentes, ...pedidoSinIncidentes } = pedido;
    // Marca «Pago modificado por <usuario> · hora»: el último cambio de pago del historial (AjustarPagoService)
    const ultimoAjuste = [...((pedido.historial as any[]) ?? [])].reverse().find((h) => String(h.motivo ?? '').startsWith('Pago modificado'));
    const ajustePago = ultimoAjuste
      ? {
          por: ultimoAjuste.por_party_id ? (await nombresDePartes(this.prisma, [ultimoAjuste.por_party_id]).catch(() => new Map<string, string>())).get(String(ultimoAjuste.por_party_id)) ?? null : null,
          en: ultimoAjuste.en,
          texto: String(ultimoAjuste.motivo),
        }
      : null;
    // Canje de puntos hecho en el local: quién lo aplicó (auditoría CANJE_PUNTOS_LOCAL)
    let canjePuntos: { puntos: number; aplicadoPor: string | null } | null = null;
    if (Number(pedido.puntos_canjeados ?? 0) > 0) {
      const reg = await this.prisma.auditoria
        .findFirst({ where: { accion: 'CANJE_PUNTOS_LOCAL', entidad: 'pedido', entidad_id: pedido.id }, select: { party_id: true } })
        .catch(() => null);
      const nombre = reg?.party_id ? (await nombresDePartes(this.prisma, [reg.party_id]).catch(() => new Map<string, string>())).get(String(reg.party_id)) ?? null : null;
      canjePuntos = { puntos: Number(pedido.puntos_canjeados), aplicadoPor: nombre };
    }
    // Solo con el control de almacén encendido y consumo registrado; si no, la respuesta no cambia
    const tieneConsumoAlmacen = (await this.consumoAlmacen?.tieneConsumo(pedido.id)) === true;
    return {
      ...pedidoSinIncidentes,
      ...(tieneConsumoAlmacen ? { tieneConsumoAlmacen: true } : {}),
      canjePuntos,
      ajustePago,
      lineas: pedido.lineas.map((l: any) => (l.es_cortesia ? { ...l, cortesia: cortesiaPorLinea.get(String(l.id)) ?? l.cortesia } : l)),
      eventos: eventosPedido,
      ...resumenExtras(pedido),
      ajusteUbicacionPendiente,
      prueba_entrega: await construirPruebaEntrega(this.prisma, incidentes?.[0]),
      puntos,
      cobro_vigente_id: cobroVigenteId,
      cobroMozo,
      comprobante_doc: esAdmin
        ? pedido.comprobante_doc
        : enmascararDni(pedido.comprobante_doc || ''),
      minutosEspera,
      color,
      colorEspera,
    };
  }

  /**
   * Cambia el estado de un pedido validando transiciones y permisos (la anulación exige motivo y queda auditada) (DT-58, DT-61).
   */
  async cambiarEstado(
    id: bigint | string | number,
    dto: CambiarEstadoDto,
    usuarioActual: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(id);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuarioActual && usuarioActual.rol === 'REPARTIDOR') {
      if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== BigInt(usuarioActual.partyId)) {
        throw new ForbiddenException({
          codigo: 'NO_ASIGNADO',
          mensaje: 'Este pedido no está asignado a tu usuario',
        });
      }
    }

    const estadoAnterior = pedido.estado;
    const nuevoEstado = dto.estado.toUpperCase().trim();
    const ahora = new Date();

    const roles = rolesDelUsuario(usuarioActual);

    // 1. Manejo de Anulación (DT-61): todos los roles de pedidos, cada uno en su alcance (mozo: sus pedidos; repartidor: los asignados)
    if (nuevoEstado === 'ANULADO') {
      if (!puedeAnularPedido(usuarioActual, pedido)) {
        throw new ForbiddenException({
          codigo: 'ANULAR_SIN_ALCANCE',
          mensaje: esSoloMozo(usuarioActual) ? 'Tu rol no puede anular pedidos' : 'Tu rol no puede anular pedidos',
        });
      }

      // Estados desde los que se permite anular: COLA, PREPARANDO, LISTO; y ENTREGADO sin cobro vigente
      // (FT-CIE-02: un pedido que no se cobró no puede quedar pendiente y bloquear el cierre)
      const entregadoSinCobro = estadoAnterior === 'ENTREGADO';
      if (!['COLA', 'PREPARANDO', 'LISTO'].includes(estadoAnterior) && !entregadoSinCobro) {
        throw new ConflictException({
          codigo: 'TRANSICION_INVALIDA',
          mensaje: `No se puede anular un pedido en estado ${estadoAnterior}`,
        });
      }

      if (entregadoSinCobro) {
        const cobroVigente = await this.prisma.cobro.findFirst({
          where: { pedido_id: pedido.id, anulado_en: null },
          select: { id: true },
        });
        if (cobroVigente) {
          throw new ConflictException({
            codigo: 'PEDIDO_COBRADO',
            mensaje: 'No se puede anular: el pedido tiene un cobro vigente. Anula primero el cobro.',
          });
        }
      }

      // Validar permiso de anular (un entregado sin cobro también pasa por esta regla)
      if (!entregadoSinCobro && usuarioActual.rol !== 'ADMIN') {
        const tienePermiso = await this.prisma.rolPermiso.findFirst({
          where: {
            rol: { in: roles },
            permiso: {
              modulo: 'pedidos',
              accion: 'anular',
            },
          },
        });

        if (!tienePermiso) {
          throw new ForbiddenException({
            codigo: 'SIN_PERMISO',
            mensaje: 'No tiene permiso para anular pedidos',
          });
        }
      }

      // Motivo obligatorio de al menos 5 caracteres
      const motivo = dto.motivo?.trim() || '';
      if (motivo.length < 5) {
        throw new BadRequestException({
          codigo: 'MOTIVO_REQUERIDO',
          mensaje: 'El motivo de anulación es obligatorio y debe tener al menos 5 caracteres',
        });
      }

      const aprobadoPor = usuarioActual.partyId;

      // Un pedido cobrado y aún sin entregar: primero se anula su cobro (el mismo flujo de Caja: sale del arqueo
      // y del cierre, devuelve puntos e insumos). Si la caja del cobro ya cerró, no se anula: queda para devolución.
      if (!entregadoSinCobro) {
        const cobroVigente = await this.prisma.cobro.findFirst({
          where: { pedido_id: pedido.id, anulado_en: null },
          select: { id: true },
        });
        if (cobroVigente) {
          if (!this.cobros) {
            throw new ConflictException({ codigo: 'PEDIDO_COBRADO', mensaje: 'El pedido tiene un cobro vigente. Anula primero el cobro.' });
          }
          try {
            await this.cobros.anularCobro(cobroVigente.id, { motivo: `Pedido anulado: ${motivo}` }, usuarioActual, ip);
          } catch (e: any) {
            if (e?.getResponse?.()?.codigo === 'CAJA_CERRADA') {
              throw new ConflictException({
                codigo: 'PEDIDO_COBRADO_CAJA_CERRADA',
                mensaje: 'El cobro de este pedido pertenece a una caja ya cerrada: no se puede anular. Registra la devolución al cliente.',
              });
            }
            throw e;
          }
        }
      }

      // Actualizar pedido a ANULADO
      const pedidoActualizado = await this.prisma.pedido.update({
        where: { id: pedido.id },
        data: {
          estado: 'ANULADO',
          anulado_en: ahora,
          anulado_por: usuarioActual.partyId,
          motivo_anulacion: motivo,
          anulacion_aprobada_por: aprobadoPor,
        },
      });

      // un pedido anulado devuelve el stock y reversa los puntos si ya se había cobrado
      await this.devolverAlAnular(pedido.id, pedido.codigo, usuarioActual?.partyId, ip);
      // Control de almacén encendido y pedido con consumo: «se llegó a preparar» (merma, por defecto) o «nunca» (devolver). Apagado: no hace nada.
      await this.consumoAlmacen?.decidirAnulacion(pedido.id, dto.consumoAlmacen, motivo, usuarioActual?.partyId);

      // Insertar en historial
      await this.prisma.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pedido.id,
          estado_anterior: estadoAnterior,
          estado_nuevo: 'ANULADO',
          motivo,
          por_party_id: usuarioActual.partyId,
          en: ahora,
        },
      });

      // Registrar auditoría
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'pedidos',
        accion: 'ANULAR',
        resultado: 'OK',
        entidad: 'pedido',
        entidadId: pedido.id,
        antes: { estado: estadoAnterior },
        despues: { estado: 'ANULADO', motivo },
        motivo,
        partyId: usuarioActual.partyId,
        ip,
      });

      // Emitir evento por WebSocket
      this.eventosGateway?.emitirAdmin('pedido:estado', {
        id: Number(pedido.id),
        codigo: pedido.codigo,
        estado: 'ANULADO',
      });

      // si estaba en la ruta de un repartidor: la ruta se cierra sola si ya no le quedan pedidos pendientes
      await cerrarRutaTrasAnular(this.prisma, pedido.repartidor_party_id, this.eventosGateway, this.logger);

      // un pedido anulado libera sus mesas
      try {
        await this.salonService?.liberarMesasDePedido(pedido.id);
      } catch {
        // idempotente: se puede liberar a mano
      }

      // las etiquetas aún pendientes de este pedido ya no se imprimen
      try {
        await this.impresionService?.vencerTrabajosObsoletos();
      } catch {
        // también las vence el ciclo de impresión
      }

      return pedidoActualizado;
    }

    // 2. Transiciones válidas normales: COLA -> PREPARANDO -> LISTO -> EN_CAMINO -> ENTREGADO
    let esTransicionValida = false;

    if (estadoAnterior === 'COLA') {
      // Cocina puede empezar a preparar o despejar directo a LISTO (DT-58)
      if (nuevoEstado === 'PREPARANDO' || nuevoEstado === 'LISTO') {
        esTransicionValida = true;
      }
    } else if (estadoAnterior === 'PREPARANDO') {
      if (nuevoEstado === 'LISTO') {
        esTransicionValida = true;
      }
    } else if (estadoAnterior === 'LISTO') {
      if (pedido.modalidad === 'DELIVERY') {
        if (nuevoEstado === 'EN_CAMINO') {
          esTransicionValida = true;
        }
      } else if (pedido.modalidad !== 'DELIVERY') {
        // RECOGER, MESA y LLEVAR saltan EN_CAMINO (LISTO -> ENTREGADO)
        if (nuevoEstado === 'ENTREGADO') {
          esTransicionValida = true;
        }
      }
    } else if (estadoAnterior === 'EN_CAMINO') {
      if (nuevoEstado === 'ENTREGADO') {
        esTransicionValida = true;
      }
    }

    if (!esTransicionValida) {
      throw new ConflictException({
        codigo: 'TRANSICION_INVALIDA',
        mensaje: `No se puede cambiar el pedido del estado ${estadoAnterior} a ${nuevoEstado} para modalidad ${pedido.modalidad}`,
      });
    }

    // Delivery sin ubicación (punto y zona): sin envío calculado no pasa a cocina ni avanza
    exigirDeliveryUbicado(pedido);

    // Un delivery no se marca entregado sin repartidor: su efectivo no tendría quién lo liquide
    if (nuevoEstado === 'ENTREGADO' && pedido.modalidad === 'DELIVERY' && !pedido.repartidor_party_id) {
      throw new ConflictException({
        codigo: 'REPARTIDOR_REQUERIDO',
        mensaje: 'Asigna un repartidor antes de marcar el pedido como entregado',
      });
    }

    // Cobro antes de entregar (Para llevar, Recoger, Delivery digital): a la salida o a ENTREGADO solo con el pedido
    // pagado; el administrador puede entregar sin cobrar con motivo. Va antes de Cocina para no despejar nada si falla.
    let forzadoSinCobro = false;
    if (nuevoEstado === 'EN_CAMINO' || nuevoEstado === 'ENTREGADO') {
      forzadoSinCobro = await exigirCobroAntesDeEntregar(this.prisma, pedido as any, usuarioActual, {
        forzar: dto.forzarSinCobro === true,
        motivo: dto.motivo,
      });
    }

    // Cocina manda: a LISTO o ENTREGADO solo con todas sus áreas despejadas (el administrador puede forzar con motivo)
    let forzadoAreas: string[] = [];
    if (nuevoEstado === 'LISTO' || nuevoEstado === 'ENTREGADO') {
      const pendientes = await exigirCocinaDespejada(this.prisma, pedido.id, usuarioActual, { forzar: dto.forzar === true, motivo: dto.motivo });
      if (pendientes.length > 0) {
        if (!this.comandas) throw new ConflictException({ codigo: 'COCINA_PENDIENTE', mensaje: 'No se pudo despejar Cocina. Pídele a Cocina que pulse “Listo”.' });
        // misma lógica de despejar de Cocina (líneas completas, auditoría y aviso en vivo), área por área
        for (const a of pendientes) await this.comandas.despejar(pedido.id, a.areaId, usuarioActual, ip);
        forzadoAreas = pendientes.map((a) => a.nombre);
      }
    }

    // Construir campos de actualización según el estado al que avanza
    const datosActualizacion: any = {
      estado: nuevoEstado,
    };

    if (nuevoEstado === 'PREPARANDO' && !pedido.pasa_cocina_en) {
      datosActualizacion.pasa_cocina_en = ahora;
    } else if (nuevoEstado === 'LISTO') {
      datosActualizacion.listo_en = ahora;
      if (!pedido.pasa_cocina_en) {
        datosActualizacion.pasa_cocina_en = ahora;
      }
    } else if (nuevoEstado === 'EN_CAMINO') {
      datosActualizacion.despachado_en = ahora;
      datosActualizacion.despachado_por = usuarioActual.partyId;
    } else if (nuevoEstado === 'ENTREGADO') {
      datosActualizacion.entregado_en = ahora;
    }

    // avisos al cliente delivery por etapa: se encolan en la misma transacción del cambio de estado
    const etapaAviso =
      nuevoEstado === 'LISTO' ? 'LISTO' : nuevoEstado === 'EN_CAMINO' ? 'SALIDA' : nuevoEstado === 'ENTREGADO' ? 'ENTREGADO' : null;
    const pedidoActualizado = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.pedido.update({
        where: { id: pedido.id },
        data: datosActualizacion,
      });
      // Registrar en historial de estados
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pedido.id,
          estado_anterior: estadoAnterior,
          estado_nuevo: nuevoEstado,
          motivo: dto.motivo?.trim() || null,
          por_party_id: usuarioActual.partyId,
          en: ahora,
        },
      });
      if (etapaAviso) await this.avisos?.avisar(pedido.id, etapaAviso, {}, tx);
      return actualizado;
    });
    this.avisos?.despertar();

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'CAMBIAR_ESTADO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      antes: { estado: estadoAnterior },
      despues: { estado: nuevoEstado, motivo: dto.motivo },
      motivo: dto.motivo,
      partyId: usuarioActual.partyId,
      ip,
    });
    if (forzadoAreas.length > 0) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'pedidos',
        accion: 'PEDIDO_FORZAR_SIN_COCINA',
        resultado: 'OK',
        entidad: 'pedido',
        entidadId: pedido.id,
        antes: { estado: estadoAnterior },
        despues: { estado: nuevoEstado, areasPendientes: forzadoAreas, forzadoPorAdministrador: true },
        motivo: dto.motivo?.trim(),
        partyId: usuarioActual.partyId,
        ip,
      });
    }

    if (forzadoSinCobro) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'pedidos',
        accion: 'PEDIDO_FORZAR_SIN_COBRO',
        resultado: 'OK',
        entidad: 'pedido',
        entidadId: pedido.id,
        antes: { estado: estadoAnterior, pagoEstado: pedido.pago_estado },
        despues: { estado: nuevoEstado, pagoEstado: pedido.pago_estado, forzadoPorAdministrador: true },
        motivo: dto.motivo?.trim(),
        partyId: usuarioActual.partyId,
        ip,
      });
    }

    // Emitir evento por WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: nuevoEstado,
    });


    // un pedido de mesa que pasa a LISTO a mano también avisa al mozo (RQ-SAL-02-10)
    if (nuevoEstado === 'LISTO' && pedido.modalidad === 'MESA') {
      try {
        await this.salonService?.avisarListo(pedido.id);
      } catch {
        // el aviso es informativo
      }
    }

    // Al aceptar caja el pedido (pasa a COLA o a PREPARANDO), encolado idempotente no bloqueante de etiquetas
    if (nuevoEstado === 'PREPARANDO' || nuevoEstado === 'COLA') {
      try {
        await this.impresionService?.encolarEtiquetasPedido(pedido.id);
      } catch {
        // El encolado nunca bloquea ni hace fallar la aceptación del pedido
      }
    }

    return pedidoActualizado;
  }

  /**
   * Registra o actualiza el pago del pedido en caja (DT-57, sin pago mixto en esta ola).
   */
  async registrarPago(
    id: bigint | string | number,
    dto: RegistrarPagoDto,
    usuarioActual: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(id);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { planPago: true, cobros: { where: { anulado_en: null }, take: 1 } },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuarioActual && usuarioActual.rol === 'REPARTIDOR') {
      if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== BigInt(usuarioActual.partyId)) {
        throw new ForbiddenException({
          codigo: 'NO_ASIGNADO',
          mensaje: 'Este pedido no está asignado a tu usuario',
        });
      }
    }

    exigirDeliveryUbicado(pedido);

    const metodoUpper = dto.metodo.toUpperCase().trim();
    if (!METODOS_PAGO_PERMITIDOS.includes(metodoUpper as any)) {
      throw new BadRequestException({
        codigo: 'METODO_INVALIDO',
        mensaje: `El método de pago '${dto.metodo}' no es válido`,
      });
    }

    // Confirmar un pago (COORDINADO o PAGADO) exige caja abierta; el pedido en sí no depende de la caja
    // Excepción: delivery en efectivo/tarjeta solo COORDINADO (se cobra al entregar): no entra dinero a caja, no la exige
    const coordinaContraEntrega =
      pedido.modalidad === 'DELIVERY' && dto.estado === 'COORDINADO' && ['EFECTIVO', 'TARJETA'].includes(metodoUpper);
    if (!coordinaContraEntrega) await exigirCajaAbiertaHoy(this.prisma);

    // Pago digital (Yape, Plin, transferencia): el voucher útil (un ILEGIBLE no cuenta) es OPCIONAL; sin él queda «sin captura».
    // Misma regla que el cobro y el pago coordinado (comprobante-pago.util).
    const sinVoucherAutorizado = await exigirComprobanteDigital({
      db: this.prisma,
      pedidoId: pedido.id,
      medios: [metodoUpper],
      planPago: pedido.planPago,
      sinVoucher: dto.sinVoucher,
      confirmaSinCaptura: dto.confirmaSinCaptura === true || pedido.cobro_mozo_en != null,
      pedidoLocal: esPedidoLocalSinCaptura(pedido),
      permiteExcepcion: true,
    });

    // Código de operación por medio digital (plan mixto: uno por parte): OPCIONAL, nunca bloquea el pago.
    // Solo se guardan y auditan los que vienen escritos; sin código el pago queda «sin código» y se puede agregar después.
    const codigosEntregados = new Map(
      (dto.codigosOperacion ?? []).map((c) => [String(c.medio).toUpperCase().trim(), String(c.codigo ?? '').trim()]),
    );
    const codigosRequeridos = mediosQueExigenCodigo(metodoUpper, pedido.planPago).filter((m) => !!codigosEntregados.get(m));

    const ahora = new Date();
    // Pago dividido con parte en efectivo o tarjeta: validar la parte digital no cobra el resto. El pedido queda
    // COORDINADO (falta cobrar contraentrega o en Caja) y pasa a PAGADO cuando entra ese efectivo.
    const restoPorCobrar = (pedido.planPago ?? []).some((f) => !MEDIOS_DIGITALES_PLAN.includes(f.medio as never));
    const estadoFinal = dto.estado === 'PAGADO' && restoPorCobrar ? 'COORDINADO' : dto.estado;
    // PAGADO nunca deja el dinero fuera de caja: el pago pasa por el mismo cobro que usa Caja (Cobro en la caja de
    // hoy, comprobante, ticket, puntos). Quedan fuera, por diseño: el crédito del personal, el total 0,
    // lo ya cobrado (una cortesía solo baja el total) y el efectivo contra entrega de un delivery (entra por la liquidación del repartidor).
    const plan = pedido.planPago ?? [];
    const contraEntrega =
      pedido.modalidad === 'DELIVERY' && (plan.length ? plan.some((f) => f.medio === 'EFECTIVO') : metodoUpper === 'EFECTIVO');
    const debeCobrarse =
      estadoFinal === 'PAGADO' &&
      !!this.cobros &&
      !pedido.es_personal &&
      Number(pedido.total) > 0 &&
      pedido.pago_estado !== 'PAGADO' &&
      !(pedido.cobros ?? []).length &&
      !contraEntrega;
    if (debeCobrarse) {
      // Lo que entrega el cliente: la venta (plan guardado o un solo renglón con el método) más la propina del pedido
      const renglones = plan.length
        ? plan.map((f) => ({ medio: String(f.medio), monto: aCentimos(f.monto) }))
        : [{ medio: metodoUpper, monto: aCentimos(pedido.total) }];
      renglones[0].monto += aCentimos(pedido.propina ?? 0);
      await this.cobros!.cobrar(
        {
          pedidoId: pedido.id.toString(),
          pagos: renglones.map((r) => ({ medio: r.medio, monto: enPesos(r.monto) })),
          sinVoucher: dto.sinVoucher,
          confirmaSinCaptura: dto.confirmaSinCaptura,
        } as any,
        usuarioActual,
        ip,
      );
    }
    const pedidoActualizado = await this.prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        // con cobro, el medio y el estado ya los dejó el cobro (MIXTO si hay más de un medio)
        ...(debeCobrarse ? {} : { pago_metodo: metodoUpper, pago_estado: estadoFinal }),
        pago_coordinado_en: ahora,
        pago_coordinado_por: usuarioActual.partyId,
      },
    });

    // El código confirmado por Caja queda en el voucher vigente de ese medio (la lectura de la IA sigue en `extraido`)
    for (const medio of codigosRequeridos) {
      const codigo = codigosEntregados.get(medio)!;
      const voucher = await this.prisma.voucherPago.findFirst({
        where: {
          pedido_id: pedido.id,
          reemplazado_en: null,
          semaforo: { not: 'ILEGIBLE' },
          OR: [{ medio: null }, { medio }],
        },
        orderBy: { creado_en: 'desc' },
        select: { id: true, operacion: true },
      });
      if (voucher && voucher.operacion !== codigo) {
        await this.prisma.voucherPago.update({ where: { id: voucher.id }, data: { operacion: codigo } });
      }
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: sinVoucherAutorizado ? 'REGISTRAR_PAGO_SIN_VOUCHER' : 'REGISTRAR_PAGO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      antes: { pago_metodo: pedido.pago_metodo, pago_estado: pedido.pago_estado },
      despues: {
        pago_metodo: metodoUpper,
        pago_estado: estadoFinal,
        sin_voucher: sinVoucherAutorizado
          ? { motivo: sinVoucherAutorizado.motivo, sin_captura: sinVoucherAutorizado.sinCaptura === true }
          : null,
        codigos_operacion: codigosRequeridos.map((medio) => ({ medio, codigo: codigosEntregados.get(medio) })),
      },
      partyId: usuarioActual.partyId,
      ...(sinVoucherAutorizado ? { motivo: sinVoucherAutorizado.motivo } : {}),
      ip,
    });

    // Al confirmar Caja el pago de un pedido que sigue en cocina, salen sus etiquetas. Un pedido de la carta o de
    // WhatsApp nace ya en COLA: nunca pasa por «cambiar a COLA», que era lo único que encolaba las etiquetas.
    // Es idempotente (una clave por etiqueta) y nunca bloquea el pago.
    if (['COLA', 'PREPARANDO'].includes(String(pedido.estado).toUpperCase())) {
      try {
        await this.impresionService?.encolarEtiquetasPedido(pedido.id);
      } catch {
        // las etiquetas se pueden reimprimir desde el pedido
      }
    }

    // PAGADO por aquí (p. ej. el repartidor cobra) nunca pasa por Caja → cobrar, así que suma aquí
    // los puntos del cliente; es idempotente y, si falla, no deshace el pago
    if (estadoFinal === 'PAGADO') {
      try {
        await this.impresionService?.encolarTicketPedido(pedido.id);
      } catch {
        // el ticket se puede reimprimir
      }
      try {
        await this.puntosService?.acumularPorPedido(pedido.id);
      } catch {
        // se reintenta al volver a registrar
      }
    }

    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: pedido.estado,
    });

    return pedidoActualizado;
  }
}
