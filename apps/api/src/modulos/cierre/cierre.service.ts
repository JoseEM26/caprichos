import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ArqueoDto } from './dto/arqueo.dto';
import { CerrarCajaDto } from './dto/cerrar-caja.dto';
import { LiquidarRepartidorDto } from './dto/liquidar.dto';
import { HistorialCierresDto } from './dto/historial.dto';
import { calcularTotalConteo } from './cierre.util';

export interface MontosSistema {
  esperadoEfectivo: number;
  sistemaYape: number;
  sistemaPlin: number;
  sistemaTransferencia: number;
  sistemaTarjeta: number;
  ventasEfectivo: number;
  ingresos: number;
  egresos: number;
}

@Injectable()
export class CierreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly auditoria: AuditoriaService,
    private readonly eventosGateway: EventosGateway,
  ) {}

  /**
   * Obtiene la caja actualmente abierta (solo puede haber una según ux_una_caja_abierta).
   */
  async obtenerCajaAbierta() {
    const caja = await this.prisma.caja.findFirst({
      where: { estado: 'ABIERTA' },
      orderBy: { id: 'desc' },
    });
    if (!caja) {
      throw new HttpException(
        {
          codigo: 'NO_HAY_CAJA_ABIERTA',
          mensaje: 'No hay ninguna caja abierta actualmente.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }
    return caja;
  }

  /**
   * Calcula los montos esperados por el sistema para una caja dada:
   * Efectivo esperado = apertura + cobros en efectivo (monto - vuelto) + ingresos - egresos.
   * Medios digitales = suma de cobro_pago de ese medio, sin cobros anulados.
   */
  async calcularMontosSistema(cajaId: bigint): Promise<MontosSistema> {
    const caja = await this.prisma.caja.findUnique({
      where: { id: cajaId },
    });
    if (!caja) {
      throw new NotFoundException('Caja no encontrada');
    }

    // 1. Cobros de la caja no anulados
    const cobros = await this.prisma.cobro.findMany({
      where: {
        caja_id: cajaId,
        anulado_en: null,
      },
      include: {
        pagos: true,
      },
    });

    let ventasEfectivo = 0;
    let sistemaYape = 0;
    let sistemaPlin = 0;
    let sistemaTransferencia = 0;
    let sistemaTarjeta = 0;

    for (const cobro of cobros) {
      for (const pago of cobro.pagos) {
        const medioNorm = (pago.medio || '').trim().toUpperCase();
        if (medioNorm === 'EFECTIVO') {
          // Fórmula: cobros en efectivo (monto - vuelto)
          const monto = Number(pago.monto);
          const vuelto = Number(pago.vuelto ?? 0);
          let neto = monto;
          if (pago.recibido !== null && pago.recibido !== undefined) {
            neto = Number(pago.recibido) - vuelto;
          } else if (vuelto > 0) {
            neto = monto - vuelto;
          }
          ventasEfectivo += neto;
        } else if (medioNorm === 'YAPE') {
          sistemaYape += Number(pago.monto);
        } else if (medioNorm === 'PLIN') {
          sistemaPlin += Number(pago.monto);
        } else if (medioNorm === 'TRANSFERENCIA') {
          sistemaTransferencia += Number(pago.monto);
        } else if (medioNorm === 'TARJETA') {
          sistemaTarjeta += Number(pago.monto);
        }
      }
    }

    // 2. Movimientos de caja no anulados
    const movimientos = await this.prisma.movimientoCaja.findMany({
      where: {
        caja_id: cajaId,
        anulado_en: null,
      },
    });

    let ingresos = 0;
    let egresos = 0;
    for (const mov of movimientos) {
      const tipoNorm = (mov.tipo || '').trim().toUpperCase();
      if (tipoNorm === 'INGRESO') {
        ingresos += Number(mov.monto);
      } else if (tipoNorm === 'EGRESO') {
        egresos += Number(mov.monto);
      }
    }

    const apertura = Number(caja.apertura);
    const esperadoEfectivo =
      Math.round((apertura + ventasEfectivo + ingresos - egresos) * 100) / 100;

    return {
      esperadoEfectivo,
      sistemaYape: Math.round(sistemaYape * 100) / 100,
      sistemaPlin: Math.round(sistemaPlin * 100) / 100,
      sistemaTransferencia: Math.round(sistemaTransferencia * 100) / 100,
      sistemaTarjeta: Math.round(sistemaTarjeta * 100) / 100,
      ventasEfectivo: Math.round(ventasEfectivo * 100) / 100,
      ingresos: Math.round(ingresos * 100) / 100,
      egresos: Math.round(egresos * 100) / 100,
    };
  }

  /**
   * Valida el PIN de 6 dígitos de un ADMIN activo contra user_account.pin_hash con argon2.
   * Tras 3 intentos fallidos bloquea temporalmente por 10 minutos en Redis (DT-61).
   */
  async verificarPinSupervisor(
    pinSupervisor?: string,
    partyIdOperador?: bigint,
    ip?: string,
    cajaId?: bigint,
  ): Promise<{ party_id: bigint; id: bigint }> {
    const claveIntentos = `pin:supervisor:intentos:${partyIdOperador ?? 'general'}`;
    const redis = this.redisService?.obtenerCliente?.();

    if (redis) {
      try {
        const intentosActuales = await redis.get(claveIntentos);
        if (intentosActuales && parseInt(intentosActuales, 10) >= 3) {
          throw new HttpException(
            {
              codigo: 'PIN_BLOQUEADO',
              mensaje:
                'Demasiados intentos fallidos de PIN de supervisor. Bloqueado temporalmente por 10 minutos.',
            },
            HttpStatus.FORBIDDEN,
          );
        }
      } catch (e: any) {
        if (e?.response?.codigo === 'PIN_BLOQUEADO') {
          throw e;
        }
      }
    }

    const pinLimpio = typeof pinSupervisor === 'string' ? pinSupervisor.trim() : '';
    const formatoValido = /^\d{6}$/.test(pinLimpio);

    let supervisorValido: { party_id: bigint; id: bigint } | null = null;

    if (formatoValido) {
      const admins = await this.prisma.userAccount.findMany({
        where: {
          rol: 'ADMIN',
          activo: true,
          pin_hash: { not: null },
        },
      });

      for (const admin of admins) {
        if (admin.pin_hash) {
          try {
            const coincide = await argon2.verify(admin.pin_hash, pinLimpio);
            if (coincide) {
              supervisorValido = { party_id: admin.party_id, id: admin.id };
              break;
            }
          } catch {
            // Continuar con el siguiente admin
          }
        }
      }
    }

    if (!supervisorValido) {
      if (redis) {
        try {
          const fallos = await redis.incr(claveIntentos);
          if (fallos === 1) {
            await redis.expire(claveIntentos, 10 * 60);
          }
        } catch {
          // Ignorar fallo de Redis si no está disponible
        }
      }

      await this.auditoria.registrar({
        categoria: 'ACCESO',
        modulo: 'cierre',
        accion: 'PIN_FALLIDO',
        resultado: 'RECHAZADO',
        entidad: 'caja',
        entidadId: cajaId,
        motivo: 'Intento de cierre o conteo con PIN de supervisor inválido o no proporcionado',
        partyId: partyIdOperador,
        ip,
      });

      throw new HttpException(
        {
          codigo: 'PIN_INVALIDO',
          mensaje: 'PIN de supervisor inválido o no proporcionado',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // PIN válido: reiniciar contador de fallos
    if (redis) {
      try {
        await redis.del(claveIntentos);
      } catch {
        // Ignorar fallo de Redis
      }
    }

    return supervisorValido;
  }

  /**
   * Arqueo ciego: registra el conteo físico por denominación y medios digitales.
   * La respuesta NUNCA entrega los montos esperados ni las diferencias (DT-61).
   */
  async arqueo(
    dto: ArqueoDto,
    usuario: UsuarioAutenticado,
    pinSupervisor?: string,
    ip?: string,
  ) {
    const caja = await this.obtenerCajaAbierta();

    // Contar intentos previos para esta caja
    const conteosPrevios = await this.prisma.conteoCierre.count({
      where: { caja_id: caja.id },
    });

    const nuevoIntento = conteosPrevios + 1;

    // Si ya fallaron 3 intentos previos, cualquier arqueo subsiguiente exige PIN de supervisor
    if (conteosPrevios >= 3) {
      if (!pinSupervisor) {
        throw new HttpException(
          {
            codigo: 'PIN_REQUERIDO',
            mensaje:
              'Se alcanzó el límite de 3 intentos de arqueo. Debe proceder al cierre con PIN de supervisor.',
          },
          HttpStatus.FORBIDDEN,
        );
      }
      await this.verificarPinSupervisor(pinSupervisor, usuario.partyId, ip, caja.id);
    }

    const vistoEfectivo = calcularTotalConteo(dto.conteo);
    const vistoYape = Number(dto.medios?.yape ?? 0);
    const vistoPlin = Number(dto.medios?.plin ?? 0);
    const vistoTransferencia = Number(dto.medios?.transferencia ?? 0);
    const vistoTarjeta = Number(dto.medios?.tarjeta ?? 0);

    const montos = await this.calcularMontosSistema(caja.id);

    const difEfectivo = Math.round((vistoEfectivo - montos.esperadoEfectivo) * 100) / 100;
    const difYape = Math.round((vistoYape - montos.sistemaYape) * 100) / 100;
    const difPlin = Math.round((vistoPlin - montos.sistemaPlin) * 100) / 100;
    const difTransferencia =
      Math.round((vistoTransferencia - montos.sistemaTransferencia) * 100) / 100;
    const difTarjeta = Math.round((vistoTarjeta - montos.sistemaTarjeta) * 100) / 100;

    const cuadra =
      Math.abs(difEfectivo) < 0.005 &&
      Math.abs(difYape) < 0.005 &&
      Math.abs(difPlin) < 0.005 &&
      Math.abs(difTransferencia) < 0.005 &&
      Math.abs(difTarjeta) < 0.005;

    const resultado: 'CUADRA' | 'NO_CUADRA' = cuadra ? 'CUADRA' : 'NO_CUADRA';

    await this.prisma.conteoCierre.create({
      data: {
        caja_id: caja.id,
        intento: nuevoIntento,
        conteo: dto.conteo as any,
        medios: dto.medios as any,
        resultado,
        por: usuario.partyId,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cierre',
      accion: 'ARQUEO',
      resultado: 'OK',
      entidad: 'caja',
      entidadId: caja.id,
      despues: {
        intento: nuevoIntento,
        resultado,
      },
      partyId: usuario.partyId,
      ip,
    });

    // Respuesta estrictamente ciega (DT-61)
    return {
      resultado,
      intento: nuevoIntento,
    };
  }

  /**
   * Cierra la caja del día.
   * Crea cierre_caja (inmutable) y cierre_medio por medio.
   * Exige que no haya cobros en curso.
   * Si no cuadra o tras 3 intentos, exige PIN de supervisor y notas.
   */
  async cerrar(
    dto: CerrarCajaDto,
    usuario: UsuarioAutenticado,
    pinSupervisor?: string,
    ip?: string,
  ) {
    const caja = await this.obtenerCajaAbierta();

    // 1. Validar que no haya cobros en curso ni pedidos pendientes de confirmación
    const cobrosEnCurso = await this.prisma.pedido.count({
      where: {
        pago_estado: { in: ['PENDIENTE', 'COORDINADO'] },
        estado: { not: 'ANULADO' },
      },
    });

    if (cobrosEnCurso > 0) {
      throw new HttpException(
        {
          codigo: 'COBROS_EN_CURSO',
          mensaje: `No se puede cerrar la caja: hay ${cobrosEnCurso} pedido(s) con cobro en curso o por confirmar.`,
        },
        HttpStatus.CONFLICT,
      );
    }

    // 2. Validar que no haya pedidos delivery entregados cobrados en efectivo sin liquidar (RN-CAP-097 / RQ-CIE-02-08)
    const repartidores = await this.listarRepartidoresPorLiquidar();
    const pendientes = repartidores.filter((r) => r.pendiente > 0);
    if (pendientes.length > 0) {
      const nombres = pendientes.map((r) => r.nombre).join(', ');
      throw new HttpException(
        {
          codigo: 'REPARTIDORES_SIN_LIQUIDAR',
          mensaje: `No se puede cerrar la caja: falta liquidar a repartidor(es): ${nombres}.`,
        },
        HttpStatus.CONFLICT,
      );
    }

    // 2. Obtener conteo y medios (del body o del último intento registrado)
    let conteo = dto.conteo;
    let medios = dto.medios;

    const conteosCaja = await this.prisma.conteoCierre.findMany({
      where: { caja_id: caja.id },
      orderBy: { intento: 'desc' },
    });

    if (!conteo || !medios) {
      if (conteosCaja.length === 0) {
        throw new HttpException(
          {
            codigo: 'ARQUEO_REQUERIDO',
            mensaje: 'Debe realizar el arqueo ciego antes de cerrar la caja.',
          },
          HttpStatus.BAD_REQUEST,
        );
      }
      conteo = conteo ?? (conteosCaja[0].conteo as any);
      medios = medios ?? (conteosCaja[0].medios as any);
    }

    const vistoEfectivo = calcularTotalConteo(conteo);
    const vistoYape = Number(medios?.yape ?? 0);
    const vistoPlin = Number(medios?.plin ?? 0);
    const vistoTransferencia = Number(medios?.transferencia ?? 0);
    const vistoTarjeta = Number(medios?.tarjeta ?? 0);

    const montos = await this.calcularMontosSistema(caja.id);

    const difEfectivo = Math.round((vistoEfectivo - montos.esperadoEfectivo) * 100) / 100;
    const difYape = Math.round((vistoYape - montos.sistemaYape) * 100) / 100;
    const difPlin = Math.round((vistoPlin - montos.sistemaPlin) * 100) / 100;
    const difTransferencia =
      Math.round((vistoTransferencia - montos.sistemaTransferencia) * 100) / 100;
    const difTarjeta = Math.round((vistoTarjeta - montos.sistemaTarjeta) * 100) / 100;

    const cuadra =
      Math.abs(difEfectivo) < 0.005 &&
      Math.abs(difYape) < 0.005 &&
      Math.abs(difPlin) < 0.005 &&
      Math.abs(difTransferencia) < 0.005 &&
      Math.abs(difTarjeta) < 0.005;

    const resultado: 'CUADRA' | 'NO_CUADRA' = cuadra ? 'CUADRA' : 'NO_CUADRA';

    let supervisorPartyId: bigint | null = null;

    // Si no cuadra o se han agotado los 3 intentos, se exige supervisor y notas
    if (!cuadra || conteosCaja.length >= 3) {
      if (!dto.nota || typeof dto.nota !== 'string' || dto.nota.trim().length < 3) {
        throw new HttpException(
          {
            codigo: 'NOTA_REQUERIDA',
            mensaje:
              'Se requiere una nota explicativa de al menos 3 caracteres para cerrar la caja con diferencias.',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      if (!pinSupervisor) {
        throw new HttpException(
          {
            codigo: 'PIN_REQUERIDO',
            mensaje:
              'El cierre no cuadra o se alcanzaron los intentos máximos: se requiere el PIN de supervisor.',
          },
          HttpStatus.FORBIDDEN,
        );
      }

      const supervisor = await this.verificarPinSupervisor(
        pinSupervisor,
        usuario.partyId,
        ip,
        caja.id,
      );
      supervisorPartyId = supervisor.party_id;
    }

    const mediosData = [
      {
        medio: 'EFECTIVO',
        sistema: montos.esperadoEfectivo,
        visto: vistoEfectivo,
        diferencia: difEfectivo,
      },
      {
        medio: 'YAPE',
        sistema: montos.sistemaYape,
        visto: vistoYape,
        diferencia: difYape,
      },
      {
        medio: 'PLIN',
        sistema: montos.sistemaPlin,
        visto: vistoPlin,
        diferencia: difPlin,
      },
      {
        medio: 'TRANSFERENCIA',
        sistema: montos.sistemaTransferencia,
        visto: vistoTransferencia,
        diferencia: difTransferencia,
      },
      {
        medio: 'TARJETA',
        sistema: montos.sistemaTarjeta,
        visto: vistoTarjeta,
        diferencia: difTarjeta,
      },
    ];

    // Transacción de cierre
    await this.prisma.$transaction(async (tx) => {
      // 1. Crear cierre_caja
      await tx.cierreCaja.create({
        data: {
          caja_id: caja.id,
          conteo: conteo as any,
          resultado,
          aprobado_por: supervisorPartyId,
          nota: dto.nota?.trim() ?? null,
        },
      });

      // 2. Crear cierre_medio por cada medio (diferencia es columna generada en BD)
      for (const m of mediosData) {
        await tx.cierreMedio.create({
          data: {
            caja_id: caja.id,
            medio: m.medio,
            sistema: m.sistema,
            visto: m.visto,
          },
        });
      }

      // 3. Marcar caja CERRADA
      await tx.caja.update({
        where: { id: caja.id },
        data: {
          estado: 'CERRADA',
          cerrada_por: usuario.partyId,
          cerrada_en: new Date(),
        },
      });
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cierre',
      accion: 'CERRAR_CAJA',
      resultado: 'OK',
      entidad: 'cierre_caja',
      entidadId: caja.id,
      despues: {
        resultado,
        aprobado_por: supervisorPartyId ? String(supervisorPartyId) : null,
        nota: dto.nota?.trim() ?? null,
      },
      conPinAdmin: supervisorPartyId !== null,
      partyId: usuario.partyId,
      ip,
    });

    try {
      this.eventosGateway?.emitirAdmin?.('caja:cerrada', {
        cajaId: Number(caja.id),
        resultado,
      });
    } catch {
      // Ignorar fallo de socket
    }

    return {
      cajaId: Number(caja.id),
      fecha: caja.fecha,
      resultado,
      aprobadoPor: supervisorPartyId ? Number(supervisorPartyId) : null,
      nota: dto.nota?.trim() ?? null,
      medios: mediosData,
    };
  }

  /**
   * Consulta los montos esperados por el sistema en vivo antes de cerrar.
   * Solo el rol ADMIN puede acceder a este endpoint (cierre ciego para cajeros).
   */
  async obtenerEsperado(usuario: UsuarioAutenticado) {
    if (usuario.rol !== 'ADMIN') {
      throw new HttpException(
        {
          codigo: 'SOLO_ADMIN',
          mensaje: 'Solo el administrador puede ver los montos del sistema antes de cerrar.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    const caja = await this.obtenerCajaAbierta();
    const montos = await this.calcularMontosSistema(caja.id);

    return {
      cajaId: Number(caja.id),
      fecha: caja.fecha,
      apertura: Number(caja.apertura),
      efectivoEsperado: montos.esperadoEfectivo,
      medios: {
        efectivo: montos.esperadoEfectivo,
        yape: montos.sistemaYape,
        plin: montos.sistemaPlin,
        transferencia: montos.sistemaTransferencia,
        tarjeta: montos.sistemaTarjeta,
      },
      desglose: {
        ventasEfectivo: montos.ventasEfectivo,
        ingresos: montos.ingresos,
        egresos: montos.egresos,
      },
    };
  }

  /**
   * Historial de cierres de caja con paginación y filtros de fecha.
   */
  async historial(query: HistorialCierresDto) {
    const pagina = Number(query.pagina ?? 1);
    const limite = Number(query.limite ?? 20);
    const skip = (pagina - 1) * limite;

    const where: any = {
      estado: 'CERRADA',
      cierre: { isNot: null },
    };

    if (query.desde || query.hasta) {
      where.fecha = {};
      if (query.desde) {
        where.fecha.gte = new Date(query.desde);
      }
      if (query.hasta) {
        where.fecha.lte = new Date(query.hasta);
      }
    }

    const [total, cajas] = await Promise.all([
      this.prisma.caja.count({ where }),
      this.prisma.caja.findMany({
        where,
        skip,
        take: limite,
        orderBy: { fecha: 'desc' },
        include: {
          cierre: {
            include: {
              medios: true,
            },
          },
        },
      }),
    ]);

    const items = cajas.map((c) => ({
      cajaId: Number(c.id),
      fecha: c.fecha,
      apertura: Number(c.apertura),
      cerradaPor: c.cerrada_por ? Number(c.cerrada_por) : null,
      cerradaEn: c.cerrada_en,
      cierre: c.cierre
        ? {
            resultado: c.cierre.resultado,
            aprobadoPor: c.cierre.aprobado_por ? Number(c.cierre.aprobado_por) : null,
            nota: c.cierre.nota,
            medios: c.cierre.medios.map((m) => ({
              medio: m.medio,
              sistema: Number(m.sistema),
              visto: Number(m.visto),
              diferencia: m.diferencia !== null ? Number(m.diferencia) : null,
            })),
          }
        : null,
    }));

    return {
      cierres: items,
      total,
      pagina,
      limite,
      totalPaginas: Math.ceil(total / limite),
    };
  }

  /**
   * Consulta el detalle de un cierre por ID (mostrando diferencias y medios).
   */
  async obtenerCierrePorId(id: bigint | number | string) {
    let cajaId: bigint;
    try {
      cajaId = BigInt(id);
    } catch {
      throw new HttpException(
        {
          codigo: 'ID_INVALIDO',
          mensaje: 'El ID proporcionado no es válido.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    const cierre = await this.prisma.cierreCaja.findUnique({
      where: { caja_id: cajaId },
      include: {
        caja: true,
        medios: true,
      },
    });

    if (!cierre) {
      throw new HttpException(
        {
          codigo: 'CIERRE_NO_ENCONTRADO',
          mensaje: 'Cierre de caja no encontrado.',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    return {
      cajaId: Number(cierre.caja_id),
      fecha: cierre.caja.fecha,
      apertura: Number(cierre.caja.apertura),
      resultado: cierre.resultado,
      aprobadoPor: cierre.aprobado_por ? Number(cierre.aprobado_por) : null,
      nota: cierre.nota,
      cerradaPor: cierre.caja.cerrada_por ? Number(cierre.caja.cerrada_por) : null,
      cerradaEn: cierre.caja.cerrada_en,
      conteo: cierre.conteo,
      medios: cierre.medios.map((m) => ({
        medio: m.medio,
        sistema: Number(m.sistema),
        visto: Number(m.visto),
        diferencia: m.diferencia !== null ? Number(m.diferencia) : null,
      })),
    };
  }

  /**
   * Lista los repartidores con pedidos DELIVERY ENTREGADO del día cobrados en efectivo contra entrega
   * y el efectivo pendiente que debe entregar cada uno (FT-CIE-01).
   */
  async listarRepartidoresPorLiquidar() {
    const caja = await this.obtenerCajaAbierta();

    // 1. Pedidos DELIVERY ENTREGADOS con repartidor asignado
    const pedidos = await this.prisma.pedido.findMany({
      where: {
        modalidad: 'DELIVERY',
        estado: 'ENTREGADO',
        repartidor_party_id: { not: null },
      },
      include: {
        repartidor: {
          include: {
            persona: true,
          },
        },
        cobro: {
          include: {
            pagos: true,
          },
        },
      },
    });

    // 2. Filtrar solo los cobrados en efectivo contra entrega (no anulados)
    const porRepartidorMap = new Map<
      string,
      {
        repartidorPartyId: string;
        nombre: string;
        pedidos: Array<{ id: number; codigo: string; total: number; entregadoEn: Date | null }>;
        totalCobradoEfectivo: number;
      }
    >();

    for (const p of pedidos) {
      const repId = String(p.repartidor_party_id);
      let efectivoPedido = 0;

      if (p.cobro && !p.cobro.anulado_en) {
        for (const pago of p.cobro.pagos) {
          if ((pago.medio || '').toUpperCase() === 'EFECTIVO') {
            efectivoPedido += Number(pago.monto);
          }
        }
      } else if (p.pago_metodo === 'EFECTIVO') {
        efectivoPedido = Number(p.total);
      }

      if (efectivoPedido > 0) {
        if (!porRepartidorMap.has(repId)) {
          const nombres = p.repartidor?.persona?.nombres ?? '';
          const apellidos = p.repartidor?.persona?.apellidos ?? '';
          const nombreCompleto = `${nombres} ${apellidos}`.trim() || `Repartidor #${repId}`;

          porRepartidorMap.set(repId, {
            repartidorPartyId: repId,
            nombre: nombreCompleto,
            pedidos: [],
            totalCobradoEfectivo: 0,
          });
        }

        const repData = porRepartidorMap.get(repId)!;
        repData.pedidos.push({
          id: Number(p.id),
          codigo: p.codigo,
          total: efectivoPedido,
          entregadoEn: p.entregado_en,
        });
        repData.totalCobradoEfectivo += efectivoPedido;
      }
    }

    // 3. Liquidaciones ya registradas para esta caja
    const liquidacionesCaja = await this.prisma.liquidacion.findMany({
      where: { caja_id: caja.id },
    });

    const liquidadoMap = new Map<string, number>();
    for (const liq of liquidacionesCaja) {
      const repId = String(liq.repartidor_party_id);
      liquidadoMap.set(
        repId,
        (liquidadoMap.get(repId) ?? 0) + Number(liq.entregado),
      );
    }

    const resultado = Array.from(porRepartidorMap.values()).map((r) => {
      const totalCobrado = Math.round(r.totalCobradoEfectivo * 100) / 100;
      const totalLiquidado = Math.round((liquidadoMap.get(r.repartidorPartyId) ?? 0) * 100) / 100;
      const pendiente = Math.max(0, Math.round((totalCobrado - totalLiquidado) * 100) / 100);

      return {
        repartidorPartyId: Number(r.repartidorPartyId),
        nombre: r.nombre,
        pedidos: r.pedidos,
        totalCobrado,
        totalLiquidado,
        pendiente,
      };
    });

    return resultado;
  }

  /**
   * Registra la liquidación de efectivo de un repartidor (FT-CIE-01).
   */
  async liquidarRepartidor(
    dto: LiquidarRepartidorDto,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const caja = await this.obtenerCajaAbierta();
    let repartidorPartyId: bigint;
    try {
      repartidorPartyId = BigInt(dto.repartidorPartyId);
    } catch {
      throw new HttpException(
        {
          codigo: 'ID_INVALIDO',
          mensaje: 'repartidorPartyId proporcionado no es válido.',
        },
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verificar que el repartidor exista
    const repartidor = await this.prisma.party.findUnique({
      where: { id: repartidorPartyId },
      include: { persona: true },
    });

    if (!repartidor) {
      throw new HttpException(
        {
          codigo: 'REPARTIDOR_NO_ENCONTRADO',
          mensaje: 'El repartidor especificado no existe.',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    // Calcular el efectivo esperado pendiente de liquidar
    const repartidores = await this.listarRepartidoresPorLiquidar();
    const repInfo = repartidores.find(
      (r) => String(r.repartidorPartyId) === String(dto.repartidorPartyId),
    );

    const esperado = repInfo ? repInfo.pendiente : 0;
    const entregado = Math.round(Number(dto.entregado) * 100) / 100;
    const diferencia = Math.round((entregado - esperado) * 100) / 100;

    const liquidacion = await this.prisma.liquidacion.create({
      data: {
        caja_id: caja.id,
        repartidor_party_id: repartidorPartyId,
        esperado,
        entregado,
      },
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'cierre',
      accion: 'LIQUIDAR_REPARTIDOR',
      resultado: 'OK',
      entidad: 'liquidacion',
      entidadId: liquidacion.id,
      despues: {
        cajaId: String(caja.id),
        repartidorPartyId: String(repartidorPartyId),
        esperado,
        entregado,
        diferencia,
      },
      partyId: usuario.partyId,
      ip,
    });

    return {
      id: Number(liquidacion.id),
      cajaId: Number(caja.id),
      repartidorPartyId: Number(repartidorPartyId),
      esperado,
      entregado,
      diferencia,
    };
  }
}
