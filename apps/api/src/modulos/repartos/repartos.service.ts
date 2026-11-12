import { montoACobrar } from '../../comun/monto-a-cobrar';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { exigirCobroAntesDeEntregar, requiereCobroAntesDeEntregar } from '../pedidos';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import {
  COORDENADAS_LOCAL_DEFAULT,
  Coordenadas,
  PedidoRutaInput,
  RutaService,
} from './ruta.service';
import { FiltrarRepartosDto } from './dto/filtrar-repartos.dto';
import { montoPendienteReprogramacion } from './recargo-reprogramacion';
import { SaltarPedidoDto } from './dto/saltar-pedido.dto';
import { TomarRutaDto } from './dto/tomar-ruta.dto';
import { TomarRutaSugeridaDto } from './dto/tomar-ruta-sugerida.dto';
import { leerConfigEta } from './eta-entrega';
import { idOpcion as calcularIdOpcion, sugerirRutas } from './rutas-sugeridas';
import {
  estadoFinalEnRuta,
  horaFinalPedido,
  hoyLima,
  limitesDiaLima,
  sincronizarRuta,
  sumarARuta,
} from './rutas-reparto';
import { FiltrarRutasDto } from './dto/filtrar-rutas.dto';

/** Campos mínimos de las líneas: cuenta de productos y a qué área de cocina va cada una. */
const LINEAS_AREAS = {
  cantidad: true,
  despachadas: true,
  area_id: true,
  producto: { select: { categoria: { select: { area_id: true } } } },
} satisfies Prisma.PedidoLineaSelect;

/** Plan de pago y solicitud de cambio de cobro pendiente: lo que formatearPedidoReparto necesita para el cobro real. */
const INCLUDE_COBRO = {
  // Estado por área de cocina (solo nombre y estado) para el check «Cocina» del delivery
  comandas: { select: { area_id: true, estado: true, area: { select: { nombre: true } } } },
  planPago: { select: { medio: true, monto: true, orden: true }, orderBy: { orden: 'asc' } },
  solicitudesCambioCobro: { where: { estado: 'PENDIENTE' }, take: 1 },
} satisfies Prisma.PedidoInclude;

/** Estados de pedido que siguen vivos en el reparto: los únicos que muestra la vista activa. */
export const ESTADOS_ACTIVOS_REPARTO = ['LISTO', 'EN_CAMINO'] as const;
import { ReportarFallaDto } from './dto/reportar-falla.dto';
import { ResolverFallaDto } from './dto/resolver-falla.dto';
import { ActualizarConfigRepartoDto } from './dto/actualizar-config-reparto.dto';
import { IniciarRutaDto } from './dto/iniciar-ruta.dto';
import { LiberarPedidoDto } from './dto/liberar-pedido.dto';
import { ReasignarPedidoDto } from './dto/reasignar-pedido.dto';
import { AvisosPedidoService, ETAPAS_AVISO } from '../chatbot/servicios/avisos-pedido.service';
import {
  ESTADO_REPROG,
  MOTIVO_RETIRO,
  NUMERO_PREGUNTA_REPROG,
} from '../chatbot/servicios/reprogramacion.service';
import { lineasDeCuenta } from '../pedidos/lineas-combo.util';
import { estadoAreasDePedido } from '../cocina/areas-pedido';
import { efectivoDelPedido } from '../pedidos/pago-plan.service';

export type ColorEsperaReparto = 'VERDE' | 'RETRASADO' | 'TARDE' | 'MUY_TARDE';
export type ColorEspera = 'verde' | 'naranja' | 'rojo' | ColorEsperaReparto;

export interface ParametrosReparto {
  retrasadoMin: number;
  tardeMin: number;
  muyTardeMin: number;
  velocidadKmh: number;
  maxPedidos: number;
  msg3Seg: number;
  localCoords: Coordenadas;
  naranjaMin: number;
  rojoMin: number;
  tomadoSinSalirMin: number;
  esperaMaxMin: number;
  insistenciaMin: number;
}

