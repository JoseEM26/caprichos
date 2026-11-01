import { explicarPedidosPorId } from '../clientes/explicar-puntos-pedidos';
import { PuntosService } from '../clientes/puntos.service';
import { mediosDigitalesDelPedido, montoDigitalDePlan } from '../pedidos/pago-plan.service';
import { progresoDelPedido } from '../pedidos/progreso-pedido';
import { CONFIG_ETA_DEFECTO, leerConfigEta } from '../repartos/eta-entrega';
import { StockService } from '../stock/stock.service';
import { ImpresionService } from '../impresion/impresion.service';
import { SalonService } from '../salon/salon.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import {
  exigirPinNoBloqueado,
  limpiarIntentosPin,
  registrarFalloPin,
} from '../../comun/redis/intentos-pin';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import {
  SupervisorCodigoService,
  autorizarAdminSinCodigo,
} from '../supervisor-codigo/supervisor-codigo.service';
import { exigirComprobanteDigital, voucherCubreMedio } from '../caja/comprobante-pago.util';
import { puedeCambiarVoucher, puedeSubirVoucher } from '../vouchers/regla-cambio-voucher';
import { MEDIOS_CON_VOUCHER_CAJA } from '../vouchers/vouchers.service';
import { exigirCajaAbiertaHoy } from '../caja/caja.calculo';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { enmascararDni } from '../usuarios/usuarios.util';
import { FiltrarPedidosDto } from './dto/filtrar-pedidos.dto';
import { RangoMisPedidos } from './dto/mis-pedidos-query.dto';
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
  /** Efectivo que el mozo recibió (Pagó con S/); null si no hubo efectivo o no lo escribió. */
  recibido: number | null;
  vuelto: number | null;
  /** Comprobante que pidió el mozo; null si es nota de venta. */
  pide: 'BOLETA' | 'FACTURA' | null;
}

