import { PuntosService } from '../clientes/puntos.service';
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
import { SupervisorCodigoService } from '../supervisor-codigo/supervisor-codigo.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { enmascararDni } from '../usuarios/usuarios.util';
import { FiltrarPedidosDto } from './dto/filtrar-pedidos.dto';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';
import { RegistrarPagoDto } from './dto/registrar-pago.dto';
import {
  calcularSiguienteMedianocheLima,
  obtenerInicioDiaLima,
} from '../cocina/cocina.util';

export type ColorEspera = 'verde' | 'naranja' | 'rojo';

export const METODOS_PAGO_PERMITIDOS = [
  'EFECTIVO',
  'YAPE',
  'PLIN',
  'TARJETA',
  'TRANSFERENCIA',
] as const;

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
   * 3 intentos fallidos consecutivos bloquean 5 minutos en Redis.
   */
  async verificarPinSupervisor(
    pinSupervisor?: string,
    partyIdOperador?: bigint,
    ip?: string,
    pedidoId?: bigint,
  ): Promise<{ party_id?: bigint; id?: bigint }> {
    if (this.supervisorCodigoService) {
      return this.supervisorCodigoService.verificarYConsumirCodigo(
        pinSupervisor,
        partyIdOperador,
        'pedidos/anular',
        ip,
        'pedido',
        pedidoId,
      );
    }

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
    if (filtros.desde || filtros.hasta) {
      where.creado_en = {};
      if (filtros.desde) {
        where.creado_en.gte = new Date(filtros.desde);
      }
      if (filtros.hasta) {
        where.creado_en.lte = new Date(filtros.hasta);
      }
    }
    if (filtros.buscar) {
      const q = filtros.buscar.trim();
      where.OR = [
        { codigo: { contains: q, mode: 'insensitive' } },
        { cliente_nombre: { contains: q, mode: 'insensitive' } },
      ];
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

    return {
      ...pedido,
      cobro_vigente_id: cobroVigenteId,
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

    const pedidoActualizado = await this.prisma.pedido.update({
      where: { id: pedido.id },
      data: datosActualizacion,
    });

    // Registrar en historial de estados
    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedido.id,
        estado_anterior: estadoAnterior,
        estado_nuevo: nuevoEstado,
        motivo: dto.motivo?.trim() || null,
        por_party_id: usuarioActual.partyId,
        en: ahora,
      },
    });

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
    });

    if (!pedido) {
      throw new NotFoundException({
        codigo: 'PEDIDO_NO_ENCONTRADO',
        mensaje: 'Pedido no encontrado',
      });
    }

    const metodoUpper = dto.metodo.toUpperCase().trim();
    if (!METODOS_PAGO_PERMITIDOS.includes(metodoUpper as any)) {
      throw new BadRequestException({
        codigo: 'METODO_INVALIDO',
        mensaje: `El método de pago '${dto.metodo}' no es válido`,
      });
    }

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
      accion: 'REGISTRAR_PAGO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      antes: { pago_metodo: pedido.pago_metodo, pago_estado: pedido.pago_estado },
      despues: { pago_metodo: metodoUpper, pago_estado: dto.estado },
      partyId: usuarioActual.partyId,
      ip,
    });

    this.eventosGateway?.emitirAdmin('pedido:estado', {
      id: Number(pedido.id),
      codigo: pedido.codigo,
      estado: pedido.estado,
    });

    return pedidoActualizado;
  }
}