@Injectable()
export class RepartosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly rutaService: RutaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
    @Optional() private readonly avisos?: AvisosPedidoService,
  ) {}

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
   * Obtiene los parámetros operativos de reparto desde la tabla parametro o defaults.
   * Valores por defecto definidos por el dueño:
   * - Retrasado: 20 min
   * - Tarde: 30 min
   * - Muy tarde: 45 min
   * - Velocidad media: 25 km/h
   * - Máximo de pedidos por repartidor: 3
   */
  async obtenerParametrosReparto(): Promise<ParametrosReparto> {
    let retrasadoMin = 20;
    let tardeMin = 30;
    let muyTardeMin = 45;
    let velocidadKmh = 25;
    let maxPedidos = 5;
    let msg3Seg = 90;
    let tomadoSinSalirMin = 10;
    let esperaMaxMin = 10;
    let insistenciaMin = 3;
    let localCoords = COORDENADAS_LOCAL_DEFAULT;

    try {
      const params = await this.prisma.parametro.findMany({
        where: {
          clave: {
            in: [
              'reparto_retrasado_min',
              'reparto_tarde_min',
              'reparto_muy_tarde_min',
              'reparto_velocidad_kmh',
              'reparto_max_pedidos',
              'reparto_tomado_sin_salir_min',
              'reparto_espera_max_min',
              'reparto_insistencia_min',
              'rep_naranja_min',
              'rep_rojo_min',
              'rep_max_pedidos',
              'rep_msg3_seg',
              'local_lat',
              'local_lng',
              'local_datos',
            ],
          },
        },
      });

      let lat: number | undefined;
      let lng: number | undefined;

      for (const p of params) {
        if (p.clave === 'reparto_retrasado_min' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) retrasadoMin = v;
        }
        if (p.clave === 'reparto_tarde_min' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) tardeMin = v;
        }
        if (p.clave === 'reparto_muy_tarde_min' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) muyTardeMin = v;
        }
        if (p.clave === 'reparto_velocidad_kmh' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) velocidadKmh = v;
        }
        if (p.clave === 'reparto_tomado_sin_salir_min' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) tomadoSinSalirMin = v;
        }
        if (p.clave === 'rep_max_pedidos' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) maxPedidos = v;
        } else if (p.clave === 'reparto_max_pedidos' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) maxPedidos = v;
        }
        if (p.clave === 'reparto_espera_max_min' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v > 0) esperaMaxMin = v;
        }
        if (p.clave === 'reparto_insistencia_min' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v >= 0) insistenciaMin = v;
        }
        if (p.clave === 'rep_msg3_seg' && p.valor != null) {
          const v = Number(p.valor);
          if (!isNaN(v) && v >= 0) msg3Seg = v;
        }
        if (p.clave === 'local_lat' && p.valor != null) {
          lat = Number(p.valor);
        }
        if (p.clave === 'local_lng' && p.valor != null) {
          lng = Number(p.valor);
        }
        if (p.clave === 'local_datos' && p.valor && typeof p.valor === 'object') {
          const d = p.valor as any;
          if (d.lat != null) lat = Number(d.lat);
          if (d.lng != null) lng = Number(d.lng);
        }
      }

      if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
        localCoords = { lat, lng };
      }
    } catch {
      // Fallback a los defaults
    }

    return {
      retrasadoMin,
      tardeMin,
      muyTardeMin,
      velocidadKmh,
      maxPedidos,
      msg3Seg,
      localCoords,
      naranjaMin: tardeMin,
      rojoMin: muyTardeMin,
      tomadoSinSalirMin,
      esperaMaxMin,
      insistenciaMin,
    };
  }

  /**
   * Calcula los minutos transcurridos y el color de espera según umbrales de reparto:
   * VERDE (< retrasadoMin), RETRASADO (amarillo), TARDE (naranja), MUY_TARDE (rojo palpitando).
   */
  calcularMinutosYColor(
    creadoEn: Date,
    ahora: Date = new Date(),
    retrasadoMin = 20,
    tardeMin = 30,
    muyTardeMin = 45,
  ): { minutosEspera: number; color: ColorEsperaReparto } {
    const diffMs = ahora.getTime() - new Date(creadoEn).getTime();
    const minutosEspera = Math.max(0, Math.floor(diffMs / 60000));

    let color: ColorEsperaReparto = 'VERDE';
    if (minutosEspera >= muyTardeMin) {
      color = 'MUY_TARDE';
    } else if (minutosEspera >= tardeMin) {
      color = 'TARDE';
    } else if (minutosEspera >= retrasadoMin) {
      color = 'RETRASADO';
    }

    return { minutosEspera, color };
  }

  /** Solicitud de cambio de cobro PENDIENTE del pedido (si la consulta la incluyó), o null. */
  private cambioCobroPendiente(p: any) {
    const s = Array.isArray(p.solicitudesCambioCobro) ? p.solicitudesCambioCobro.find((x: any) => x.estado === 'PENDIENTE') : null;
    return s
      ? {
          id: String(s.id),
          plan_solicitado: s.plan_solicitado,
          plan_original: s.plan_original,
          paga_con: s.paga_con != null ? Number(s.paga_con) : null,
          solicitado_en: s.solicitado_en,
        }
      : null;
  }

  /**
   * Mapea un pedido al formato de salida requerido para las vistas de reparto.
   */
  private formatearPedidoReparto(
    p: any,
    config: ParametrosReparto,
    ahora: Date = new Date(),
    usuarioActual?: UsuarioAutenticado,
  ) {
    const { minutosEspera, color } = this.calcularMinutosYColor(
      p.creado_en,
      ahora,
      config.retrasadoMin,
      config.tardeMin,
      config.muyTardeMin,
    );

    // Con crédito del personal + delivery el repartidor cobra solo el envío (total - monto_credito)
    const totalNum = montoACobrar(p);
    // Plan de pago (pago dividido o cambio aprobado en la puerta): el efectivo a cobrar es el renglón EFECTIVO
    const planPago: Array<{ medio: string; monto: number }> = Array.isArray(p.planPago)
      ? p.planPago.map((f: any) => ({ medio: f.medio, monto: Number(f.monto) }))
      : [];
    const efectivoCobrar = p.pago_estado === 'PAGADO' ? 0 : efectivoDelPedido(planPago, p.pago_metodo, totalNum);
    const cobroPendienteEfectivo = efectivoCobrar > 0;

    const pagaConNum = p.paga_con != null ? Number(p.paga_con) : null;
    const baseVuelto = efectivoCobrar > 0 ? efectivoCobrar : totalNum;
    const vuelto =
      pagaConNum != null && pagaConNum > baseVuelto
        ? Number((pagaConNum - baseVuelto).toFixed(2))
        : 0;

    const cobro = p.pago_estado === 'PAGADO' ? 0 : totalNum;

    // Alerta ámbar para Caja/Admin: pedido tomado que no sale en N minutos
    let alertaTomadoSinSalir = false;
    let minutosSinSalir = 0;
    if (p.tomado_en != null && p.salio_en == null && p.estado === 'LISTO') {
      const diffMs = ahora.getTime() - new Date(p.tomado_en).getTime();
      minutosSinSalir = Math.max(0, Math.floor(diffMs / 60000));
      if (minutosSinSalir >= (config.tomadoSinSalirMin ?? 10)) {
        alertaTomadoSinSalir = true;
      }
    }

    // Cantidad total de productos en el pedido
    const cantidadProductos = Array.isArray(p.lineas)
      ? lineasDeCuenta(p.lineas).reduce((acc: number, l: any) => acc + (Number(l.cantidad) || 0), 0)
      : (p._count?.lineas ?? 0);

    // Regla de privacidad: el teléfono completo del cliente SOLO se muestra después de tomar el pedido.
    // Si el usuario es REPARTIDOR y el pedido aún no está tomado por él, el teléfono se oculta (null).
    let clienteTelefono: string | null = p.cliente_telefono ?? null;
    const esRepartidor = usuarioActual?.rol === 'REPARTIDOR';
    const esMio =
      p.repartidor_party_id != null &&
      usuarioActual?.partyId != null &&
      BigInt(p.repartidor_party_id) === BigInt(usuarioActual.partyId);

    if (esRepartidor && !esMio) {
      clienteTelefono = null;
    }
    // El MOZO solo sigue el delivery (repartos/seguir): nunca ve el teléfono del cliente
    if (usuarioActual?.rol === 'MOZO') {
      clienteTelefono = null;
    }

    // Espera en puerta: minutos desde la llegada y si ya superó la espera máxima (aviso en pantalla del repartidor)
    const esperaMin =
      p.estado === 'EN_CAMINO' && p.llego_en && p.entregado_en == null
        ? Math.floor((ahora.getTime() - new Date(p.llego_en).getTime()) / 60000)
        : null;
    const esperaAgotada = esperaMin != null && esperaMin >= config.esperaMaxMin;

    // Check «Cocina»: áreas que participan y cuáles ya están listas (solo si la consulta trajo comandas)
    const cocina = Array.isArray(p.comandas) ? estadoAreasDePedido(p.comandas, p.lineas ?? []) : null;

    return {
      ...(cocina
        ? {
            areas: cocina.areas.map(({ nLineas: _n, ...a }) => a),
            areasListas: cocina.areasListas,
            areasTotal: cocina.areasTotal,
            completo: cocina.completo,
          }
        : {}),
      espera_min: esperaMin,
      espera_max_min: config.esperaMaxMin,
      espera_agotada: esperaAgotada,
      id: String(p.id),
      codigo: p.codigo,
      modalidad: p.modalidad,
      estado: p.estado,
      cliente_nombre: p.cliente_nombre,
      cliente_telefono: clienteTelefono,
      direccion: p.entrega_direccion,
      referencia: p.entrega_referencia,
      // Último cambio de ubicación (insignia «Dirección editada» en la tarjeta del repartidor y de Caja)
      ubicacion_editada_en: p.ubicacion_editada_en ?? null,
      lat: p.entrega_lat != null ? Number(p.entrega_lat) : null,
      lng: p.entrega_lng != null ? Number(p.entrega_lng) : null,
      coordenadas:
        p.entrega_lat != null && p.entrega_lng != null
          ? { lat: Number(p.entrega_lat), lng: Number(p.entrega_lng) }
          : null,
      zona: p.zona?.codigo ?? null,
      zona_id: p.zona_id ? String(p.zona_id) : null,
      minutosEspera,
      color,
      total: totalNum,
      total_venta: Number(p.total),
      monto_credito: Number(p.monto_credito ?? 0),
      cobro,
      pago_estado: p.pago_estado,
      pago_metodo: p.pago_metodo,
      cobro_pendiente_efectivo: cobroPendienteEfectivo,
      cobroPendienteEfectivo,
      /** Efectivo que debe cobrar el repartidor en la puerta (0 si ya está pagado o es digital) */
      efectivo_cobrar: efectivoCobrar,
      plan_pago: planPago,
      /** Solicitud de cambio de forma de pago esperando a Caja (el pedido no se puede entregar hasta que se resuelva) */
      cambio_cobro_pendiente: this.cambioCobroPendiente(p),
      paga_con: pagaConNum,
      vuelto,
      cantidad_productos: cantidadProductos,
      cantidadProductos,
      repartidor_party_id: p.repartidor_party_id ? String(p.repartidor_party_id) : null,
      tomado_en: p.tomado_en,
      salio_en: p.salio_en,
      llego_en: p.llego_en,
      entregado_en: p.entregado_en,
      motivo_falla: p.motivo_falla,
      alerta_tomado_sin_salir: alertaTomadoSinSalir,
      minutos_sin_salir: minutosSinSalir,
      creado_en: p.creado_en,
    };
  }

  /**
   * 1) GET /admin/repartos/disponibles (repartos/ver):
   * Pedidos DELIVERY en estado LISTO sin repartidor, con posición, zona, minutos de espera,
   * color (verde/naranja/rojo), dirección, total, cobro pendiente en efectivo y paga_con.
   */
  async listarDisponibles(usuario?: UsuarioAutenticado) {
    const config = await this.obtenerParametrosReparto();
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        repartidor_party_id: null,
        motivo_falla: null,
      },
      include: {
        zona: true,
        lineas: { select: LINEAS_AREAS },
        ...INCLUDE_COBRO,
        mensajesReparto: { where: { numero: NUMERO_PREGUNTA_REPROG, estado: ESTADO_REPROG.REPROGRAMADO }, select: { numero: true } },
      },
      orderBy: { creado_en: 'asc' },
    });

    const ahora = new Date();
    // Marca "Reprogramado": el pedido volvió a reparto tras la confirmación del cliente
    return pedidos.map((p) => ({
      ...this.formatearPedidoReparto(p, config, ahora, usuario),
      reprogramado: (p.mensajesReparto?.length ?? 0) > 0,
    }));
  }

  /**
   * 1) GET /admin/repartos/mios (repartos/ver):
   * Pedidos del repartidor logueado en LISTO/EN_CAMINO con la ruta sugerida.
   * Devuelve { pedidos, orden: [ids], paso: [ids], ruta: [[lat,lng]...] }
   */
  /** Avisos para la pantalla del repartidor: movilidades retiradas por espera agotada (últimas 2 horas). */
  private async avisosRetiro(partyId: bigint) {
    try {
      const filas = await this.prisma.pedidoEstadoHistorial.findMany({
        where: {
          por_party_id: partyId,
          motivo: 'Retiro por espera agotada',
          en: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
        },
        include: { pedido: { select: { codigo: true } } },
        orderBy: { en: 'desc' },
        take: 10,
      });
      return filas.map((f) => ({
        pedido_id: String(f.pedido_id),
        codigo: f.pedido.codigo,
        mensaje: `Se retiró la movilidad del pedido ${f.pedido.codigo} por espera agotada. El pedido quedó reprogramado.`,
        en: f.en,
      }));
    } catch {
      return [];
    }
  }

  async listarMios(usuario: UsuarioAutenticado) {
    const config = await this.obtenerParametrosReparto();
    const partyId = BigInt(usuario.partyId);

    // Si un pedido asignado a este repartidor fue anulado o regresó a cocina antes de salir, se libera la asignación
    await this.prisma.pedido.updateMany({
      where: {
        repartidor_party_id: partyId,
        salio_en: null,
        OR: [
          { estado: { in: ['ANULADO', 'COLA', 'PREPARANDO'] } },
          { anulado_en: { not: null } },
        ],
      },
      data: {
        repartidor_party_id: null,
        tomado_en: null,
        ruta_reparto_id: null,
      },
    });
    await sincronizarRuta(this.prisma, partyId);

    const pedidosPropios = await this.prisma.pedido.findMany({
      where: {
        repartidor_party_id: partyId,
        estado: { in: ['LISTO', 'EN_CAMINO'] },
      },
      include: {
        zona: true,
        lineas: { select: LINEAS_AREAS },
        ...INCLUDE_COBRO,
      },
      orderBy: { creado_en: 'asc' },
    });

    const pedidosDisponibles = await this.prisma.pedido.findMany({
      where: {
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        repartidor_party_id: null,
        motivo_falla: null,
        entrega_lat: { not: null },
        entrega_lng: { not: null },
      },
      include: {
        zona: true,
        lineas: { select: LINEAS_AREAS },
        ...INCLUDE_COBRO,
      },
      orderBy: { creado_en: 'asc' },
    });

    const ahora = new Date();
    const propiosFormateados = pedidosPropios.map((p) => ({
      ...this.formatearPedidoReparto(p, config, ahora, usuario),
      ordenRuta: p.orden_ruta ?? null,
      numeroRuta: p.numero_ruta ?? null,
    }));

    const inputPropios: PedidoRutaInput[] = pedidosPropios
      .filter((p) => p.entrega_lat != null && p.entrega_lng != null)
      .map((p) => ({
        id: String(p.id),
        codigo: p.codigo,
        lat: Number(p.entrega_lat),
        lng: Number(p.entrega_lng),
        minutosEspera: this.calcularMinutosYColor(
          p.creado_en,
          ahora,
          config.retrasadoMin,
          config.tardeMin,
          config.muyTardeMin,
        ).minutosEspera,
        zona: p.zona?.codigo ?? null,
      }));

    const inputDisponibles: PedidoRutaInput[] = pedidosDisponibles.map((p) => ({
      id: String(p.id),
      codigo: p.codigo,
      lat: Number(p.entrega_lat),
      lng: Number(p.entrega_lng),
      minutosEspera: this.calcularMinutosYColor(
        p.creado_en,
        ahora,
        config.retrasadoMin,
        config.tardeMin,
        config.muyTardeMin,
      ).minutosEspera,
      zona: p.zona?.codigo ?? null,
    }));

    const rutaCalculada = this.rutaService.calcularRuta(
      inputPropios,
      inputDisponibles,
      config.localCoords,
      {
        retrasadoMin: config.retrasadoMin,
        tardeMin: config.tardeMin,
        muyTardeMin: config.muyTardeMin,
      },
      config.maxPedidos,
      config.velocidadKmh,
    );

    // Asegurar que todos los pedidos propios aparezcan en el orden (incluso si alguno no tiene coordenadas)
    const ordenCompleto = [...rutaCalculada.orden];
    for (const p of pedidosPropios) {
      const idStr = String(p.id);
      if (!ordenCompleto.includes(idStr)) {
        ordenCompleto.push(idStr);
      }
    }

    return {
      pedidos: propiosFormateados,
      // Ruta en curso con TODOS sus pedidos (también los ya entregados, fallidos o anulados)
      // (`ruta` ya es la línea del trazado; por eso este campo se llama rutaReparto)
      rutaReparto: await this.rutaEnCurso(partyId, config, ahora, usuario),
      avisos: await this.avisosRetiro(partyId),
      orden: ordenCompleto,
      paso: rutaCalculada.paso,
      ruta: rutaCalculada.ruta,
      totalParadas: propiosFormateados.length,
      distanciaKm: rutaCalculada.distanciaKm,
      tiempoMin: rutaCalculada.tiempoMin,
      velocidadKmh: rutaCalculada.velocidadKmh,
    };
  }

  /** Ruta EN_CURSO del repartidor con todos sus pedidos (pendientes y ya terminados), o null si no tiene. */
  private async rutaEnCurso(partyId: bigint, config: ParametrosReparto, ahora: Date, usuario: UsuarioAutenticado) {
    const ruta = await this.prisma.rutaReparto.findFirst({
      where: { repartidor_party_id: partyId, estado: 'EN_CURSO' },
      orderBy: { id: 'desc' },
    });
    if (!ruta) return null;
    const filas = await this.pedidosDeRuta([ruta.id]);
    return {
      id: String(ruta.id),
      iniciadaEn: ruta.iniciada_en,
      estado: ruta.estado,
      pedidos: this.ordenarPedidosRuta(filas, partyId).map((p) => ({
        ...this.formatearPedidoReparto(p, config, ahora, usuario),
        ordenRuta: p.orden_ruta ?? null,
        numeroRuta: p.numero_ruta ?? null,
        estadoFinal: p.estadoFinal,
        horaFinal: p.horaFinal,
        orden: p.orden,
      })),
    };
  }

  private pedidosDeRuta(rutaIds: bigint[]) {
    return this.prisma.pedido.findMany({
      where: { ruta_reparto_id: { in: rutaIds } },
      include: {
        zona: true,
        lineas: { select: LINEAS_AREAS },
        ...INCLUDE_COBRO,
        incidentes: { orderBy: { en: 'desc' }, take: 1, select: { en: true } },
      },
    });
  }

  /** Primero los ya terminados por hora de cierre, luego los pendientes por orden_ruta; `orden` es la posición en la ruta. */
  private ordenarPedidosRuta(filas: any[], partyId: bigint) {
    const conEstado = filas.map((p) => {
      const estadoFinal = estadoFinalEnRuta(p, partyId);
      return { ...p, estadoFinal, horaFinal: horaFinalPedido(p, estadoFinal) };
    });
    const t = (d: Date | null) => (d ? new Date(d).getTime() : Infinity);
    conEstado.sort((a, b) => {
      if ((a.estadoFinal == null) !== (b.estadoFinal == null)) return a.estadoFinal == null ? 1 : -1;
      if (a.estadoFinal != null) return t(a.horaFinal) - t(b.horaFinal) || Number(a.id - b.id);
      return (a.orden_ruta ?? Infinity) - (b.orden_ruta ?? Infinity) || Number(a.id - b.id);
    });
    return conEstado.map((p, i) => ({ ...p, orden: i + 1 }));
  }

  /** Suma en línea recta sede -> paradas en orden (km, aproximada). */
  private distanciaRutaKm(paradas: any[], sede: Coordenadas): number {
    let km = 0;
    let ant = sede;
    for (const p of paradas) {
      if (p.entrega_lat == null || p.entrega_lng == null) continue;
      const act = { lat: Number(p.entrega_lat), lng: Number(p.entrega_lng) };
      km += this.rutaService.haversineKm(ant.lat, ant.lng, act.lat, act.lng);
      ant = act;
    }
    return Math.round(km * 10) / 10;
  }

  /**
   * GET /admin/repartos/mis-rutas (solo el repartidor, sus rutas) y /admin/repartos/rutas (caja/admin).
   * Rutas agrupadas con sus pedidos en orden; por defecto hoy (hora de Lima), 20 por página.
   * Sin montos: solo código, cliente, estado final y hora.
   */
  async listarRutas(filtros: FiltrarRutasDto, usuario: UsuarioAutenticado, soloPropias = false) {
    const esRepartidor = usuario.rol === 'REPARTIDOR' || soloPropias;
    const where: Prisma.RutaRepartoWhereInput = {};
    if (esRepartidor) {
      // Aislamiento: el repartidor solo ve las suyas, ignore el filtro que mande
      where.repartidor_party_id = BigInt(usuario.partyId);
      await sincronizarRuta(this.prisma, BigInt(usuario.partyId));
    } else if (filtros.repartidor) {
      if (!/^\d+$/.test(filtros.repartidor)) {
        throw new BadRequestException({ codigo: 'REPARTIDOR_INVALIDO', mensaje: 'Repartidor no válido' });
      }
      where.repartidor_party_id = BigInt(filtros.repartidor);
    }
    const hoy = hoyLima();
    const { inicio, fin } = limitesDiaLima(filtros.desde ?? hoy, filtros.hasta ?? filtros.desde ?? hoy);
    where.iniciada_en = { gte: inicio, lte: fin };

    const limite = 20;
    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const [total, rutas, config] = await Promise.all([
      this.prisma.rutaReparto.count({ where }),
      this.prisma.rutaReparto.findMany({
        where,
        orderBy: { iniciada_en: 'desc' },
        skip: (pagina - 1) * limite,
        take: limite,
        include: { repartidor: { include: { persona: true } } },
      }),
      this.obtenerParametrosReparto(),
    ]);
    const filas = rutas.length ? await this.pedidosDeRuta(rutas.map((r) => r.id)) : [];

    return {
      rutas: rutas.map((r) => {
        const pedidos = this.ordenarPedidosRuta(
          filas.filter((p) => p.ruta_reparto_id === r.id),
          r.repartidor_party_id,
        );
        const per = r.repartidor?.persona;
        return {
          id: String(r.id),
          repartidorId: String(r.repartidor_party_id),
          repartidorNombre: per ? `${per.nombres} ${per.apellidos ?? ''}`.trim() : `Repartidor #${r.repartidor_party_id}`,
          iniciadaEn: r.iniciada_en,
          terminadaEn: r.terminada_en,
          estado: r.estado,
          totalPedidos: pedidos.length,
          entregados: pedidos.filter((p) => p.estadoFinal === 'ENTREGADO').length,
          fallidos: pedidos.filter((p) => p.estadoFinal === 'NO_ENTREGADO' || p.estadoFinal === 'ANULADO').length,
          distanciaKm: this.distanciaRutaKm(pedidos, config.localCoords),
          pedidos: pedidos.map((p) => ({
            id: String(p.id),
            codigo: p.codigo,
            clienteNombre: p.cliente_nombre ?? null,
            direccion: p.entrega_direccion ?? null,
            lat: p.entrega_lat != null ? Number(p.entrega_lat) : null,
            lng: p.entrega_lng != null ? Number(p.entrega_lng) : null,
            estadoFinal: p.estadoFinal,
            horaFinal: p.horaFinal,
            orden: p.orden,
            numeroRuta: p.numero_ruta ?? null,
          })),
        };
      }),
      pagina,
      limite,
      total,
      totalPaginas: Math.max(1, Math.ceil(total / limite)),
    };
  }

  /**
   * 1) GET /admin/repartos?repartidor= (repartos/ver):
   * Si el usuario es REPARTIDOR, ve ÚNICA Y EXCLUSIVAMENTE sus pedidos asignados.
   * Caja y admin ven todos los repartidores y pedidos filtrables.
   */
  async listarTodos(filtros: FiltrarRepartosDto, usuario?: UsuarioAutenticado) {
    const config = await this.obtenerParametrosReparto();
    const where: Prisma.PedidoWhereInput = {
      modalidad: 'DELIVERY',
    };

    if (usuario && usuario.rol === 'REPARTIDOR') {
      const miPartyId = BigInt(usuario.partyId);
      where.repartidor_party_id = miPartyId;
    } else if (filtros.repartidor) {
      try {
        where.repartidor_party_id = BigInt(filtros.repartidor);
      } catch {
        // Ignora si no es numérico
      }
    }

    // Por defecto solo pedidos activos de reparto (listos o en camino). Anulados, entregados
    // y demás estados quedan fuera salvo que se pida el estado o el historial explícitamente.
    if (filtros.estado) {
      where.estado = filtros.estado;
    } else if (filtros.historial !== 'true') {
      where.estado = { in: [...ESTADOS_ACTIVOS_REPARTO] };
    }

    const pedidos = await this.prisma.pedido.findMany({
      where,
      include: {
        zona: true,
        lineas: { select: LINEAS_AREAS },
        ...INCLUDE_COBRO,
        repartidor: {
          include: {
            persona: true,
          },
        },
        mensajesReparto: {
          where: { numero: NUMERO_PREGUNTA_REPROG, estado: { in: [ESTADO_REPROG.REPROGRAMAR, ESTADO_REPROG.REPROGRAMADO] } },
          select: { estado: true },
        },
        incidentes: {
          where: { cierre: null, motivo: MOTIVO_RETIRO },
          orderBy: { en: 'desc' },
          take: 1,
          select: { recargo: true },
        },
      },
      orderBy: { creado_en: 'desc' },
    });

    const ahora = new Date();
    return pedidos.map((p) => {
      let repartidorNombre: string | null = null;
      if (p.repartidor) {
        if (p.repartidor.persona) {
          repartidorNombre = `${p.repartidor.persona.nombres} ${p.repartidor.persona.apellidos || ''}`.trim();
        } else {
          repartidorNombre = `Repartidor #${p.repartidor.id}`;
        }
      }

      return {
        ...this.formatearPedidoReparto(p, config, ahora, usuario),
        // POR_REPROGRAMAR: el cliente dijo SÍ y falta reenviar; REPROGRAMADO: ya volvió a reparto
        reprogramacion:
          p.mensajesReparto?.[0]?.estado === ESTADO_REPROG.REPROGRAMAR
            ? 'POR_REPROGRAMAR'
            : p.mensajesReparto?.[0]?.estado === ESTADO_REPROG.REPROGRAMADO
              ? 'REPROGRAMADO'
              : null,
        // Monto que cobra el reenvío (el mismo que vio el cliente); Caja lo ve junto al botón
        recargoReprogramacion:
          p.mensajesReparto?.[0]?.estado === ESTADO_REPROG.REPROGRAMAR && p.incidentes?.[0]?.recargo != null
            ? Number(p.incidentes[0].recargo)
            : null,
        repartidor: p.repartidor
          ? {
              id: String(p.repartidor.id),
              nombre: repartidorNombre,
            }
          : null,
      };
    });
  }

  /**
   * 2) GET /admin/repartos/config (repartos/ver):
   * Devuelve los parámetros operativos de reparto vigentes (umbrales, velocidad, límite y coordenadas).
   */
  async obtenerConfig() {
    const config = await this.obtenerParametrosReparto();
    return {
      retrasadoMin: config.retrasadoMin,
      tardeMin: config.tardeMin,
      muyTardeMin: config.muyTardeMin,
      velocidadKmh: config.velocidadKmh,
      maxPedidos: config.maxPedidos,
      localCoords: config.localCoords,
    };
  }

  /**
   * PUT /admin/repartos/config (configuracion/editar):
   * Actualiza umbrales y parámetros de reparto con validación de orden ascendente y rangos,
   * y registra auditoría de cambio por parámetro.
   */
  async actualizarConfig(
    dto: ActualizarConfigRepartoDto,
    usuarioActual?: UsuarioAutenticado,
    ip?: string,
  ) {
    const actual = await this.obtenerParametrosReparto();

    const nuevoRetrasado = dto.retrasadoMin ?? actual.retrasadoMin;
    const nuevoTarde = dto.tardeMin ?? actual.tardeMin;
    const nuevoMuyTarde = dto.muyTardeMin ?? actual.muyTardeMin;
    const nuevoVelocidad = dto.velocidadKmh ?? actual.velocidadKmh;
    const nuevoMaxPedidos = dto.maxPedidos ?? actual.maxPedidos;

    // Validación de orden ascendente estricto
    if (!(nuevoRetrasado < nuevoTarde && nuevoTarde < nuevoMuyTarde)) {
      throw new BadRequestException({
        codigo: 'ORDEN_UMBRALES_INVALIDO',
        mensaje:
          'Los umbrales deben estar en orden ascendente (retrasado < tarde < muy tarde)',
      });
    }

    // Validación de rangos razonables
    if (nuevoRetrasado < 1 || nuevoRetrasado > 180) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'El umbral retrasado debe estar entre 1 y 180 minutos',
      });
    }
    if (nuevoTarde < 2 || nuevoTarde > 240) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'El umbral tarde debe estar entre 2 y 240 minutos',
      });
    }
    if (nuevoMuyTarde < 3 || nuevoMuyTarde > 360) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'El umbral muy tarde debe estar entre 3 y 360 minutos',
      });
    }
    if (nuevoVelocidad < 5 || nuevoVelocidad > 100) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'La velocidad media debe estar entre 5 y 100 km/h',
      });
    }
    if (nuevoMaxPedidos < 1 || nuevoMaxPedidos > 20) {
      throw new BadRequestException({
        codigo: 'RANGO_INVALIDO',
        mensaje: 'El máximo de pedidos por repartidor debe estar entre 1 y 20',
      });
    }

    const updates: Array<{ clave: string; valor: number }> = [];
    if (dto.retrasadoMin !== undefined) {
      updates.push({ clave: 'reparto_retrasado_min', valor: dto.retrasadoMin });
    }
    if (dto.tardeMin !== undefined) {
      updates.push({ clave: 'reparto_tarde_min', valor: dto.tardeMin });
    }
    if (dto.muyTardeMin !== undefined) {
      updates.push({ clave: 'reparto_muy_tarde_min', valor: dto.muyTardeMin });
    }
    if (dto.velocidadKmh !== undefined) {
      updates.push({ clave: 'reparto_velocidad_kmh', valor: dto.velocidadKmh });
    }
    if (dto.maxPedidos !== undefined) {
      updates.push({ clave: 'reparto_max_pedidos', valor: dto.maxPedidos });
      updates.push({ clave: 'rep_max_pedidos', valor: dto.maxPedidos });
    }

    for (const u of updates) {
      const anterior = await this.prisma.parametro.findUnique({
        where: { clave: u.clave },
      });

      await this.prisma.parametro.upsert({
        where: { clave: u.clave },
        create: { clave: u.clave, valor: u.valor },
        update: { valor: u.valor },
      });

      await this.auditoria.registrar({
        categoria: 'CAMBIO',
        modulo: 'configuracion',
        accion: 'PARAMETRO',
        resultado: 'OK',
        entidad: 'parametro',
        antes: anterior ? { clave: u.clave, valor: anterior.valor } : null,
        despues: { clave: u.clave, valor: u.valor },
        partyId: usuarioActual?.partyId ? BigInt(usuarioActual.partyId) : undefined,
        ip,
      });
    }

    return this.obtenerConfig();
  }

  /**
   * 4) GET /admin/repartos/zonas (repartos/ver):
   * Devuelve las zonas de reparto registradas en BD con código, nombre, tarifa, activa,
   * polígono y centroide calculado (sin inventar datos).
   */
  async listarZonas() {
    const zonas = await this.prisma.zonaReparto.findMany({
      orderBy: { codigo: 'asc' },
    });

    return zonas.map((z) => {
      const poligono = (Array.isArray(z.poligono) ? z.poligono : []) as [number, number][];

      let centro: [number, number] | null = null;
      if (poligono.length > 0) {
        let sumLat = 0;
        let sumLng = 0;
        for (const p of poligono) {
          sumLat += Number(p[0]);
          sumLng += Number(p[1]);
        }
        centro = [
          Number((sumLat / poligono.length).toFixed(6)),
          Number((sumLng / poligono.length).toFixed(6)),
        ];
      }

      return {
        id: String(z.id),
        codigo: z.codigo,
        nombre: `Zona ${z.codigo}`,
        tarifa: Number(z.tarifa),
        activa: z.activa,
        puntos: poligono.length,
        poligono,
        centro,
      };
    });
  }

  /**
   * 4) GET /admin/repartos/resumen (repartos/ver):
   * Conteo por lado (Norte, Sur, Este, Oeste respecto del local) y por zona.
   */
  async obtenerResumen(usuario?: UsuarioAutenticado) {
    if (usuario && usuario.rol === 'REPARTIDOR') {
      return {
        lados: { Norte: 0, Sur: 0, Este: 0, Oeste: 0 },
        zonas: {},
        total: 0,
      };
    }
    const config = await this.obtenerParametrosReparto();
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        repartidor_party_id: null,
        motivo_falla: null,
        entrega_lat: { not: null },
        entrega_lng: { not: null },
      },
      include: {
        zona: true,
      },
    });

    const puntos = pedidos.map((p) => ({
      lat: Number(p.entrega_lat),
      lng: Number(p.entrega_lng),
      zona: p.zona?.codigo ?? null,
    }));

    return this.rutaService.calcularLadosYZonas(puntos, config.localCoords);
  }

  /**
   * GET /admin/repartos/contadores (repartos/ver o seguir, nunca REPARTIDOR): cuántos pedidos de delivery hay
   * por etapa, con las mismas secciones del seguimiento. Sin listas: solo estado y repartidor de los vivos.
   * enCocina = aceptados y preparándose; listos = ya despachados por cocina sin repartidor;
   * enCamino = con repartidor (LISTO o EN_CAMINO); pendientes = suma de las tres; entregadosHoy = hora de Lima.
   * Los anulados y los que tienen falla quedan fuera (van a incidentes).
   */
  async contadoresDelivery(usuario: UsuarioAutenticado) {
    if (usuario.rol === 'REPARTIDOR') {
      throw new ForbiddenException({
        codigo: 'SOLO_CAJA_ADMIN',
        mensaje: 'Los contadores de delivery no son para repartidores',
      });
    }
    const { inicio } = limitesDiaLima(hoyLima(), hoyLima());
    const [vivos, entregadosHoy] = await Promise.all([
      this.prisma.pedido.findMany({
        where: { modalidad: 'DELIVERY', estado: { in: ['COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO'] }, motivo_falla: null },
        select: { estado: true, repartidor_party_id: true },
      }),
      this.prisma.pedido.count({ where: { modalidad: 'DELIVERY', estado: 'ENTREGADO', entregado_en: { gte: inicio } } }),
    ]);
    let enCocina = 0;
    let listos = 0;
    let enCamino = 0;
    for (const p of vivos) {
      if (p.estado === 'COLA' || p.estado === 'PREPARANDO') enCocina++;
      else if (p.repartidor_party_id == null) listos++;
      else enCamino++;
    }
    return { enCocina, listos, enCamino, pendientes: enCocina + listos + enCamino, entregadosHoy };
  }

  /**
   * GET /admin/repartos/panel (repartos/ver, nunca REPARTIDOR):
   * Repartidores activos con los pedidos que llevan (etapa, horas, espera y efectivo por rendir)
   * y los pedidos sin tomar, más el resumen de libres y ocupados. Reutiliza listarTodos.
   */
  async obtenerPanelRepartidores(usuario: UsuarioAutenticado) {
    if (usuario.rol === 'REPARTIDOR') {
      throw new ForbiddenException({
        codigo: 'SOLO_CAJA_ADMIN',
        mensaje: 'El panel de repartidores no es para repartidores',
      });
    }

    const config = await this.obtenerParametrosReparto();
    const [cuentas, activos] = await Promise.all([
      this.prisma.userAccount.findMany({
        where: { rol: 'REPARTIDOR', activo: true },
        include: { party: { include: { persona: true } } },
        orderBy: { id: 'asc' },
      }),
      this.listarTodos({}, usuario),
    ]);
    // Un ADMIN que tomó pedidos reparte como uno más: aparece con su nombre y «(admin)» mientras los lleve
    const idsConPedidos = [...new Set(activos.map((p) => p.repartidor_party_id).filter((x) => x != null))].map((x) => BigInt(x as string));
    const cuentasAdmin = idsConPedidos.length
      ? (
          await this.prisma.userAccount.findMany({
            where: { rol: 'ADMIN', party_id: { in: idsConPedidos } },
            include: { party: { include: { persona: true } } },
          })
        ).filter((c: any) => c.rol === 'ADMIN')
      : [];
    const esAdminParty = new Set(cuentasAdmin.map((c: any) => String(c.party_id)));

    const etapaDe = (p: any) => (p.llego_en ? 'LLEGADO' : p.salio_en ? 'EN_CAMINO' : 'TOMADO');
    const porRepartidor = new Map<string, any[]>();
    const sinTomar: any[] = [];
    for (const p of activos) {
      if (p.repartidor_party_id == null) {
        if (p.estado === 'LISTO' && p.motivo_falla == null) sinTomar.push(p);
        continue;
      }
      const lista = porRepartidor.get(p.repartidor_party_id) ?? [];
      lista.push({ ...p, etapa: etapaDe(p) });
      porRepartidor.set(p.repartidor_party_id, lista);
    }

    const nombreCuenta = (c: any) =>
      c.party?.persona
        ? `${c.party.persona.nombres} ${c.party.persona.apellidos || ''}`.trim()
        : `Repartidor #${c.party_id}`;
    const cuentaPorParty = new Map([...cuentas, ...cuentasAdmin].map((c: any) => [String(c.party_id), c]));
    // Repartidores con pedidos vivos aunque ya no estén activos: se muestran para no perderlos de vista
    const partyIds = new Set([...cuentaPorParty.keys(), ...porRepartidor.keys()]);

    const repartidores = [...partyIds].map((partyId) => {
      const cuenta = cuentaPorParty.get(partyId);
      const pedidos = (porRepartidor.get(partyId) ?? []).sort(
        (a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime(),
      );
      const efectivoPorRendir = pedidos.reduce(
        (acc, p) => acc + (p.cobro_pendiente_efectivo ? p.efectivo_cobrar ?? p.total : 0),
        0,
      );
      const nombre =
        cuenta != null
          ? nombreCuenta(cuenta)
          : pedidos[0]?.repartidor?.nombre ?? `Repartidor #${partyId}`;
      const esAdmin = esAdminParty.has(partyId);
      return {
        party_id: partyId,
        nombre: esAdmin ? `${nombre} (admin)` : nombre,
        es_admin: esAdmin,
        libre: pedidos.length === 0,
        pedidos,
        efectivo_por_rendir: Number(efectivoPorRendir.toFixed(2)),
      };
    });
    repartidores.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

    return {
      generado_en: new Date().toISOString(),
      max_pedidos: config.maxPedidos,
      resumen: {
        repartidores_libres: repartidores.filter((r) => r.libre).length,
        repartidores_ocupados: repartidores.filter((r) => !r.libre).length,
        pedidos_sin_tomar: sinTomar.length,
      },
      repartidores,
      sin_tomar: sinTomar.sort(
        (a, b) => new Date(a.creado_en).getTime() - new Date(b.creado_en).getTime(),
      ),
    };
  }

  /**
   * GET /admin/repartos/seguimiento (repartos/ver o repartos/seguir, nunca REPARTIDOR):
   * todos los pedidos DELIVERY de hoy (hora de Lima) en cualquier estado, más los que siguen vivos
   * de días anteriores, cada uno con su sección, para saber qué lleva y entrega cada quien.
   */
  async listarSeguimiento(usuario: UsuarioAutenticado) {
    if (usuario.rol === 'REPARTIDOR') {
      throw new ForbiddenException({
        codigo: 'SOLO_CAJA_ADMIN',
        mensaje: 'El seguimiento de repartos no es para repartidores',
      });
    }
    const config = await this.obtenerParametrosReparto();
    const { inicio } = limitesDiaLima(hoyLima(), hoyLima());
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        modalidad: 'DELIVERY',
        OR: [
          { creado_en: { gte: inicio } },
          { entregado_en: { gte: inicio } },
          { estado: { in: [...ESTADOS_ACTIVOS_REPARTO] } },
        ],
      },
      include: {
        zona: true,
        lineas: { select: LINEAS_AREAS },
        ...INCLUDE_COBRO,
        repartidor: { include: { persona: true } },
      },
      orderBy: { creado_en: 'desc' },
      take: 500, // ponytail: tope por rendimiento; un día de delivery no llega ni a la mitad
    });
    const ahora = new Date();
    const seccionDe = (p: any) => {
      if (p.estado === 'ENTREGADO') return 'ENTREGADOS';
      if (p.estado === 'ANULADO' || p.motivo_falla != null) return 'INCIDENTE';
      if (p.estado === 'LISTO' || p.estado === 'EN_CAMINO') return p.repartidor_party_id == null ? 'ESPERANDO' : 'EN_CAMINO';
      return 'PREPARACION';
    };
    return {
      generado_en: ahora.toISOString(),
      pedidos: pedidos.map((p: any) => ({
        ...this.formatearPedidoReparto(p, config, ahora, usuario),
        seccion: seccionDe(p),
        etapa: p.llego_en ? 'LLEGADO' : p.salio_en ? 'EN_CAMINO' : p.tomado_en ? 'TOMADO' : null,
        repartidor: p.repartidor
          ? {
              id: String(p.repartidor.id),
              nombre: p.repartidor.persona
                ? `${p.repartidor.persona.nombres} ${p.repartidor.persona.apellidos || ''}`.trim()
                : `Repartidor #${p.repartidor.id}`,
            }
          : null,
      })),
    };
  }

  /**
   * 2) POST /admin/repartos/:id/tomar (repartos/tomar):
   * Asigna repartidor_party_id = usuario, tomado_en = ahora.
   * Límite rep_max_pedidos (3): 409 LIMITE_PEDIDOS «Ya llevas 3 pedidos: entrega alguno antes de tomar otro».
   * Concurrencia atómica: si otro lo tomó antes -> 409 YA_TOMADO.
   */
  async tomarPedido(
    id: string | bigint,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();

    // 1. Validar límite de pedidos simultáneos
    const pedidosActivos = await this.prisma.pedido.count({
      where: {
        repartidor_party_id: partyId,
        estado: { in: ['LISTO', 'EN_CAMINO'] },
      },
    });

    if (pedidosActivos >= config.maxPedidos) {
      throw new ConflictException({
        codigo: 'LIMITE_PEDIDOS',
        mensaje: `Ya llevas ${config.maxPedidos} pedidos: entrega alguno antes de tomar otro`,
      });
    }

    const ahora = new Date();

    // 2. Actualización condicional atómica para evitar colisiones concurrentes (RNF-CAP-010 / RN-CAP-024)
    const actualizados = await this.prisma.pedido.updateMany({
      where: {
        id: pedidoId,
        estado: 'LISTO',
        repartidor_party_id: null,
        motivo_falla: null,
        entrega_lat: { not: null },
        entrega_lng: { not: null },
      },
      data: {
        repartidor_party_id: partyId,
        tomado_en: ahora,
        orden_ruta: null,
        numero_ruta: null,
      },
    });

    if (actualizados.count === 0) {
      const pedidoExistente = await this.prisma.pedido.findUnique({
        where: { id: pedidoId },
      });

      if (!pedidoExistente) {
        throw new NotFoundException({
          codigo: 'PEDIDO_NO_ENCONTRADO',
          mensaje: 'Pedido no encontrado',
        });
      }

      if (pedidoExistente.repartidor_party_id !== null) {
        throw new ConflictException({
          codigo: 'YA_TOMADO',
          mensaje: 'Otro repartidor ya tomó este pedido',
        });
      }

      if (pedidoExistente.motivo_falla !== null) {
        throw new ConflictException({
          codigo: 'PEDIDO_EN_COORDINACION',
          mensaje: 'El pedido tiene una falla reportada y está en coordinación',
        });
      }

      if (pedidoExistente.estado !== 'LISTO') {
        throw new ConflictException({
          codigo: 'ESTADO_INVALIDO',
          mensaje: `El pedido no está listo para entrega (estado actual: ${pedidoExistente.estado})`,
        });
      }

      if (pedidoExistente.entrega_lat == null || pedidoExistente.entrega_lng == null) {
        throw new ConflictException({
          codigo: 'FALTA_UBICAR',
          mensaje: 'El pedido no tiene ubicación: caja debe ubicarlo antes de que se pueda tomar',
        });
      }

      throw new ConflictException({
        codigo: 'YA_TOMADO',
        mensaje: 'Otro repartidor ya tomó este pedido',
      });
    }

    // Se suma a la ruta en curso del repartidor (o abre una)
    await sumarARuta(this.prisma, partyId, [pedidoId], 'INDIVIDUAL', ahora);
    // «Asignado» ya no se avisa al cliente: solo «Ya salió», «Ya llegó» y «Entregado»

    const pedido = await this.prisma.pedido.findUniqueOrThrow({
      where: { id: pedidoId },
      include: {
        zona: true,
        lineas: { select: LINEAS_AREAS },
        ...INCLUDE_COBRO,
      },
    });

    // Registrar en historial
    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedidoId,
        estado_anterior: 'LISTO',
        estado_nuevo: 'LISTO',
        motivo: 'Tomado por repartidor',
        por_party_id: partyId,
        en: ahora,
      },
    });

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'TOMAR',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      partyId,
      ip,
    });

    // WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: pedido.estado,
      repartidor_party_id: String(partyId),
    });

    return this.formatearPedidoReparto(pedido, config, ahora, usuario);
  }

  /**
   * 2) POST /admin/repartos/:id/salir (repartos/entregar):
   * LISTO -> EN_CAMINO, salio_en = ahora.
   * Registra aviso 1 «En camino» en mensaje_reparto como PENDIENTE.
   */
  async salir(id: string | bigint, usuario: UsuarioAutenticado, ip?: string, sinCobro?: { forzarSinCobro?: boolean; motivo?: string }) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { zona: true },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuario && usuario.rol === 'REPARTIDOR') {
      const partyId = BigInt(usuario.partyId);
      if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== partyId) {
        throw new ForbiddenException({
          codigo: 'NO_ASIGNADO',
          mensaje: 'Este pedido no está asignado a tu usuario',
        });
      }
    }

    if (pedido.estado !== 'LISTO') {
      throw new BadRequestException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: `Solo se puede salir con un pedido en estado LISTO (estado actual: ${pedido.estado})`,
      });
    }

    // Delivery digital: no sale sin cobrar (el efectivo contra entrega sí sale); solo el ADMIN fuerza con motivo
    const forzadoSinCobro = await exigirCobroAntesDeEntregar(this.prisma, pedido as any, usuario, {
      forzar: sinCobro?.forzarSinCobro === true,
      motivo: sinCobro?.motivo,
    });

    const ahora = new Date();

    const pedidoActualizado = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          estado: 'EN_CAMINO',
          salio_en: ahora,
        },
        include: {
          zona: true,
          lineas: { select: LINEAS_AREAS },
          ...INCLUDE_COBRO,
        },
      });
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pedidoId,
          estado_anterior: 'LISTO',
          estado_nuevo: 'EN_CAMINO',
          motivo: 'En camino',
          por_party_id: partyId,
          en: ahora,
        },
      });
      await this.avisos?.avisar(pedidoId, 'SALIDA', {}, tx);
      return actualizado;
    });
    this.avisos?.despertar();

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'SALIR',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      partyId,
      ip,
    });
    if (forzadoSinCobro) await this.auditarSinCobro(pedido, 'EN_CAMINO', sinCobro?.motivo, partyId, ip);

    // WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: 'EN_CAMINO',
    });


    return this.formatearPedidoReparto(pedidoActualizado, config, ahora, usuario);
  }

  /**
   * 2) POST /admin/repartos/:id/llegue (repartos/entregar):
   * llego_en = ahora.
   * Registra aviso 2 «He llegado» en mensaje_reparto como PENDIENTE.
   */
  async llegue(id: string | bigint, usuario: UsuarioAutenticado, ip?: string) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { zona: true },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuario && usuario.rol === 'REPARTIDOR') {
      const partyId = BigInt(usuario.partyId);
      if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== partyId) {
        throw new ForbiddenException({
          codigo: 'NO_ASIGNADO',
          mensaje: 'Este pedido no está asignado a tu usuario',
        });
      }
    }

    if (pedido.estado !== 'EN_CAMINO') {
      throw new BadRequestException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: `Solo se puede marcar llegada de un pedido EN_CAMINO (estado actual: ${pedido.estado})`,
      });
    }

    const ahora = new Date();

    const pedidoActualizado = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          llego_en: ahora,
        },
        include: {
          zona: true,
          lineas: { select: LINEAS_AREAS },
          ...INCLUDE_COBRO,
        },
      });
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pedidoId,
          estado_anterior: pedido.estado,
          estado_nuevo: pedido.estado,
          motivo: 'He llegado',
          por_party_id: partyId,
          en: ahora,
        },
      });
      await this.avisos?.avisar(pedidoId, 'LLEGADA', {}, tx);
      return actualizado;
    });
    this.avisos?.despertar();

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'LLEGUE',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      partyId,
      ip,
    });

    // WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: pedido.estado,
      llego_en: ahora,
    });


    return this.formatearPedidoReparto(pedidoActualizado, config, ahora, usuario);
  }

  /** Auditoría del ADMIN que despacha o entrega sin cobrar (mismo patrón que forzar sin Cocina). */
  private async auditarSinCobro(pedido: any, hacia: string, motivo: string | undefined, partyId: bigint, ip?: string) {
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'PEDIDO_FORZAR_SIN_COBRO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      antes: { estado: pedido.estado, pagoEstado: pedido.pago_estado },
      despues: { estado: hacia, pagoEstado: pedido.pago_estado, forzadoPorAdministrador: true },
      motivo: motivo?.trim(),
      partyId,
      ip,
    });
  }

  /**
   * 2) POST /admin/repartos/:id/entregar (repartos/entregar):
   * EN_CAMINO -> ENTREGADO, entregado_en = ahora.
   * NO cobra el pedido si era contra entrega (efectivo/Yape); solo deja el dato del efectivo a rendir.
   */
  async entregar(
    id: string | bigint,
    usuario: UsuarioAutenticado,
    ip?: string,
    sinCobro?: { forzarSinCobro?: boolean; motivo?: string },
  ) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { zona: true, planPago: true },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuario && usuario.rol === 'REPARTIDOR') {
      const partyId = BigInt(usuario.partyId);
      if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== partyId) {
        throw new ForbiddenException({
          codigo: 'NO_ASIGNADO',
          mensaje: 'Este pedido no está asignado a tu usuario',
        });
      }
    }

    if (pedido.estado !== 'EN_CAMINO') {
      throw new BadRequestException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: `Solo se puede entregar un pedido EN_CAMINO (estado actual: ${pedido.estado})`,
      });
    }

    if (pedido.modalidad === 'DELIVERY' && !pedido.repartidor_party_id) {
      throw new ConflictException({
        codigo: 'REPARTIDOR_REQUERIDO',
        mensaje: 'Asigna un repartidor antes de marcar el pedido como entregado',
      });
    }

    // Delivery digital sin cobrar no se entrega (el efectivo contra entrega sí: lo rinde el repartidor); solo el ADMIN fuerza
    const forzadoSinCobro = await exigirCobroAntesDeEntregar(this.prisma, pedido as any, usuario, {
      forzar: sinCobro?.forzarSinCobro === true,
      motivo: sinCobro?.motivo,
    });

    const ahora = new Date();

    const porRendirEfectivo =
      pedido.pago_estado !== 'PAGADO'
        ? efectivoDelPedido(
            (pedido as any).planPago?.map((f: any) => ({ medio: f.medio, monto: Number(f.monto) })),
            pedido.pago_metodo,
            montoACobrar(pedido),
          )
        : 0;

    const pedidoActualizado = await this.prisma.$transaction(async (tx) => {
      const actualizado = await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          estado: 'ENTREGADO',
          entregado_en: ahora,
          llego_en: pedido.llego_en ?? ahora,
        },
        include: {
          zona: true,
          lineas: { select: LINEAS_AREAS },
          ...INCLUDE_COBRO,
        },
      });
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pedidoId,
          estado_anterior: 'EN_CAMINO',
          estado_nuevo: 'ENTREGADO',
          motivo: 'Entregado',
          por_party_id: partyId,
          en: ahora,
        },
      });
      await this.avisos?.avisar(pedidoId, 'ENTREGADO', {}, tx);
      return actualizado;
    });
    this.avisos?.despertar();

    // Si era el último pendiente de su ruta, la ruta se cierra sola
    if (pedido.repartidor_party_id != null) await sincronizarRuta(this.prisma, BigInt(pedido.repartidor_party_id), ahora);

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'ENTREGAR',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      partyId,
      ip,
    });
    if (forzadoSinCobro) await this.auditarSinCobro(pedido, 'ENTREGADO', sinCobro?.motivo, partyId, ip);

    // WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: 'ENTREGADO',
    });


    const formateado = this.formatearPedidoReparto(
      pedidoActualizado,
      config,
      ahora,
      usuario,
    );
    return {
      ...formateado,
      por_rendir_efectivo: porRendirEfectivo,
      efectivo_a_rendir: porRendirEfectivo,
    };
  }

  /**
   * 2) GET /admin/repartos/:id/mensajes (repartos/ver):
   * Consulta los avisos de reparto del pedido. Si pasó rep_msg3_seg (def 90s) desde el aviso 2
   * sin respuesta del cliente y no existe aviso 3, registra el aviso 3 como PENDIENTE.
   */
  async consultarMensajes(id: string | bigint, usuario?: UsuarioAutenticado) {
    const pedidoId = this.parsearId(id);
    const config = await this.obtenerParametrosReparto();

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuario && usuario.rol === 'REPARTIDOR') {
      const partyId = BigInt(usuario.partyId);
      if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== partyId) {
        throw new ForbiddenException({
          codigo: 'NO_ASIGNADO',
          mensaje: 'Este pedido no está asignado a tu usuario',
        });
      }
    }

    const mensajes = await this.prisma.mensajeReparto.findMany({
      where: { pedido_id: pedidoId },
      orderBy: { numero: 'asc' },
    });

    return mensajes.map((m) => ({
      pedido_id: String(m.pedido_id),
      numero: m.numero,
      enviado_en: m.enviado_en,
      respondido_en: m.respondido_en,
      estado: m.estado,
    }));
  }

  /**
   * 3) POST /admin/repartos/:id/reportar (repartos/reportar):
   * Crea incidente_entrega (intento 1, 2...). Exige al menos 2 llamadas registradas para NO_CONTESTA (400 EVIDENCIA_INSUFICIENTE).
   * La foto es opcional y NO se borra. El pedido pasa a motivo_falla y estado LISTO sin repartidor.
   */
  async reportarFalla(
    id: string | bigint,
    dto: ReportarFallaDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuario && usuario.rol === 'REPARTIDOR') {
      const partyId = BigInt(usuario.partyId);
      if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== partyId) {
        throw new ForbiddenException({
          codigo: 'NO_ASIGNADO',
          mensaje: 'Este pedido no está asignado a tu usuario',
        });
      }
    }

    // Regla DT-70: al menos 2 llamadas registradas si es NO_CONTESTA
    if (dto.motivo === 'NO_CONTESTA') {
      const llamadas = (dto.contactos || []).filter((c) => c.tipo === 'LLAMADA');
      if (llamadas.length < 2) {
        throw new BadRequestException({
          codigo: 'EVIDENCIA_INSUFICIENTE',
          mensaje:
            'Se requieren al menos 2 llamadas registradas como evidencia para el motivo NO_CONTESTA',
        });
      }
    }

    // Fotos del lugar: de la lista nueva o del campo de texto anterior (otros motivos)
    const idsFoto = [
      ...new Set(
        (dto.fotoArchivoIds ?? (dto.fotoArchivoId != null && dto.fotoArchivoId !== '' ? [dto.fotoArchivoId] : [])).map(
          String,
        ),
      ),
    ];
    if (idsFoto.some((v) => !/^\d+$/.test(v))) {
      throw new BadRequestException({ codigo: 'FOTO_INVALIDA', mensaje: 'Foto no válida' });
    }
    if (idsFoto.length > 3) {
      throw new BadRequestException({ codigo: 'DEMASIADAS_FOTOS', mensaje: 'Se admiten como máximo 3 fotos' });
    }

    // Cliente no salió: solo si el repartidor ya marcó «Llegué» y pasó el tiempo de espera; foto obligatoria
    let esperaMaxMin: number | null = null;
    if (dto.motivo === 'NO_CONTESTA') {
      if (pedido.estado !== 'EN_CAMINO' || pedido.llego_en == null) {
        throw new BadRequestException({
          codigo: 'SIN_LLEGADA',
          mensaje: 'Marca «Llegué» al llegar al domicilio antes de reportar que el cliente no salió',
        });
      }
      const config = await this.obtenerParametrosReparto();
      esperaMaxMin = config.esperaMaxMin;
      const esperaMs = config.esperaMaxMin * 60000;
      const transcurridoMs = Date.now() - new Date(pedido.llego_en).getTime();
      if (transcurridoMs < esperaMs) {
        const faltan = Math.ceil((esperaMs - transcurridoMs) / 60000);
        throw new BadRequestException({
          codigo: 'ESPERA_NO_CUMPLIDA',
          mensaje: `Aún no pasó el tiempo de espera (faltan ${faltan} min)`,
        });
      }
      if (idsFoto.length < 1) {
        throw new BadRequestException({
          codigo: 'FOTO_REQUERIDA',
          mensaje: 'Sube de 1 a 3 fotos del lugar donde esperaste',
        });
      }
    }
    if (idsFoto.length > 0) {
      const archivos = await this.prisma.archivo.findMany({
        where: { id: { in: idsFoto.map((v) => BigInt(v)) }, privado: true },
        select: { id: true },
      });
      if (archivos.length !== idsFoto.length) {
        throw new BadRequestException({ codigo: 'FOTO_NO_ENCONTRADA', mensaje: 'Una de las fotos no existe' });
      }
    }

    const cantidadIncidentes = await this.prisma.incidenteEntrega.count({
      where: { pedido_id: pedidoId },
    });
    const intento = cantidadIncidentes + 1;
    const ahora = new Date();

    const incidente = await this.prisma.incidenteEntrega.create({
      data: {
        pedido_id: pedidoId,
        motivo: dto.motivo,
        intento,
        contactos: dto.contactos as any,
        foto_archivo_id: idsFoto.length ? BigInt(idsFoto[0]) : null,
        llego_en: dto.motivo === 'NO_CONTESTA' ? pedido.llego_en : null,
        espera_max_min: esperaMaxMin,
        repartidor_party_id: pedido.repartidor_party_id ?? null,
        fotos: { create: idsFoto.map((v) => ({ archivo_id: BigInt(v) })) },
        en: ahora,
      },
    });

    // DT-70 / RQ-DEL-03-05: pedido pasa a motivo_falla, queda en LISTO sin repartidor para coordinación
    const pedidoActualizado = await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        motivo_falla: dto.motivo,
        repartidor_party_id: null,
        estado: 'LISTO',
      },
    });

    // El pedido se queda en su ruta como no entregado; si era el último pendiente, la ruta se cierra
    if (pedido.repartidor_party_id != null) await sincronizarRuta(this.prisma, BigInt(pedido.repartidor_party_id), ahora);

    // Historial
    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedidoId,
        estado_anterior: pedido.estado,
        estado_nuevo: 'LISTO',
        motivo: `Falla de entrega: ${dto.motivo} (intento ${intento})`,
        por_party_id: partyId,
        en: ahora,
      },
    });

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'REPORTAR_FALLA',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      motivo: dto.motivo,
      partyId,
      ip,
    });

    // WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: 'LISTO',
      motivo_falla: dto.motivo,
      intento,
    });

    this.eventosGateway?.emitirAdmin('reparto:incidente', {
      pedidoId: Number(pedido.id),
      codigo: pedido.codigo,
      motivo: dto.motivo,
      intento,
    });

    return {
      ok: true,
      incidenteId: String(incidente.id),
      intento,
      pedido: {
        id: String(pedidoActualizado.id),
        codigo: pedidoActualizado.codigo,
        estado: pedidoActualizado.estado,
        motivo_falla: pedidoActualizado.motivo_falla,
      },
    };
  }

  /**
   * POST /admin/repartos/:id/reprogramar (repartos/liquidar): el admin reenvía a reparto un pedido cuyo
   * cliente dijo SÍ a reprogramar tras el retiro. Vuelve a "Para elegir" marcado como Reprogramado
   * (con el recargo del incidente del retiro, el mismo que vio el cliente) y se avisa al cliente por WhatsApp.
   * Respeta el tope de reprogramaciones.
   */
  async reprogramarPedido(id: string | bigint, usuario: UsuarioAutenticado, ip?: string) {
    const pedidoId = this.parsearId(id);
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: { id: true, codigo: true, estado: true, motivo_falla: true, repartidor_party_id: true, pago_estado: true },
    });
    if (!pedido) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }

    const clave = { pedido_id_numero: { pedido_id: pedidoId, numero: NUMERO_PREGUNTA_REPROG } };
    const solicitud = await this.prisma.mensajeReparto.findUnique({ where: clave });
    const pendiente =
      solicitud?.estado === ESTADO_REPROG.REPROGRAMAR &&
      pedido.estado === 'LISTO' &&
      pedido.motivo_falla === MOTIVO_RETIRO &&
      pedido.repartidor_party_id == null;
    if (!pendiente) {
      throw new ConflictException({
        codigo: 'SIN_SOLICITUD_REPROGRAMAR',
        mensaje: 'El cliente no pidió reprogramar este pedido o ya fue reenviado',
      });
    }

    const params = await this.prisma.parametro.findMany({
      where: { clave: { in: ['reprog_max_intentos'] } },
    });
    const mapa = new Map(params.map((p) => [p.clave, p.valor]));
    const tope = Number(mapa.get('reprog_max_intentos') ?? 1);
    const usados = await this.prisma.incidenteEntrega.count({ where: { pedido_id: pedidoId, cierre: 'REPROGRAMADO' } });
    if (usados >= tope) {
      throw new ConflictException({
        codigo: 'TOPE_REPROGRAMACIONES',
        mensaje: 'Este pedido ya alcanzó el límite de reprogramaciones',
      });
    }

    const recargo = await montoPendienteReprogramacion(this.prisma, pedidoId);
    // Cambio de estado y aviso REENVIADO en una sola transacción (outbox)
    const resultado = await this.prisma.$transaction(async (tx) => {
      const r = await this.resolverFalla(
        id,
        { nota: 'Reprogramado tras confirmación del cliente', cierre: 'REPROGRAMADO', recargo },
        usuario,
        ip,
        tx,
      );
      await this.avisos?.avisar(pedidoId, 'REENVIADO', {}, tx);
      return r;
    });
    this.avisos?.despertar();
    await this.prisma.mensajeReparto.update({ where: clave, data: { estado: ESTADO_REPROG.REPROGRAMADO } });
    if (recargo > 0 && pedido.pago_estado === 'PAGADO') {
      // El pedido ya estaba pagado: el recargo no entra a la caja del repartidor, Caja lo cobra aparte.
      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'REPROG_COBRAR_RECARGO',
          rol_destino: 'CAJERO',
          titulo: 'Cobrar recargo de reprogramación',
          mensaje: `El pedido ${pedido.codigo} ya estaba pagado. Cobra el recargo de S/ ${recargo.toFixed(2)} por reprogramar la entrega.`,
          enlace: '/admin/caja',
        },
      });
      this.eventosGateway?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo: notif.titulo });
    }
    return resultado;
  }

  /**
   * 3) POST /admin/repartos/:id/resolver (repartos/liquidar):
   * Caja o Admin resuelve la falla del pedido con nota y recargo/cierre opcional.
   */
  async resolverFalla(
    id: string | bigint,
    dto: ResolverFallaDto,
    usuario: UsuarioAutenticado,
    ip?: string,
    tx?: Prisma.TransactionClient,
  ) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    // Con `tx` (reprogramación) las escrituras del cambio de estado van en la transacción del llamador
    const db = tx ?? this.prisma;

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuario && usuario.rol === 'REPARTIDOR') {
      const partyId = BigInt(usuario.partyId);
      if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== partyId) {
        throw new ForbiddenException({
          codigo: 'NO_ASIGNADO',
          mensaje: 'Este pedido no está asignado a tu usuario',
        });
      }
    }

    const ahora = new Date();
    const cierre = dto.cierre ?? 'REPROGRAMADO';

    const ultimoIncidente = await this.prisma.incidenteEntrega.findFirst({
      where: { pedido_id: pedidoId },
      orderBy: { en: 'desc' },
    });

    if (ultimoIncidente) {
      await db.incidenteEntrega.update({
        where: { id: ultimoIncidente.id },
        data: {
          cierre,
          recargo: dto.recargo != null ? new Prisma.Decimal(dto.recargo) : null,
          cerrado_por: partyId,
        },
      });
    }

    const dataActualizacion: Prisma.PedidoUncheckedUpdateInput = {
      motivo_falla: null,
    };

    if (dto.recargo != null && dto.recargo > 0) {
      const nuevoTotal = Number(pedido.total) + Number(dto.recargo);
      dataActualizacion.total = new Prisma.Decimal(nuevoTotal);
      if (pedido.envio != null) {
        dataActualizacion.envio = new Prisma.Decimal(
          Number(pedido.envio) + Number(dto.recargo),
        );
      }
    }

    if (cierre === 'DEVUELTO') {
      dataActualizacion.estado = 'ANULADO';
      dataActualizacion.anulado_en = ahora;
      dataActualizacion.anulado_por = partyId;
      dataActualizacion.motivo_anulacion = dto.nota;
    } else if (cierre === 'COBRADO_IGUAL') {
      dataActualizacion.repartidor_party_id = null;
    } else {
      dataActualizacion.estado = 'LISTO';
      dataActualizacion.repartidor_party_id = null;
    }

    const pedidoActualizado = await db.pedido.update({
      where: { id: pedidoId },
      data: dataActualizacion,
    });

    // Historial
    await db.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedidoId,
        estado_anterior: pedido.estado,
        estado_nuevo: pedidoActualizado.estado,
        motivo: `Falla resuelta: ${dto.nota} (${cierre})`,
        por_party_id: partyId,
        en: ahora,
      },
    });

    // Auditoría
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'RESOLVER_FALLA',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      motivo: dto.nota,
      partyId,
      ip,
    });

    // WebSocket
    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: pedidoActualizado.estado,
      motivo_falla: null,
    });

    return {
      ok: true,
      pedido: {
        id: String(pedidoActualizado.id),
        codigo: pedidoActualizado.codigo,
        estado: pedidoActualizado.estado,
        motivo_falla: pedidoActualizado.motivo_falla,
        total: Number(pedidoActualizado.total),
      },
    };
  }

  /**
   * POST /admin/repartos/iniciar-ruta (repartos/tomar)
   * Toma de forma atómica e idempotente múltiples pedidos para una ruta y los pasa a EN_CAMINO.
   * Utiliza SELECT ... FOR UPDATE con IDs ordenados para evitar interbloqueos (deadlocks).
   */
  async iniciarRuta(
    dto: IniciarRutaDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ): Promise<{
    tomados: any[];
    perdidos: Array<{
      pedidoId: string;
      codigo: string;
      motivo: 'OTRO_REPARTIDOR' | 'NO_DISPONIBLE' | 'LIMITE' | 'ANULADO' | 'COBRO_PENDIENTE';
      tomadoPor?: string;
    }>;
  }> {
    const partyId = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();
    const pedidoIds = [...new Set((dto?.pedidoIds || []).map((id) => String(id).trim()).filter(Boolean))];

    if (pedidoIds.length === 0) {
      return { tomados: [], perdidos: [] };
    }

    // Convertir a BigInt válidos
    const validBigIntIds: bigint[] = [];
    const invalidIds: string[] = [];

    for (const idStr of pedidoIds) {
      try {
        validBigIntIds.push(BigInt(idStr));
      } catch {
        invalidIds.push(idStr);
      }
    }

    // Orden ascendente determinista para evitar interbloqueos en transacciones concurrentes
    const idsOrdenadosAsc = validBigIntIds
      .slice()
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

    const ahora = new Date();

    const resultadoTransaccion = await this.prisma.$transaction(
      async (tx) => {
        const perdidos: Array<{
          pedidoId: string;
          codigo: string;
          motivo: 'OTRO_REPARTIDOR' | 'NO_DISPONIBLE' | 'LIMITE' | 'ANULADO' | 'COBRO_PENDIENTE';
          tomadoPor?: string;
        }> = [];

        for (const inv of invalidIds) {
          perdidos.push({
            pedidoId: inv,
            codigo: 'DESCONOCIDO',
            motivo: 'NO_DISPONIBLE',
          });
        }

        if (idsOrdenadosAsc.length === 0) {
          return { tomadosIds: [], perdidos };
        }

        // 1. Bloqueo pesimista determinista SELECT ... FOR UPDATE en orden de ID
        const lockedRows: any[] = await tx.$queryRaw`
          SELECT p.id, p.codigo, p.modalidad, p.estado, p.repartidor_party_id,
                 p.anulado_en, p.motivo_falla, p.entrega_lat, p.entrega_lng,
                 p.pago_estado, p.pago_metodo, p.es_personal, p.total, p.monto_credito
          FROM pedido p
          WHERE p.id IN (${Prisma.join(idsOrdenadosAsc)})
          ORDER BY p.id ASC
          FOR UPDATE
        `;

        const mapaBloqueados = new Map<string, any>(
          lockedRows.map((r) => [String(r.id), r]),
        );

        // Nombres de repartidores de pedidos tomados por otros
        const otrosPartyIds = [
          ...new Set(
            lockedRows
              .filter((p) => p.repartidor_party_id != null && BigInt(p.repartidor_party_id) !== partyId)
              .map((p) => BigInt(p.repartidor_party_id)),
          ),
        ];

        const personasOtros = otrosPartyIds.length > 0
          ? await tx.person.findMany({
              where: { party_id: { in: otrosPartyIds } },
            })
          : [];

        const nombresOtrosMap = new Map<string, string>(
          personasOtros.map((per) => [
            String(per.party_id),
            `${per.nombres}${per.apellidos ? ` ${per.apellidos}` : ''}`.trim(),
          ]),
        );

        // 2. Pedidos activos que ya lleva el repartidor (en LISTO o EN_CAMINO)
        const pedidosActivosPrevios = await tx.pedido.findMany({
          where: {
            repartidor_party_id: partyId,
            estado: { in: ['LISTO', 'EN_CAMINO'] },
          },
          select: { id: true },
        });

        const idsActivosPrevios = new Set(
          pedidosActivosPrevios.map((p) => String(p.id)),
        );

        let cupoUsado = idsActivosPrevios.size;
        const tomadosIds: bigint[] = [];

        // 3. Procesar en el orden de la ruta solicitado por el repartidor
        for (const idStr of pedidoIds) {
          const p = mapaBloqueados.get(idStr);

          if (!p) {
            perdidos.push({
              pedidoId: idStr,
              codigo: 'DESCONOCIDO',
              motivo: 'NO_DISPONIBLE',
            });
            continue;
          }

          const esMio = p.repartidor_party_id != null && BigInt(p.repartidor_party_id) === partyId;

          // Idempotencia: el pedido ya pertenecía a este mismo repartidor
          if (esMio) {
            if (p.estado === 'LISTO' && (await requiereCobroAntesDeEntregar(this.prisma, p))) {
              // Delivery digital sin cobrar: el repartidor no sale con él (Caja lo cobra o el ADMIN lo despacha)
              perdidos.push({ pedidoId: idStr, codigo: p.codigo, motivo: 'COBRO_PENDIENTE' });
            } else if (p.estado === 'LISTO') {
              // Estaba asignado pero aún no había salido -> sale ahora
              await tx.pedido.update({
                where: { id: p.id },
                data: {
                  salio_en: ahora,
                  estado: 'EN_CAMINO',
                },
              });

              await tx.pedidoEstadoHistorial.create({
                data: {
                  pedido_id: p.id,
                  estado_anterior: 'LISTO',
                  estado_nuevo: 'EN_CAMINO',
                  motivo: 'Salida en ruta por repartidor (idempotente)',
                  por_party_id: partyId,
                  en: ahora,
                },
              });

              await this.auditoria.registrar({
                categoria: 'CAMBIO',
                modulo: 'repartos',
                accion: 'INICIAR_RUTA',
                resultado: 'OK',
                entidad: 'pedido',
                entidadId: p.id,
                partyId,
                ip,
              });

              tomadosIds.push(p.id);
            } else if (p.estado === 'EN_CAMINO') {
              // Ya está en camino por este repartidor (doble clic / reintento)
              tomadosIds.push(p.id);
            } else {
              perdidos.push({
                pedidoId: idStr,
                codigo: p.codigo,
                motivo: p.anulado_en != null ? 'ANULADO' : 'NO_DISPONIBLE',
              });
            }
            continue;
          }

          // Si no era mío:
          // Validar anulado
          if (p.anulado_en != null || p.estado === 'ANULADO') {
            perdidos.push({
              pedidoId: idStr,
              codigo: p.codigo,
              motivo: 'ANULADO',
            });
            continue;
          }

          // Validar si otro repartidor ya lo tomó
          if (p.repartidor_party_id != null) {
            const tomadoPor =
              nombresOtrosMap.get(String(p.repartidor_party_id)) ||
              `Repartidor #${p.repartidor_party_id}`;
            perdidos.push({
              pedidoId: idStr,
              codigo: p.codigo,
              motivo: 'OTRO_REPARTIDOR',
              tomadoPor,
            });
            continue;
          }

          // Validar estado LISTO, DELIVERY, sin falla y con ubicación válida
          if (
            p.modalidad !== 'DELIVERY' ||
            p.estado !== 'LISTO' ||
            p.motivo_falla != null ||
            p.entrega_lat == null ||
            p.entrega_lng == null
          ) {
            perdidos.push({
              pedidoId: idStr,
              codigo: p.codigo,
              motivo: 'NO_DISPONIBLE',
            });
            continue;
          }

          // Delivery digital sin cobrar no sale a reparto
          if (await requiereCobroAntesDeEntregar(this.prisma, p)) {
            perdidos.push({ pedidoId: idStr, codigo: p.codigo, motivo: 'COBRO_PENDIENTE' });
            continue;
          }

          // Validar límite máximo de pedidos simultáneos
          if (cupoUsado >= config.maxPedidos) {
            perdidos.push({
              pedidoId: idStr,
              codigo: p.codigo,
              motivo: 'LIMITE',
            });
            continue;
          }

          // Asignar y salir en un solo paso atómico
          await tx.pedido.update({
            where: { id: p.id },
            data: {
              repartidor_party_id: partyId,
              tomado_en: ahora,
              salio_en: ahora,
              estado: 'EN_CAMINO',
            },
          });

          await tx.pedidoEstadoHistorial.create({
            data: {
              pedido_id: p.id,
              estado_anterior: 'LISTO',
              estado_nuevo: 'EN_CAMINO',
              motivo: 'Ruta iniciada por repartidor',
              por_party_id: partyId,
              en: ahora,
            },
          });

          await this.auditoria.registrar({
            categoria: 'CAMBIO',
            modulo: 'repartos',
            accion: 'INICIAR_RUTA',
            resultado: 'OK',
            entidad: 'pedido',
            entidadId: p.id,
            partyId,
            ip,
          });

          cupoUsado++;
          tomadosIds.push(p.id);
        }

        await sumarARuta(tx, partyId, tomadosIds, 'INDIVIDUAL', ahora);

        const tomadosFilas = tomadosIds.length > 0
          ? await tx.pedido.findMany({
              where: { id: { in: tomadosIds } },
              include: {
                zona: true,
                lineas: { select: LINEAS_AREAS },
                ...INCLUDE_COBRO,
              },
            })
          : [];

        // Aviso SALIDA de cada pedido tomado, en la misma transacción (se despierta el envío tras el commit)
        for (const id of tomadosIds) {
          await this.avisos?.avisar(id, 'SALIDA', {}, tx);
        }

        return {
          tomadosFilas,
          tomadosIds,
          perdidos,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10000,
      },
    );

    // Mapear los tomados respetando el orden de la ruta solicitada
    const filasMap = new Map((resultadoTransaccion.tomadosFilas || []).map((f) => [String(f.id), f]));
    const tomados = resultadoTransaccion.tomadosIds
      .map((id) => filasMap.get(String(id)))
      .filter(Boolean)
      .map((p) => this.formatearPedidoReparto(p, config, ahora, usuario));

    // Emitir eventos en tiempo real para actualizar pantallas
    for (const t of tomados) {
      this.eventosGateway?.emitirAdmin('pedido:estado', {
        id: Number(t.id),
        codigo: t.codigo,
        estado: 'EN_CAMINO',
        repartidor_party_id: String(partyId),
      });
    }

    this.avisos?.despertar();

    return {
      tomados,
      perdidos: resultadoTransaccion.perdidos,
    };
  }

  /** Soltar o reasignar un pedido es una excepción (se cayó el repartidor): solo ADMIN y CAJERO. */
  private exigirCajaOAdmin(usuario: UsuarioAutenticado) {
    if (usuario.rol !== 'ADMIN' && usuario.rol !== 'CAJERO') {
      throw new ForbiddenException({
        codigo: 'SOLO_CAJA_ADMIN',
        mensaje: 'Soltar o reasignar un pedido es solo para caja y administración',
      });
    }
  }

  /**
   * POST /admin/repartos/:id/liberar (repartos/liquidar - Caja/Admin)
   * Libera la asignación de un pedido tomado para que regrese a la cola de disponibles.
   */
  async liberarPedido(
    id: string | bigint,
    dto: LiberarPedidoDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    this.exigirCajaOAdmin(usuario);
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { zona: true },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuario && usuario.rol === 'REPARTIDOR') {
      const partyId = BigInt(usuario.partyId);
      if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== partyId) {
        throw new ForbiddenException({
          codigo: 'NO_ASIGNADO',
          mensaje: 'Este pedido no está asignado a tu usuario',
        });
      }
    }

    if (!pedido.repartidor_party_id) {
      throw new BadRequestException({
        codigo: 'SIN_REPARTIDOR',
        mensaje: 'El pedido no tiene ningún repartidor asignado',
      });
    }

    if (pedido.estado === 'ENTREGADO') {
      throw new ConflictException({
        codigo: 'YA_ENTREGADO',
        mensaje: 'No se puede liberar un pedido que ya fue entregado',
      });
    }

    const ahora = new Date();
    const anteriorRepartidorId = pedido.repartidor_party_id;

    const actualizado = await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        repartidor_party_id: null,
        tomado_en: null,
        salio_en: null,
        estado: 'LISTO',
        // Liberado antes de salir: sale de la ruta; si ya había salido, queda en ella como no entregado
        ...(pedido.salio_en == null ? { ruta_reparto_id: null } : {}),
      },
      include: { zona: true },
    });
    await sincronizarRuta(this.prisma, BigInt(anteriorRepartidorId), ahora);
    // Sin repartidor: la próxima toma vuelve a avisar «ya asignamos a tu delivery»
    await this.prisma.mensajeReparto.deleteMany({ where: { pedido_id: pedidoId, numero: ETAPAS_AVISO.ASIGNADO.numero } });

    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedidoId,
        estado_anterior: pedido.estado,
        estado_nuevo: 'LISTO',
        motivo: `Liberado por caja/admin: ${dto.motivo} (estaba con repartidor #${anteriorRepartidorId})`,
        por_party_id: partyId,
        en: ahora,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'LIBERAR',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      partyId,
      ip,
      motivo: dto.motivo,
    });

    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: 'LISTO',
      repartidor_party_id: null,
    });

    return this.formatearPedidoReparto(actualizado, config, ahora);
  }

  /**
   * POST /admin/repartos/ruta/cerrar: cierre manual de la ruta EN_CURSO, sin orden y sin exigir que todo esté entregado.
   * Solo bloquea si queda algún pedido EN_CAMINO sin resolver (409 RUTA_CON_PENDIENTES con la lista). Los ANULADOS y
   * RECHAZADOS no cuentan; los LISTO que aún no salieron vuelven a «disponibles». El repartidor cierra la suya;
   * Caja/Admin la de `repartidorId`. La liquidación solo suma lo ENTREGADO (ver pedidosRepartoDelDia).
   */
  async cerrarRuta(repartidorId: string | undefined, usuario: UsuarioAutenticado, ip?: string) {
    let partyId: bigint;
    if (usuario.rol === 'REPARTIDOR') {
      partyId = BigInt(usuario.partyId);
    } else {
      this.exigirCajaOAdmin(usuario);
      if (!repartidorId) throw new BadRequestException({ codigo: 'REPARTIDOR_REQUERIDO', mensaje: 'Elige el repartidor de la ruta' });
      partyId = this.parsearId(repartidorId);
    }
    const ruta = await this.prisma.rutaReparto.findFirst({
      where: { repartidor_party_id: partyId, estado: 'EN_CURSO' },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    if (!ruta) throw new ConflictException({ codigo: 'SIN_RUTA', mensaje: 'No hay una ruta en curso para cerrar' });

    const enCamino = await this.prisma.pedido.findMany({
      where: { ruta_reparto_id: ruta.id, repartidor_party_id: partyId, estado: 'EN_CAMINO' },
      select: { id: true, codigo: true },
      orderBy: { id: 'asc' },
    });
    if (enCamino.length > 0) {
      throw new ConflictException({
        codigo: 'RUTA_CON_PENDIENTES',
        mensaje: `Te falta resolver: ${enCamino.map((p) => `${p.codigo} (en camino)`).join(', ')}`,
        pedidos: enCamino.map((p) => ({ id: String(p.id), codigo: p.codigo, estado: 'EN_CAMINO' })),
      });
    }

    // Los que aún no salieron (LISTO) dejan la ruta y vuelven a disponibles
    const ahora = new Date();
    const liberados = await this.prisma.pedido.findMany({
      where: { ruta_reparto_id: ruta.id, repartidor_party_id: partyId, estado: 'LISTO' },
      select: { id: true },
    });
    if (liberados.length > 0) {
      const ids = liberados.map((p) => p.id);
      await this.prisma.pedido.updateMany({
        where: { id: { in: ids } },
        data: { repartidor_party_id: null, tomado_en: null, ruta_reparto_id: null },
      });
      await this.prisma.mensajeReparto.deleteMany({ where: { pedido_id: { in: ids }, numero: ETAPAS_AVISO.ASIGNADO.numero } });
    }
    const cerrada = await sincronizarRuta(this.prisma, partyId, ahora);
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'repartos', accion: 'CERRAR_RUTA', resultado: 'OK', entidad: 'ruta_reparto',
      entidadId: ruta.id, despues: { liberados: liberados.length }, partyId: BigInt(usuario.partyId), ip,
    });
    this.eventosGateway?.emitirAdmin('reparto:rutas', {});
    return { ok: true, rutaId: String(ruta.id), cerrada: cerrada != null, liberados: liberados.length };
  }

  /**
   * POST /admin/repartos/:id/devolver-local: el repartidor devuelve al local un pedido suyo que ya salió (EN_CAMINO).
   * Vuelve a LISTO sin repartidor y queda en su ruta como no entregado; si era el último pendiente la ruta se cierra.
   */
  async devolverAlLocal(id: string | bigint, usuario: UsuarioAutenticado, ip?: string) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const pedido = await this.prisma.pedido.findUnique({ where: { id: pedidoId } });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== partyId) {
      throw new ForbiddenException({ codigo: 'NO_ASIGNADO', mensaje: 'Este pedido no está asignado a tu usuario' });
    }
    if (pedido.estado !== 'EN_CAMINO') {
      throw new ConflictException({ codigo: 'TRANSICION_INVALIDA', mensaje: 'Solo se devuelve al local un pedido que ya salió' });
    }
    const ahora = new Date();
    await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: { repartidor_party_id: null, tomado_en: null, salio_en: null, llego_en: null, estado: 'LISTO' },
    });
    await this.prisma.pedidoEstadoHistorial.create({
      data: { pedido_id: pedidoId, estado_anterior: 'EN_CAMINO', estado_nuevo: 'LISTO', motivo: 'Devuelto al local por el repartidor al cerrar la ruta', por_party_id: partyId, en: ahora },
    });
    await sincronizarRuta(this.prisma, partyId, ahora);
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'repartos', accion: 'DEVOLVER_AL_LOCAL', resultado: 'OK', entidad: 'pedido', entidadId: pedidoId, partyId, ip,
    });
    this.eventosGateway?.emitirAdmin('pedido:estado', { id: Number(pedido.id), codigo: pedido.codigo, estado: 'LISTO', repartidor_party_id: null });
    this.eventosGateway?.emitirAdmin('reparto:rutas', {});
    return { ok: true, pedidoId: String(pedidoId), estado: 'LISTO' };
  }

  /**
   * POST /admin/repartos/:id/reasignar (repartos/liquidar - Caja/Admin)
   * Reasigna un pedido a otro repartidor activo que tenga cupo disponible.
   */
  async reasignarPedido(
    id: string | bigint,
    dto: ReasignarPedidoDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    this.exigirCajaOAdmin(usuario);
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const nuevoRepartidorPartyId = this.parsearId(dto.repartidorPartyId);
    const config = await this.obtenerParametrosReparto();

    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { zona: true },
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    if (usuario && usuario.rol === 'REPARTIDOR') {
      const partyId = BigInt(usuario.partyId);
      if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== partyId) {
        throw new ForbiddenException({
          codigo: 'NO_ASIGNADO',
          mensaje: 'Este pedido no está asignado a tu usuario',
        });
      }
    }

    if (pedido.estado === 'ENTREGADO') {
      throw new ConflictException({
        codigo: 'YA_ENTREGADO',
        mensaje: 'No se puede reasignar un pedido que ya fue entregado',
      });
    }

    // Verificar que el nuevo repartidor existe y tiene rol REPARTIDOR activo
    const userAccount = await this.prisma.userAccount.findUnique({
      where: { party_id: nuevoRepartidorPartyId },
      include: { party: { include: { persona: true } } },
    });

    if (!userAccount || userAccount.rol !== 'REPARTIDOR' || !userAccount.activo) {
      throw new BadRequestException({
        codigo: 'REPARTIDOR_INVALIDO',
        mensaje: 'El usuario destino no es un repartidor activo válido',
      });
    }

    // Verificar que el nuevo repartidor no supere el límite
    const pedidosActivosNuevo = await this.prisma.pedido.count({
      where: {
        repartidor_party_id: nuevoRepartidorPartyId,
        estado: { in: ['LISTO', 'EN_CAMINO'] },
      },
    });

    if (pedidosActivosNuevo >= config.maxPedidos) {
      throw new ConflictException({
        codigo: 'LIMITE_PEDIDOS',
        mensaje: `El repartidor ya tiene ${pedidosActivosNuevo} pedidos activos (máximo: ${config.maxPedidos})`,
      });
    }

    const ahora = new Date();
    const anteriorRepartidorId = pedido.repartidor_party_id;

    const actualizado = await this.prisma.pedido.update({
      where: { id: pedidoId },
      data: {
        repartidor_party_id: nuevoRepartidorPartyId,
        tomado_en: ahora,
        estado: pedido.estado === 'EN_CAMINO' ? 'EN_CAMINO' : 'LISTO',
        ruta_reparto_id: null,
      },
      include: { zona: true },
    });
    // Sale de la ruta del anterior y entra en la del nuevo repartidor
    if (anteriorRepartidorId != null) await sincronizarRuta(this.prisma, BigInt(anteriorRepartidorId), ahora);
    await sumarARuta(this.prisma, nuevoRepartidorPartyId, [pedidoId], 'INDIVIDUAL', ahora);
    // El cliente se entera del nuevo delivery: se borra la etapa para que el aviso salga otra vez con el nombre nuevo
    await this.prisma.mensajeReparto.deleteMany({ where: { pedido_id: pedidoId, numero: ETAPAS_AVISO.ASIGNADO.numero } });

    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedidoId,
        estado_anterior: pedido.estado,
        estado_nuevo: actualizado.estado,
        motivo: `Reasignado por caja/admin: ${dto.motivo} (de #${anteriorRepartidorId || 'nadie'} a #${nuevoRepartidorPartyId})`,
        por_party_id: partyId,
        en: ahora,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'REASIGNAR',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      partyId,
      ip,
      motivo: dto.motivo,
    });

    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: actualizado.estado,
      repartidor_party_id: String(nuevoRepartidorPartyId),
    });

    return this.formatearPedidoReparto(actualizado, config, ahora);
  }

  /** Pedidos que aún no se pueden tomar pero ya vienen: por validar pago o en cocina (solo delivery con ubicación). */
  private whereProximos(): Prisma.PedidoWhereInput {
    return {
      modalidad: 'DELIVERY',
      estado: { in: ['COLA', 'PREPARANDO'] },
      repartidor_party_id: null,
      anulado_en: null,
      motivo_falla: null,
      es_personal: false,
    };
  }

  /** Sin voucher el pedido igual va a cocina (la captura es opcional): ya no hay «por validar». */
  private estadoProximo(_p: { estado: string; pago_estado: string | null; pago_metodo: string | null; pago_preferido: string | null }) {
    return { estado: 'EN_COCINA', estadoTexto: 'En cocina' } as const;
  }

  /**
   * GET /admin/repartos/proximos (repartos/ver): pedidos delivery que todavía no se pueden tomar.
   * Aislamiento: solo nombre del cliente, ubicación, zona y conteo; sin teléfono, dirección ni montos.
   */
  async listarProximos(_usuario?: UsuarioAutenticado) {
    const filas = await this.prisma.pedido.findMany({
      where: { ...this.whereProximos(), entrega_lat: { not: null }, entrega_lng: { not: null } },
      include: { zona: true, lineas: { select: { cantidad: true } } },
      orderBy: { creado_en: 'asc' },
    });
    const ahora = new Date();
    return filas.map((p) => ({
      id: String(p.id),
      codigo: p.codigo,
      clienteNombre: p.cliente_nombre ?? null,
      lat: Number(p.entrega_lat),
      lng: Number(p.entrega_lng),
      zona: p.zona?.codigo ?? null,
      ...this.estadoProximo(p),
      minutosEspera: this.calcularMinutosYColor(p.creado_en, ahora).minutosEspera,
      creadoEn: p.creado_en,
      cantidadProductos: lineasDeCuenta(p.lineas).reduce((a, l) => a + (Number(l.cantidad) || 0), 0),
    }));
  }

  /**
   * Cobro del pedido para la hoja del repartidor: pagado o falta cobrar, medio y plan, efectivo a cobrar con su
   * vuelto, capturas (validadas o pendientes) y cortesías. Solo de pedidos propios.
   */
  private async detalleCobro(p: any) {
    const total = montoACobrar(p);
    const propina = Number(p.propina ?? 0);
    const totalCobrable = Math.round((total + propina) * 100) / 100;
    const plan: Array<{ medio: string; monto: number }> =
      Array.isArray(p.planPago) && p.planPago.length > 0
        ? p.planPago.map((f: any) => ({ medio: f.medio, monto: Number(f.monto) }))
        : [{ medio: String(p.pago_metodo ?? p.pago_preferido ?? 'EFECTIVO').toUpperCase(), monto: totalCobrable }];
    const pagado = p.pago_estado === 'PAGADO';
    const efectivoCobrar = pagado ? 0 : efectivoDelPedido(Array.isArray(p.planPago) ? plan : null, p.pago_metodo, totalCobrable);
    const pagaCon = p.paga_con != null ? Number(p.paga_con) : null;
    const vuelto = pagaCon != null && efectivoCobrar > 0 && pagaCon > efectivoCobrar ? Math.round((pagaCon - efectivoCobrar) * 100) / 100 : 0;
    const vouchers = await this.prisma.voucherPago.findMany({
      where: { pedido_id: p.id, reemplazado_en: null, retirado: false },
      select: { id: true, medio: true, semaforo: true, revisado_en: true },
      orderBy: { id: 'asc' },
    });
    const cortesias = (p.lineas ?? []).filter((l: any) => l.es_cortesia).map((l: any) => ({ nombre: l.nombre, cantidad: l.cantidad }));
    return {
      estado: pagado ? 'PAGADO' : 'FALTA_COBRAR',
      medio: p.pago_metodo ?? null,
      plan,
      mixto: plan.length > 1,
      total,
      propina,
      total_cobrable: totalCobrable,
      efectivo_cobrar: efectivoCobrar,
      paga_con: pagaCon,
      vuelto,
      vouchers: vouchers.map((v) => ({
        id: String(v.id),
        medio: v.medio,
        estado: v.semaforo === 'ILEGIBLE' ? 'ILEGIBLE' : v.revisado_en || pagado ? 'VALIDADO' : 'PENDIENTE',
      })),
      cortesias,
      cambio_pendiente: this.cambioCobroPendiente(p),
    };
  }

  /**
   * GET /admin/repartos/:id/resumen-repartidor (repartos/ver): detalle de la hoja inferior para un pedido
   * disponible, propio o próximo. Dirección y teléfono solo si el pedido es de quien pregunta.
   */
  async resumenRepartidor(id: string, usuario: UsuarioAutenticado) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();
    const p = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: {
        zona: true,
        lineas: {
          select: {
            cantidad: true,
            nombre: true,
            tamano: true,
            sabor: true,
            nota: true,
            es_cortesia: true,
            opcionesElegidas: { select: { opcion_nombre: true }, orderBy: { id: 'asc' } },
            sabores: { select: { sabor_nombre: true, cantidad: true }, orderBy: { id: 'asc' } },
          },
        },
        planPago: { orderBy: { orden: 'asc' } },
        solicitudesCambioCobro: { where: { estado: 'PENDIENTE' }, take: 1 },
      },
    });
    const esMio = p?.repartidor_party_id != null && BigInt(p.repartidor_party_id) === partyId;
    const esProximo = p != null && ['COLA', 'PREPARANDO'].includes(p.estado) && p.repartidor_party_id == null && p.anulado_en == null;
    const esDisponible = p != null && p.estado === 'LISTO' && p.repartidor_party_id == null && p.motivo_falla == null;
    const visible = esMio || ((esProximo || esDisponible) && !p?.es_personal);
    if (!p || p.modalidad !== 'DELIVERY' || !visible) {
      throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    }

    let puedeTomar = false;
    let motivoNoTomar: string | null = null;
    if (esMio) {
      motivoNoTomar = 'Este pedido ya es tuyo';
    } else if (esProximo) {
      motivoNoTomar = 'Aún no está disponible';
    } else if (p.entrega_lat == null || p.entrega_lng == null) {
      motivoNoTomar = 'El pedido no tiene ubicación';
    } else {
      const activos = await this.prisma.pedido.count({
        where: { repartidor_party_id: partyId, estado: { in: ['LISTO', 'EN_CAMINO'] } },
      });
      if (activos >= config.maxPedidos) motivoNoTomar = `Ya llevas ${config.maxPedidos} pedidos: entrega alguno antes de tomar otro`;
      else puedeTomar = true;
    }

    const prox = esProximo ? this.estadoProximo(p) : null;
    const minutosEspera = this.calcularMinutosYColor(p.creado_en).minutosEspera;
    return {
      id: String(p.id),
      codigo: p.codigo,
      clienteNombre: p.cliente_nombre ?? null,
      estado: prox?.estado ?? p.estado,
      estadoTexto: prox?.estadoTexto ?? (p.estado === 'EN_CAMINO' ? 'En camino' : 'Listo para entrega'),
      minutosEspera,
      productos: lineasDeCuenta(p.lineas).map((l: any) => ({
        cantidad: l.cantidad,
        nombre: l.nombre,
        // Detalle que pidió el cliente: tamaño, sabores y opciones elegidas, nota de la línea y si es cortesía
        ...(esMio
          ? {
              tamano: l.tamano ?? null,
              sabores: [
                ...(l.sabor ? [l.sabor] : []),
                ...((l.sabores ?? []) as Array<{ sabor_nombre: string; cantidad: number }>).map((x) => (x.cantidad > 1 ? `${x.cantidad} ${x.sabor_nombre}` : x.sabor_nombre)),
              ],
              opciones: ((l.opcionesElegidas ?? []) as Array<{ opcion_nombre: string }>).map((o) => o.opcion_nombre).filter(Boolean),
              nota: l.nota ?? null,
              es_cortesia: !!l.es_cortesia,
            }
          : {}),
      })),
      nota: p.nota ?? null,
      zona: p.zona?.codigo ?? null,
      puedeTomar,
      motivoNoTomar,
      ...(esMio
        ? {
            direccion: p.entrega_direccion,
            referencia: p.entrega_referencia,
            telefono: p.cliente_telefono,
            cobro: await this.detalleCobro(p),
            tiempos: {
              creado_en: p.creado_en,
              pasa_cocina_en: p.pasa_cocina_en ?? null,
              listo_en: p.listo_en ?? null,
              tomado_en: p.tomado_en ?? null,
              salio_en: p.salio_en ?? null,
              llego_en: p.llego_en ?? null,
              entregado_en: p.entregado_en ?? null,
              espera_max_min: config.esperaMaxMin,
            },
          }
        : {}),
    };
  }

  /**
   * Mayor numero_ruta usado en la ruta en curso del repartidor (entregados y fallidos incluidos), sin contar
   * `excluir`. Sin ruta en curso: 0. Los números de una ruta no se reutilizan hasta cerrarla.
   */
  private async maxNumeroRuta(tx: any, partyId: bigint, excluir: bigint[] = []): Promise<number> {
    const ruta = await tx.rutaReparto.findFirst({
      where: { repartidor_party_id: partyId, estado: 'EN_CURSO' },
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    if (!ruta) return 0;
    const filas: any[] = await tx.pedido.findMany({
      where: { ruta_reparto_id: ruta.id, numero_ruta: { not: null } },
      select: { id: true, numero_ruta: true },
    });
    return Math.max(0, ...filas.filter((f) => !excluir.includes(f.id)).map((f) => f.numero_ruta as number));
  }

  /** Pedidos pendientes del repartidor que ya tienen orden, de menor a mayor orden. */
  private async pendientesConOrden(tx: any, partyId: bigint) {
    return tx.pedido.findMany({
      where: { repartidor_party_id: partyId, orden_ruta: { not: null }, estado: { in: ['LISTO', 'EN_CAMINO'] } },
      select: { id: true, codigo: true, estado: true, orden_ruta: true, numero_ruta: true, entrega_lat: true, entrega_lng: true },
      orderBy: { orden_ruta: 'asc' },
    });
  }

  /**
   * POST /admin/repartos/:id/empezar-por (repartos/tomar): el repartidor elige con cuál empieza y el resto se
   * reordena por vecino más cercano (distancia en línea recta). Solo antes de salir con alguno.
   */
  async empezarPor(id: string | bigint, usuario: UsuarioAutenticado, ip?: string) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const orden = await this.prisma.$transaction(async (tx) => {
      const lista: any[] = await this.pendientesConOrden(tx, partyId);
      const elegido = lista.find((p) => p.id === pedidoId);
      if (!elegido) {
        throw new ConflictException({ codigo: 'NO_EN_RUTA', mensaje: 'Ese pedido no está en tu ruta' });
      }
      if (lista.some((p) => p.estado === 'EN_CAMINO')) {
        throw new ConflictException({ codigo: 'RUTA_EN_CURSO', mensaje: 'Ya saliste con un pedido: el orden ya no se puede cambiar' });
      }
      const sinCoord = lista.filter((p) => p.id !== pedidoId && (p.entrega_lat == null || p.entrega_lng == null));
      let pendientes = lista.filter((p) => p.id !== pedidoId && !sinCoord.includes(p));
      const resultado = [elegido];
      let actual = elegido;
      while (pendientes.length > 0 && actual.entrega_lat != null) {
        let mejor = pendientes[0];
        let mejorKm = Infinity;
        for (const c of pendientes) {
          const km = this.rutaService.haversineKm(Number(actual.entrega_lat), Number(actual.entrega_lng), Number(c.entrega_lat), Number(c.entrega_lng));
          if (km < mejorKm) { mejorKm = km; mejor = c; }
        }
        resultado.push(mejor);
        pendientes = pendientes.filter((p) => p !== mejor);
        actual = mejor;
      }
      resultado.push(...pendientes, ...sinCoord);
      const baseNum = await this.maxNumeroRuta(tx, partyId, resultado.map((p) => p.id));
      for (let i = 0; i < resultado.length; i++) {
        await tx.pedido.update({ where: { id: resultado[i].id }, data: { orden_ruta: i + 1, numero_ruta: baseNum + i + 1 } });
      }
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pedidoId, estado_anterior: elegido.estado, estado_nuevo: elegido.estado,
          motivo: 'Empezar por este: ruta reordenada por cercanía', por_party_id: partyId, en: new Date(),
        },
      });
      return resultado.map((p, i) => ({ id: String(p.id), codigo: p.codigo, ordenRuta: i + 1, numeroRuta: baseNum + i + 1 }));
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'repartos', accion: 'EMPEZAR_POR', resultado: 'OK',
      entidad: 'pedido', entidadId: pedidoId, partyId, ip, despues: { orden },
    });
    this.eventosGateway?.emitirAdmin('reparto:rutas', {});
    return { orden };
  }

  /**
   * POST /admin/repartos/:id/saltar (repartos/entregar): el pedido que toca pasa al final del orden.
   * Pide motivo, queda en el historial del pedido y en auditoría; máximo 2 saltos por pedido.
   */
  async saltar(id: string | bigint, dto: SaltarPedidoDto, usuario: UsuarioAutenticado, ip?: string) {
    const pedidoId = this.parsearId(id);
    const partyId = BigInt(usuario.partyId);
    const texto: Record<string, string> = {
      NO_CONTESTA: 'Cliente no contesta',
      DIRECCION_NO_ENCONTRADA: 'Dirección no encontrada',
      TRAFICO: 'Tráfico o vía cerrada',
      OTRO: 'Otro',
    };
    const detalle = (dto.detalle ?? '').trim();
    if (dto.motivo === 'OTRO' && !detalle) {
      throw new BadRequestException({ codigo: 'DETALLE_REQUERIDO', mensaje: 'Cuéntanos el motivo del salto' });
    }
    const motivo = `Salto de orden: ${texto[dto.motivo]}${detalle ? ` (${detalle})` : ''}`;
    const { nuevoOrden, numeroRuta, siguienteNumeroRuta } = await this.prisma.$transaction(async (tx) => {
      const lista: any[] = await this.pendientesConOrden(tx, partyId);
      const pedido = lista.find((p) => p.id === pedidoId);
      if (!pedido) throw new ConflictException({ codigo: 'NO_EN_RUTA', mensaje: 'Ese pedido no está en tu ruta' });
      if (lista.length < 2) {
        throw new ConflictException({ codigo: 'SIN_OTROS', mensaje: 'No hay otro pedido en tu ruta al que pasar el turno' });
      }
      const previos = await tx.pedidoEstadoHistorial.count({
        where: { pedido_id: pedidoId, motivo: { startsWith: 'Salto de orden' } },
      });
      if (previos >= 2) {
        throw new ConflictException({ codigo: 'TOPE_SALTOS', mensaje: 'Ya saltaste este pedido 2 veces: reporta la falla' });
      }
      const ultimo = Math.max(...lista.map((p) => p.orden_ruta as number)) + 1;
      await tx.pedido.update({ where: { id: pedidoId }, data: { orden_ruta: ultimo } });
      await tx.pedidoEstadoHistorial.create({
        data: { pedido_id: pedidoId, estado_anterior: pedido.estado, estado_nuevo: pedido.estado, motivo, por_party_id: partyId, en: new Date() },
      });
      // numero_ruta no cambia: el saltado conserva su número y le toca el siguiente pendiente
      return { nuevoOrden: ultimo, numeroRuta: pedido.numero_ruta ?? null, siguienteNumeroRuta: (lista.find((p) => p.id !== pedidoId)?.numero_ruta as number | undefined) ?? null };
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'repartos', accion: 'SALTAR', resultado: 'OK',
      entidad: 'pedido', entidadId: pedidoId, partyId, ip, motivo, despues: { ordenRuta: nuevoOrden },
    });
    this.eventosGateway?.emitirAdmin('reparto:rutas', {});
    return { id: String(pedidoId), ordenRuta: nuevoOrden, numeroRuta, siguienteNumeroRuta };
  }

  /**
   * POST /admin/repartos/tomar-ruta (repartos/tomar): toma los pedidos en el orden elegido por el repartidor.
   * Todo o nada: una transacción con SELECT ... FOR UPDATE; si alguno falla responde 409 con el código del pedido.
   * Guarda orden_ruta (1 = primera parada, a continuación de lo que ya lleva).
   */
  async tomarRuta(dto: TomarRutaDto, usuario: UsuarioAutenticado, ip?: string) {
    const partyId = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();
    const ids = [...new Set((dto?.ids ?? []).map((i) => String(i).trim()).filter(Boolean))];
    if (ids.length === 0 || ids.some((i) => !/^\d+$/.test(i))) {
      throw new BadRequestException({ codigo: 'IDS_INVALIDOS', mensaje: 'Elige al menos un pedido para la ruta' });
    }
    const idsAsc = ids.map((i) => BigInt(i)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const ahora = new Date();
    const conflicto = (codigo: string, pedido: string, mensaje: string) =>
      new ConflictException({ codigo, pedido, mensaje });

    const { nuevos, filas } = await this.prisma.$transaction(
      async (tx) => {
        const bloqueadas: any[] = await tx.$queryRaw`
          SELECT p.id, p.codigo, p.modalidad, p.estado, p.repartidor_party_id,
                 p.anulado_en, p.motivo_falla, p.entrega_lat, p.entrega_lng,
                 p.pago_estado, p.pago_metodo, p.total
          FROM pedido p
          WHERE p.id IN (${Prisma.join(idsAsc)})
          ORDER BY p.id ASC
          FOR UPDATE
        `;
        const porId = new Map<string, any>(bloqueadas.map((r) => [String(r.id), r]));
        const nuevos: bigint[] = [];
        for (const id of ids) {
          const r = porId.get(id);
          if (!r || r.modalidad !== 'DELIVERY' || r.anulado_en != null) {
            throw conflicto('NO_DISPONIBLE', r?.codigo ?? id, `El pedido ${r?.codigo ?? id} ya no está disponible`);
          }
          if (r.repartidor_party_id != null) {
            if (BigInt(r.repartidor_party_id) === partyId && r.estado === 'LISTO') continue; // ya suyo: solo se reordena
            throw conflicto('YA_TOMADO', r.codigo, `El pedido ${r.codigo} ya lo tomó otro repartidor`);
          }
          if (['COLA', 'PREPARANDO'].includes(r.estado)) {
            throw conflicto('AUN_NO_DISPONIBLE', r.codigo, `El pedido ${r.codigo} aún no está disponible`);
          }
          if (r.estado !== 'LISTO' || r.motivo_falla != null || r.entrega_lat == null || r.entrega_lng == null) {
            throw conflicto('NO_DISPONIBLE', r.codigo, `El pedido ${r.codigo} ya no está disponible`);
          }
          nuevos.push(r.id);
        }

        const previos = await tx.pedido.findMany({
          where: { repartidor_party_id: partyId, estado: { in: ['LISTO', 'EN_CAMINO'] } },
          select: { id: true },
        });
        const previosFuera = previos.filter((x) => !ids.includes(String(x.id))).length;
        if (previos.length + nuevos.length > config.maxPedidos) {
          throw new ConflictException({
            codigo: 'LIMITE_PEDIDOS',
            mensaje: `Tu ruta supera el máximo de ${config.maxPedidos} pedidos: entrega alguno antes de tomar otro`,
          });
        }

        if (nuevos.length > 0) {
          const act = await tx.pedido.updateMany({
            where: { id: { in: nuevos }, estado: 'LISTO', repartidor_party_id: null },
            data: { repartidor_party_id: partyId, tomado_en: ahora },
          });
          if (act.count !== nuevos.length) {
            throw conflicto('YA_TOMADO', '', 'Otro repartidor tomó parte de la ruta');
          }
          for (const id of nuevos) {
            await tx.pedidoEstadoHistorial.create({
              data: {
                pedido_id: id, estado_anterior: 'LISTO', estado_nuevo: 'LISTO',
                motivo: 'Tomado por repartidor (ruta propia)', por_party_id: partyId, en: ahora,
              },
            });
          }
        }
        const baseNum = await this.maxNumeroRuta(tx, partyId, ids.map((i) => BigInt(i)));
        for (let i = 0; i < ids.length; i++) {
          await tx.pedido.update({
            where: { id: BigInt(ids[i]) },
            data: { orden_ruta: previosFuera + i + 1, numero_ruta: baseNum + i + 1 },
          });
        }
        await sumarARuta(tx, partyId, idsAsc, 'TOMAR_RUTA', ahora);
        const filas = await tx.pedido.findMany({
          where: { id: { in: idsAsc } },
          include: { zona: true, lineas: { select: { cantidad: true } } },
        });
        return { nuevos, filas };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 },
    );

    for (const id of nuevos) {
      await this.auditoria.registrar({
        categoria: 'CAMBIO', modulo: 'repartos', accion: 'TOMAR', resultado: 'OK',
        entidad: 'pedido', entidadId: id, partyId, ip,
      });
    }
    for (const f of filas.filter((x) => nuevos.includes(x.id))) {
      this.eventosGateway?.emitirAdmin('pedido:estado', {
        id: Number(f.id), codigo: f.codigo, estado: f.estado, repartidor_party_id: String(partyId),
      });
    }

    const pos = new Map(ids.map((id, i) => [id, i]));
    return {
      tomados: filas
        .sort((a, b) => (pos.get(String(a.id)) ?? 0) - (pos.get(String(b.id)) ?? 0))
        .map((f) => ({ ...this.formatearPedidoReparto(f, config, ahora, usuario), ordenRuta: f.orden_ruta, numeroRuta: f.numero_ruta ?? null })),
    };
  }

  /**
   * GET /admin/repartos/rutas-sugeridas (repartos/ver):
   * Varias opciones de ruta (una por sector) para los pedidos LISTO sin repartidor, calculadas en el servidor.
   * Al repartidor se le limita cada ruta a su cupo libre (rep_max_pedidos menos lo que ya lleva).
   */
  async listarRutasSugeridas(usuario?: UsuarioAutenticado) {
    const config = await this.obtenerParametrosReparto();
    const cfgEta = await leerConfigEta(this.prisma);
    const filaMax = (
      await this.prisma.parametro.findMany({ where: { clave: { in: ['reparto_rutas_sugeridas_max'] } } })
    )[0];
    const maxOpciones = Math.min(5, Math.max(1, Math.round(Number(filaMax?.valor)) || 3));

    let cupo = config.maxPedidos;
    if (usuario?.rol === 'REPARTIDOR') {
      const activos = await this.prisma.pedido.count({
        where: { repartidor_party_id: BigInt(usuario.partyId), estado: { in: ['LISTO', 'EN_CAMINO'] } },
      });
      cupo = Math.max(0, config.maxPedidos - activos);
    }

    const filas = await this.prisma.pedido.findMany({
      where: { modalidad: 'DELIVERY', estado: 'LISTO', repartidor_party_id: null, motivo_falla: null },
      select: {
        id: true, codigo: true, cliente_nombre: true, entrega_lat: true, entrega_lng: true,
        creado_en: true, eta_max: true,
      },
      orderBy: { creado_en: 'asc' },
    });
    const ahora = new Date();
    const resultado = sugerirRutas(
      filas.map((p) => ({
        id: String(p.id),
        codigo: p.codigo,
        cliente: p.cliente_nombre ?? '',
        lat: p.entrega_lat == null ? null : Number(p.entrega_lat),
        lng: p.entrega_lng == null ? null : Number(p.entrega_lng),
        creadoEn: p.creado_en,
        prometidoMin: p.eta_max ?? cfgEta.respaldoMin,
      })),
      {
        sede: cfgEta.local,
        velocidadKmh: cfgEta.velocidadKmh,
        factorUrbano: cfgEta.factorUrbano,
        paradaMin: cfgEta.paradaMin,
        maxPorRuta: Math.max(1, cupo),
        maxOpciones,
        ahora,
      },
    );
    return {
      ...resultado,
      opciones: cupo > 0 ? resultado.opciones : [],
      cupo,
      sede: cfgEta.local,
      generadoEn: ahora.toISOString(),
    };
  }

  /**
   * POST /admin/repartos/rutas-sugeridas/:idOpcion/tomar (repartos/tomar):
   * Asigna TODOS los pedidos de la opción al repartidor (o, si lo hace Caja/Admin, al elegido) en una sola
   * transacción con SELECT ... FOR UPDATE. Si alguno ya no está libre se aborta todo: 409 RUTA_YA_TOMADA.
   * Idempotente: repetir la toma con los mismos pedidos ya suyos responde igual sin escribir de nuevo.
   * El pedido queda LISTO asignado: la salida sigue siendo «Mi ruta» (iniciar-ruta), sin duplicar reglas.
   */
  async tomarRutaSugerida(
    idOpcion: string,
    dto: TomarRutaSugeridaDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const actor = BigInt(usuario.partyId);
    const config = await this.obtenerParametrosReparto();
    const ids = [...new Set((dto?.pedidoIds ?? []).map((i) => String(i).trim()).filter(Boolean))];
    if (ids.length === 0 || ids.some((i) => !/^\d+$/.test(i)) || calcularIdOpcion(ids) !== idOpcion) {
      throw new BadRequestException({
        codigo: 'OPCION_INVALIDA',
        mensaje: 'La opción de ruta no coincide con sus pedidos: actualiza las opciones',
      });
    }

    let destino = actor;
    if (usuario.rol === 'REPARTIDOR') {
      if (dto.repartidorPartyId && dto.repartidorPartyId !== String(actor)) {
        throw new ForbiddenException({ codigo: 'NO_ASIGNADO', mensaje: 'Solo puedes tomar rutas para ti' });
      }
    } else {
      if (!dto.repartidorPartyId) {
        throw new BadRequestException({ codigo: 'REPARTIDOR_REQUERIDO', mensaje: 'Elige el repartidor de la ruta' });
      }
      destino = this.parsearId(dto.repartidorPartyId);
      const cuenta = await this.prisma.userAccount.findUnique({ where: { party_id: destino } });
      if (!cuenta || cuenta.rol !== 'REPARTIDOR' || !cuenta.activo) {
        throw new BadRequestException({
          codigo: 'REPARTIDOR_INVALIDO',
          mensaje: 'El usuario destino no es un repartidor activo válido',
        });
      }
    }

    const idsAsc = ids.map((i) => BigInt(i)).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const ahora = new Date();

    const { nuevos, filas } = await this.prisma.$transaction(
      async (tx) => {
        const bloqueadas: any[] = await tx.$queryRaw`
          SELECT p.id, p.codigo, p.modalidad, p.estado, p.repartidor_party_id,
                 p.anulado_en, p.motivo_falla, p.entrega_lat, p.entrega_lng,
                 p.pago_estado, p.pago_metodo, p.total
          FROM pedido p
          WHERE p.id IN (${Prisma.join(idsAsc)})
          ORDER BY p.id ASC
          FOR UPDATE
        `;
        const porId = new Map<string, any>(bloqueadas.map((r) => [String(r.id), r]));
        const cambiados: Array<{ pedidoId: string; codigo: string; motivo: string; tomadoPor?: string }> = [];
        const nuevos: bigint[] = [];

        const otros = [
          ...new Set(
            bloqueadas
              .filter((r) => r.repartidor_party_id != null && BigInt(r.repartidor_party_id) !== destino)
              .map((r) => BigInt(r.repartidor_party_id)),
          ),
        ];
        const personas = otros.length ? await tx.person.findMany({ where: { party_id: { in: otros } } }) : [];
        const nombre = new Map(personas.map((p) => [String(p.party_id), `${p.nombres} ${p.apellidos ?? ''}`.trim()]));

        for (const id of ids) {
          const r = porId.get(id);
          if (!r) {
            cambiados.push({ pedidoId: id, codigo: 'DESCONOCIDO', motivo: 'NO_DISPONIBLE' });
          } else if (r.repartidor_party_id != null) {
            if (BigInt(r.repartidor_party_id) === destino && ['LISTO', 'EN_CAMINO'].includes(r.estado)) continue; // ya suyo
            cambiados.push({
              pedidoId: id,
              codigo: r.codigo,
              motivo: 'OTRO_REPARTIDOR',
              tomadoPor: nombre.get(String(r.repartidor_party_id)) || `Repartidor #${r.repartidor_party_id}`,
            });
          } else if (
            r.modalidad !== 'DELIVERY' || r.estado !== 'LISTO' || r.anulado_en != null ||
            r.motivo_falla != null || r.entrega_lat == null || r.entrega_lng == null
          ) {
            cambiados.push({ pedidoId: id, codigo: r.codigo, motivo: 'NO_DISPONIBLE' });
          } else {
            nuevos.push(r.id);
          }
        }
        if (cambiados.length > 0) {
          throw new ConflictException({
            codigo: 'RUTA_YA_TOMADA',
            mensaje: 'Otro repartidor tomó parte de esta ruta; actualizamos las opciones',
            pedidos: cambiados,
          });
        }

        if (nuevos.length > 0) {
          const activos = await tx.pedido.count({
            where: { repartidor_party_id: destino, estado: { in: ['LISTO', 'EN_CAMINO'] } },
          });
          if (activos + nuevos.length > config.maxPedidos) {
            throw new ConflictException({
              codigo: 'LIMITE_PEDIDOS',
              mensaje: `Esta ruta supera el máximo de ${config.maxPedidos} pedidos: entrega alguno antes de tomarla`,
            });
          }
          const act = await tx.pedido.updateMany({
            where: { id: { in: nuevos }, estado: 'LISTO', repartidor_party_id: null },
            data: { repartidor_party_id: destino, tomado_en: ahora, orden_ruta: null, numero_ruta: null },
          });
          if (act.count !== nuevos.length) {
            throw new ConflictException({ codigo: 'RUTA_YA_TOMADA', mensaje: 'Otro repartidor tomó parte de esta ruta; actualizamos las opciones', pedidos: [] });
          }
          for (const id of nuevos) {
            await tx.pedidoEstadoHistorial.create({
              data: {
                pedido_id: id,
                estado_anterior: 'LISTO',
                estado_nuevo: 'LISTO',
                motivo: 'Ruta sugerida tomada',
                por_party_id: actor,
                en: ahora,
              },
            });
          }
        }
        await sumarARuta(tx, destino, nuevos, 'SUGERIDA', ahora);
        const filas = await tx.pedido.findMany({
          where: { id: { in: idsAsc } },
          include: { zona: true, lineas: { select: { cantidad: true } } },
        });
        return { nuevos, filas };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10000 },
    );

    if (nuevos.length > 0) {
      for (const id of nuevos) {
        await this.auditoria.registrar({
          categoria: 'CAMBIO', modulo: 'repartos', accion: 'TOMAR_RUTA', resultado: 'OK',
          entidad: 'pedido', entidadId: id, partyId: actor, ip, motivo: idOpcionLog(idOpcion, destino),
        });
      }
      for (const f of filas.filter((x) => nuevos.includes(x.id))) {
        this.eventosGateway?.emitirAdmin('pedido:estado', {
          id: Number(f.id), codigo: f.codigo, estado: f.estado, repartidor_party_id: String(destino),
        });
      }
      this.eventosGateway?.emitirAdmin('reparto:rutas', {
        idOpcion, pedidoIds: ids, repartidor_party_id: String(destino),
      });
    }

    const orden = new Map(ids.map((id, i) => [id, i]));
    return {
      idOpcion,
      repartidor_party_id: String(destino),
      tomados: filas
        .sort((a, b) => (orden.get(String(a.id)) ?? 0) - (orden.get(String(b.id)) ?? 0))
        .map((f) => this.formatearPedidoReparto(f, config, ahora, usuario)),
    };
  }
}

const idOpcionLog = (id: string, destino: bigint) => `${id} -> repartidor ${destino}`;