@Injectable()
export class PedidosEstadoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly eventosGateway?: EventosGateway,
    @Optional() private readonly salonService?: SalonService,
    @Optional() private readonly puntosService?: PuntosService,
    @Optional() private readonly stockService?: StockService,
    @Optional() private readonly supervisorCodigoService?: SupervisorCodigoService,
    @Optional() private readonly impresionService?: ImpresionService,
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
   * Verifica el código rotativo de 6 dígitos del supervisor (RFC 6238 TOTP).
   * 3 intentos fallidos consecutivos bloquean 1 minuto en Redis.
   */
  async verificarPinSupervisor(
    pinSupervisor?: string,
    partyIdOperador?: bigint,
    ip?: string,
    pedidoId?: bigint,
    accion = 'pedidos/anular',
  ): Promise<{ party_id?: bigint; id?: bigint; supervisorPartyId?: bigint }> {
    if (this.supervisorCodigoService) {
      return this.supervisorCodigoService.verificarYConsumirCodigo(
        pinSupervisor,
        partyIdOperador,
        accion,
        ip,
        'pedido',
        pedidoId,
      );
    }

    // Mismo criterio que el servicio: el ADMIN no da código.
    const admin = await autorizarAdminSinCodigo(this.prisma, this.auditoria, partyIdOperador, accion, ip, 'pedido', pedidoId);
    if (admin) return { party_id: admin.party_id, id: admin.id, supervisorPartyId: admin.party_id };

    const claveIntentos = `pin:supervisor:intentos:${partyIdOperador ?? 'general'}`;
    const redis = this.redisService.obtenerCliente();
    await exigirPinNoBloqueado(redis, claveIntentos);
    await registrarFalloPin(redis, claveIntentos);
    throw new HttpException(
      {
        codigo: 'CODIGO_INVALIDO',
        mensaje: 'Código de supervisor inválido o no proporcionado',
      },
      HttpStatus.FORBIDDEN,
    );
  }

  /**
   * Lista los pedidos con filtros, paginación, cálculo de espera y enmascaramiento de comprobante (DT-69, DT-75).
   */
  async listar(filtros: FiltrarPedidosDto, usuarioActual?: UsuarioAutenticado) {
    const where: any = {};

    if (filtros.estado) {
      where.estado = filtros.estado;
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
      ];
    }

    if (usuarioActual && usuarioActual.rol === 'REPARTIDOR') {
      where.repartidor_party_id = BigInt(usuarioActual.partyId);
    }

    const pagina = Math.max(1, Number(filtros.pagina) || 1);
    const limite = Math.min(100, Math.max(1, Number(filtros.limite) || 20));
    const skip = (pagina - 1) * limite;

    const [total, pedidos, umbrales] = await Promise.all([
      this.prisma.pedido.count({ where }),
      this.prisma.pedido.findMany({
        where,
        skip,
        take: limite,
        orderBy: { creado_en: 'desc' },
        include: {
          lineas: {
            include: {
              opcionesElegidas: true,
              area: true,
            },
          },
          zona: true,
          cobros: {
            where: { anulado_en: null },
            select: { id: true },
            take: 1,
          },
        },
      }),
      this.obtenerUmbrales(),
    ]);

    const ahora = new Date();
    const esAdmin = usuarioActual?.rol === 'ADMIN';
    const cobrosMozo = await this.cobrosMozoDe(pedidos);

    const items = pedidos.map((p) => {
      const { minutosEspera, color, colorEspera } = this.calcularMinutosYColor(
        p.creado_en,
        ahora,
        umbrales.naranjaMin,
        umbrales.rojoMin,
      );

      const cobroVigenteId = p.cobros?.[0]?.id ? String(p.cobros[0].id) : null;

      return {
        ...p,
        cobro_vigente_id: cobroVigenteId,
        cobroMozo: cobrosMozo.get(String(p.id)) ?? null,
        comprobante_doc: esAdmin ? p.comprobante_doc : enmascararDni(p.comprobante_doc || ''),
        minutosEspera,
        color,
        colorEspera,
      };
    });

    return {
      total,
      pagina,
      limite,
      items,
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
        take: 1,
        select: { en: true },
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
        where: {
          estado: 'ANULADO',
          mensajesReparto: {
            some: {
              numero: NUMERO_PREGUNTA_REPROG,
              estado: {
                in: [ESTADO_REPROG.NO_REPROGRAMAR, ESTADO_REPROG.SIN_RESPUESTA, ESTADO_REPROG.TOPE_ALCANZADO],
              },
            },
          },
        },
        include: incluir,
        orderBy: { anulado_en: 'desc' },
        take: 200,
      }),
    ]);

    const filas = (p: any, enLista: boolean) => {
      const pago = String(p.pago_estado || '').toUpperCase();
      const pregunta = p.mensajesReparto?.[0]?.estado as string | undefined;
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
        revisar_devolucion: !enLista && (pago === 'PAGADO' || pago === 'COORDINADO'),
      };
    };

    const reprogramar = porReprogramar.map((p) => filas(p, true));
    const cancelacion = cancelados.map((p) => filas(p, false));
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
  async misPedidos(usuario: UsuarioAutenticado, rango: RangoMisPedidos = 'hoy') {
    const inicioHoy = obtenerInicioDiaLima();
    const DIA = 24 * 60 * 60 * 1000;
    const creado_en =
      rango === 'ayer'
        ? { gte: new Date(inicioHoy.getTime() - DIA), lt: inicioHoy }
        : rango === '7dias'
          ? { gte: new Date(inicioHoy.getTime() - 6 * DIA) }
          : { gte: inicioHoy };

    const pedidos = await this.prisma.pedido.findMany({
      where: { canal: 'MOZO', party_id: BigInt(usuario.partyId), creado_en },
      orderBy: { creado_en: 'desc' },
      select: {
        id: true,
        codigo: true,
        estado: true,
        modalidad: true,
        mesa_nombre: true,
        total: true,
        pago_estado: true,
        pago_metodo: true,
        pago_coordinado_en: true,
        cliente_nombre: true,
        creado_en: true,
        entregado_mesa_en: true,
        repartidor_party_id: true,
        despachado_en: true,
        eta_min: true,
        eta_max: true,
        lineas: {
          select: {
            nombre: true,
            cantidad: true,
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

    return {
      pedidos: pedidos.map((p) => ({
        id: String(p.id),
        codigo: p.codigo,
        estado: p.estado,
        modalidad: p.modalidad,
        mesaNombre: p.mesa_nombre,
        // Nombre del cliente para reconocer el pedido; nunca teléfono ni DNI. Mesa sin nombre: la mesa.
        clienteNombre: p.cliente_nombre?.trim() || (p.modalidad === 'MESA' ? p.mesa_nombre : null) || null,
        total: Number(p.total),
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
          Number(p.total),
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
        lineas: p.lineas.map((l) => ({ nombre: l.nombre, cantidad: l.cantidad })),
        // Estado de cocina y entrega (misma función que el seguimiento de la carta)
        progreso: progresoDelPedido(p, { cfg, ahora }),
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
          // Pago digital (Yape, Plin, transferencia) sin validar: no pasa a cocina hasta aprobar el voucher o coordinar el pago
          NOT: {
            pago_metodo: { in: ['YAPE', 'PLIN', 'TRANSFERENCIA'] },
            pago_estado: 'PENDIENTE',
            pago_coordinado_en: null,
            modalidad: { not: 'MESA' },
          },
        },
        orderBy: { creado_en: 'asc' }, // Más viejos primero
        include: {
          lineas: {
            include: {
              opcionesElegidas: true,
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
        lineas: p.lineas,
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
      const recibido = p.cobro_mozo_recibido != null ? Number(p.cobro_mozo_recibido) : null;
      const vuelto =
        recibido != null ? Math.round((recibido - (efectivoDe.get(String(p.id)) ?? 0)) * 100) / 100 : null;
      const tipo = p.comprobante_tipo;
      mapa.set(String(p.id), {
        en: p.cobro_mozo_en,
        medio: p.cobro_mozo_medio,
        mozo: p.cobro_mozo_party_id != null ? nombreMozo.get(String(p.cobro_mozo_party_id)) || null : null,
        faltaVoucher: conVouch && !pedidosConVoucher.has(String(p.id)),
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

    return {
      ...pedido,
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
   * Cambia el estado de un pedido validando transiciones, permisos y PIN de supervisor para anulación (DT-58, DT-61).
   */
  async cambiarEstado(
    id: bigint | string | number,
    dto: CambiarEstadoDto,
    usuarioActual: UsuarioAutenticado,
    pinSupervisor?: string,
    ip?: string,
    codigoVerificado = false,
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

    // 1. Manejo de Anulación (DT-61)
    if (nuevoEstado === 'ANULADO') {
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

      // Validar permiso de anular (en un entregado sin cobro lo autoriza el PIN de supervisor)
      if (!entregadoSinCobro && usuarioActual.rol !== 'ADMIN') {
        const tienePermiso = await this.prisma.rolPermiso.findFirst({
          where: {
            rol: usuarioActual.rol,
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

      // Código de supervisor (6 dígitos, ADMIN activo). Un ADMIN anula un entregado sin cobro solo con motivo
      const conPin = !(entregadoSinCobro && usuarioActual.rol === 'ADMIN');
      const aprobadoPor = !conPin
        ? usuarioActual.partyId
        : codigoVerificado
          ? usuarioActual.partyId
          : (await this.verificarPinSupervisor(pinSupervisor, usuarioActual.partyId, ip, pedido.id))
              .party_id ?? usuarioActual.partyId;

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
      for (const paso of [
        () => this.puntosService?.reversarPorPedido(pedido.id),
        () => this.stockService?.revertirPorPedido(pedido.id, undefined, usuarioActual?.partyId),
      ]) {
        try {
          await paso();
        } catch {
          // idempotente
        }
      }

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
        conPinAdmin: conPin,
        ip,
      });

      // Emitir evento por WebSocket
      this.eventosGateway?.emitirAdmin('pedido:estado', {
        id: Number(pedido.id),
        codigo: pedido.codigo,
        estado: 'ANULADO',
      });

      // un pedido anulado libera sus mesas
      try {
        await this.salonService?.liberarMesasDePedido(pedido.id);
      } catch {
        // idempotente: se puede liberar a mano
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

    // Un delivery no se marca entregado sin repartidor: su efectivo no tendría quién lo liquide
    if (nuevoEstado === 'ENTREGADO' && pedido.modalidad === 'DELIVERY' && !pedido.repartidor_party_id) {
      throw new ConflictException({
        codigo: 'REPARTIDOR_REQUERIDO',
        mensaje: 'Asigna un repartidor antes de marcar el pedido como entregado',
      });
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
      include: { planPago: true },
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

    const metodoUpper = dto.metodo.toUpperCase().trim();
    if (!METODOS_PAGO_PERMITIDOS.includes(metodoUpper as any)) {
      throw new BadRequestException({
        codigo: 'METODO_INVALIDO',
        mensaje: `El método de pago '${dto.metodo}' no es válido`,
      });
    }

    // Confirmar un pago (COORDINADO o PAGADO) exige caja abierta; el pedido en sí no depende de la caja
    await exigirCajaAbiertaHoy(this.prisma);

    // Pago digital (Yape, Plin, transferencia): exige un voucher útil (un ILEGIBLE no cuenta) o la excepción
    // con código del supervisor. Misma regla que el cobro y el pago coordinado (comprobante-pago.util).
    const sinVoucherAutorizado = await exigirComprobanteDigital({
      db: this.prisma,
      pedidoId: pedido.id,
      medios: [metodoUpper],
      planPago: pedido.planPago,
      sinVoucher: dto.sinVoucher,
      permiteExcepcion: true,
      verificarPin: (pin) =>
        this.verificarPinSupervisor(pin, usuarioActual.partyId, ip, pedido.id, 'pedidos/registrar_pago_sin_voucher'),
    });

    const ahora = new Date();
    const pedidoActualizado = await this.prisma.pedido.update({
      where: { id: pedido.id },
      data: {
        pago_metodo: metodoUpper,
        pago_estado: dto.estado,
        pago_coordinado_en: ahora,
        pago_coordinado_por: usuarioActual.partyId,
      },
    });

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
        pago_estado: dto.estado,
        sin_voucher: sinVoucherAutorizado
          ? { motivo: sinVoucherAutorizado.motivo, aprobado_por: sinVoucherAutorizado.supervisorPartyId }
          : null,
      },
      partyId: usuarioActual.partyId,
      ...(sinVoucherAutorizado ? { conPinAdmin: true, motivo: sinVoucherAutorizado.motivo } : {}),
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
    if (dto.estado === 'PAGADO') {
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
