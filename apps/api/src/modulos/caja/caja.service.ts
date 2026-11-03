import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { obtenerFechaHoraLima } from '../local/local.util';
import {
  aCentimos,
  bloquearCaja,
  calcularMontosCaja,
  enPesos,
  errorCajaAnteriorAbierta,
  esCentimosValidos,
  mapearCobrosCaja,
  mapearMovimientosCaja,
} from './caja.calculo';
import { AbrirCajaDto } from './dto/abrir-caja.dto';
import { CrearMovimientoDto } from './dto/movimiento.dto';
import { AnularMovimientoDto } from './dto/anular-movimiento.dto';

/** Estado de la caja del día. Los totales y el efectivo esperado solo los recibe el administrador. */
export interface EstadoCajaDia {
  caja: {
    id: string;
    fecha: string;
    apertura: number;
    estado: string;
    abierta_por: string;
    cerrada_por: string | null;
    cerrada_en: Date | null;
  } | null;
  abierta: boolean;
  // Caja de un día anterior que sigue abierta (solo la fecha, sin montos): la ven todos los roles
  cajaAnteriorAbierta?: { fecha: string } | null;
  cobrados?: Array<{
    pedidoId: string;
    codigo: string;
    cliente: string | null;
    total: number;
    medios: string[];
    en: Date;
  }>;
  totalesPorMedio?: Record<string, number>;
  resumen?: {
    apertura: number;
    cobrosEfectivo: number;
    vueltosEfectivo: number;
    ingresos: number;
    egresos: number;
    liquidadoRepartidores: number;
  };
  efectivoEsperado?: number;
}

@Injectable()
export class CajaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
  ) {}

  private parsearId(id: bigint | string | number): bigint {
    try {
      return BigInt(id);
    } catch {
      throw new BadRequestException({
        codigo: 'ID_INVALIDO',
        mensaje: 'El identificador no es válido',
      });
    }
  }

  /**
   * Retorna la fecha normalizada del día de hoy en Lima a medianoche UTC (para @db.Date).
   */
  obtenerFechaHoyLima(): { fechaDate: Date; fechaIso: string } {
    const { fechaIso } = obtenerFechaHoraLima();
    const fechaDate = new Date(`${fechaIso}T00:00:00.000Z`);
    return { fechaDate, fechaIso };
  }

  /**
   * Abre la caja del día con monto inicial en soles.
   * Solo permite una caja por día (409 CAJA_YA_ABIERTA).
   */
  async abrirCaja(dto: AbrirCajaDto, usuario: any, ip?: string) {
    const { fechaDate, fechaIso } = this.obtenerFechaHoyLima();

    const aperturaMonto =
      dto?.apertura !== undefined && dto?.apertura !== null
        ? Number(dto.apertura)
        : 0;

    if (isNaN(aperturaMonto) || aperturaMonto < 0) {
      throw new BadRequestException({
        codigo: 'MONTO_INVALIDO',
        mensaje: 'El monto de apertura no puede ser negativo',
      });
    }

    if (!esCentimosValidos(aperturaMonto)) {
      throw new BadRequestException({
        codigo: 'MONTO_INVALIDO',
        mensaje: 'El monto de apertura admite como máximo dos decimales',
      });
    }

    // Validar si ya existe una caja registrada para hoy (abierta o cerrada)
    const existente = await this.prisma.caja.findUnique({
      where: { fecha: fechaDate },
    });

    if (existente) {
      throw new HttpException(
        {
          codigo: 'CAJA_YA_ABIERTA',
          mensaje: 'Ya existe una caja registrada para el día de hoy',
        },
        HttpStatus.CONFLICT,
      );
    }

    // una caja de un día anterior sin cerrar bloquea la de hoy: se pide cerrarla primero (arqueo ciego)
    const errorAnterior = await errorCajaAnteriorAbierta(this.prisma);
    if (errorAnterior) {
      throw errorAnterior;
    }

    let caja;
    try {
      caja = await this.prisma.caja.create({
        data: {
          fecha: fechaDate,
          apertura: new Prisma.Decimal(aperturaMonto),
          estado: 'ABIERTA',
          abierta_por: BigInt(usuario.partyId),
        },
      });
    } catch (e: any) {
      // dos aperturas a la vez: la segunda choca con la fecha única o con la caja abierta única
      if (e?.code === 'P2002') {
        throw new HttpException(
          {
            codigo: 'CAJA_YA_ABIERTA',
            mensaje: 'Ya existe una caja registrada para el día de hoy',
          },
          HttpStatus.CONFLICT,
        );
      }
      throw e;
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'caja',
      accion: 'ABRIR_CAJA',
      resultado: 'OK',
      entidad: 'caja',
      entidadId: caja.id,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      despues: {
        id: caja.id.toString(),
        fecha: fechaIso,
        apertura: Number(caja.apertura),
        estado: caja.estado,
      },
      ip,
    });

    return {
      id: caja.id.toString(),
      fecha: fechaIso,
      apertura: Number(caja.apertura),
      estado: caja.estado,
      abierta_por: caja.abierta_por.toString(),
      cerrada_por: null,
      cerrada_en: null,
    };
  }

  /**
   * Estado de la caja del día. Solo el administrador ve los totales y el efectivo esperado
   * (cierre ciego para el cajero, DT-61): el resto recibe únicamente si la caja está abierta.
   */
  async obtenerCajaActual(usuario?: any): Promise<EstadoCajaDia> {
    const { fechaDate, fechaIso } = this.obtenerFechaHoyLima();

    const caja = await this.prisma.caja.findUnique({
      where: { fecha: fechaDate },
      include: {
        cobros: {
          include: { pagos: true, pedido: { select: { codigo: true, cliente_nombre: true } } },
        },
        movimientos: true,
      },
    });

    if (!caja) {
      const anterior = await this.prisma.caja.findFirst({
        where: { estado: 'ABIERTA' },
        select: { fecha: true },
      });
      return {
        caja: null,
        abierta: false,
        cajaAnteriorAbierta: anterior
          ? { fecha: anterior.fecha.toISOString().slice(0, 10) }
          : null,
        ...(usuario?.rol === 'ADMIN' ? this.resumenVacio() : {}),
      };
    }

    const estado = {
      caja: {
        id: caja.id.toString(),
        fecha: fechaIso,
        apertura: enPesos(aCentimos(caja.apertura)),
        estado: caja.estado,
        abierta_por: caja.abierta_por.toString(),
        cerrada_por: caja.cerrada_por ? caja.cerrada_por.toString() : null,
        cerrada_en: caja.cerrada_en,
      },
      abierta: caja.estado === 'ABIERTA',
      // Pedidos cobrados en esta caja (sin montos esperados): los ve cualquier rol que abre la caja
      cobrados: mapearCobrosCaja(caja.cobros),
    };

    if (usuario?.rol !== 'ADMIN') {
      return estado;
    }

    const totalesEnCentimos: Record<string, number> = {
      EFECTIVO: 0,
      YAPE: 0,
      PLIN: 0,
      TARJETA: 0,
      TRANSFERENCIA: 0,
    };
    let cobrosEfectivo = 0;
    let vueltosEfectivo = 0;

    for (const cobro of caja.cobros) {
      if (cobro.anulado_en) continue;
      for (const pago of cobro.pagos) {
        const medio = (pago.medio || '').toUpperCase();
        totalesEnCentimos[medio] = (totalesEnCentimos[medio] || 0) + aCentimos(pago.monto);
        if (medio === 'EFECTIVO') {
          cobrosEfectivo += aCentimos(pago.monto);
          if (pago.vuelto) {
            vueltosEfectivo += aCentimos(pago.vuelto);
          }
        }
      }
    }

    let ingresos = 0;
    let egresos = 0;
    for (const mov of caja.movimientos) {
      if (mov.anulado_en) continue;
      if (mov.tipo === 'INGRESO') ingresos += aCentimos(mov.monto);
      else if (mov.tipo === 'EGRESO') egresos += aCentimos(mov.monto);
    }

    const montos = await calcularMontosCaja(this.prisma, caja);

    return {
      ...estado,
      totalesPorMedio: Object.fromEntries(
        Object.entries(totalesEnCentimos).map(([medio, c]) => [medio, enPesos(c)]),
      ),
      resumen: {
        apertura: enPesos(aCentimos(caja.apertura)),
        cobrosEfectivo: enPesos(cobrosEfectivo),
        vueltosEfectivo: enPesos(vueltosEfectivo),
        ingresos: enPesos(ingresos),
        egresos: enPesos(egresos),
        liquidadoRepartidores: montos.liquidadoEfectivo,
      },
      efectivoEsperado: montos.esperadoEfectivo,
    };
  }

  private resumenVacio(): Omit<EstadoCajaDia, 'caja' | 'abierta'> {
    return {
      totalesPorMedio: {
        EFECTIVO: 0,
        YAPE: 0,
        PLIN: 0,
        TARJETA: 0,
        TRANSFERENCIA: 0,
      },
      resumen: {
        apertura: 0,
        cobrosEfectivo: 0,
        vueltosEfectivo: 0,
        ingresos: 0,
        egresos: 0,
        liquidadoRepartidores: 0,
      },
      efectivoEsperado: 0,
    };
  }

  /**
   * Registra un ingreso o egreso en la caja chica.
   */
  async crearMovimiento(dto: CrearMovimientoDto, usuario: any, ip?: string) {
    if (!esCentimosValidos(dto.monto)) {
      throw new BadRequestException({
        codigo: 'MONTO_INVALIDO',
        mensaje: 'El monto admite como máximo dos decimales',
      });
    }

    const { fechaDate } = this.obtenerFechaHoyLima();

    const caja = await this.prisma.caja.findUnique({
      where: { fecha: fechaDate },
    });

    if (!caja) {
      throw await this.errorCajaNoAbierta();
    }

    const mov = await this.prisma.$transaction(async (tx) => {
      const cajaBloqueada = await bloquearCaja(tx, caja.id);
      if (!cajaBloqueada || cajaBloqueada.estado !== 'ABIERTA') {
        throw await this.errorCajaNoAbierta();
      }

      return tx.movimientoCaja.create({
        data: {
          caja_id: caja.id,
          tipo: dto.tipo,
          monto: new Prisma.Decimal(dto.monto),
          motivo: dto.motivo.trim(),
        },
      });
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'caja',
      accion: 'CREAR_MOVIMIENTO',
      resultado: 'OK',
      entidad: 'movimiento_caja',
      entidadId: mov.id,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      despues: {
        id: mov.id.toString(),
        caja_id: caja.id.toString(),
        tipo: mov.tipo,
        monto: Number(mov.monto),
        motivo: mov.motivo,
      },
      ip,
    });

    return {
      id: mov.id.toString(),
      caja_id: mov.caja_id.toString(),
      tipo: mov.tipo,
      monto: Number(mov.monto),
      motivo: mov.motivo,
      anulado_en: null,
      motivo_anulacion: null,
    };
  }

  private async errorCajaNoAbierta() {
    return (
      (await errorCajaAnteriorAbierta(this.prisma)) ??
      new HttpException(
        {
          codigo: 'CAJA_CERRADA',
          mensaje: 'No hay una caja abierta para registrar movimientos',
        },
        HttpStatus.CONFLICT,
      )
    );
  }

  /**
   * Lista los movimientos de la caja chica del día.
   */
  async listarMovimientos() {
    const { fechaDate } = this.obtenerFechaHoyLima();

    const caja = await this.prisma.caja.findUnique({
      where: { fecha: fechaDate },
    });

    if (!caja) {
      return [];
    }

    const movimientos = await this.prisma.movimientoCaja.findMany({
      where: { caja_id: caja.id },
      orderBy: { id: 'asc' },
    });

    return mapearMovimientosCaja(movimientos);
  }

  /**
   * Anula un movimiento de caja chico con motivo (no se borra físicamente, RN-CAP-014).
   * Solo con la caja abierta: un cierre no se edita (RN-CAP-080).
   */
  async anularMovimiento(
    id: bigint | string | number,
    dto: AnularMovimientoDto,
    usuario: any,
    ip?: string,
  ) {
    const movimientoId = this.parsearId(id);

    const movPrevio = await this.prisma.movimientoCaja.findUnique({
      where: { id: movimientoId },
    });

    if (!movPrevio) {
      throw new HttpException(
        {
          codigo: 'MOVIMIENTO_NO_ENCONTRADO',
          mensaje: 'El movimiento de caja no existe',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (movPrevio.anulado_en) {
      throw new HttpException(
        {
          codigo: 'MOVIMIENTO_YA_ANULADO',
          mensaje: 'El movimiento de caja ya fue anulado',
        },
        HttpStatus.CONFLICT,
      );
    }

    const ahora = new Date();

    const { mov, actualizado } = await this.prisma.$transaction(async (tx) => {
      const caja = await bloquearCaja(tx, movPrevio.caja_id);
      if (!caja || caja.estado !== 'ABIERTA') {
        throw new HttpException(
          {
            codigo: 'CAJA_CERRADA',
            mensaje: 'Solo se puede anular un movimiento de una caja abierta',
          },
          HttpStatus.CONFLICT,
        );
      }

      const actual = await tx.movimientoCaja.findUnique({ where: { id: movimientoId } });
      if (actual?.anulado_en) {
        throw new HttpException(
          {
            codigo: 'MOVIMIENTO_YA_ANULADO',
            mensaje: 'El movimiento de caja ya fue anulado',
          },
          HttpStatus.CONFLICT,
        );
      }

      const anulado = await tx.movimientoCaja.update({
        where: { id: movimientoId },
        data: {
          anulado_en: ahora,
          motivo_anulacion: dto.motivo.trim(),
        },
      });
      return { mov: actual ?? movPrevio, actualizado: anulado };
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'caja',
      accion: 'ANULAR_MOVIMIENTO',
      resultado: 'OK',
      entidad: 'movimiento_caja',
      entidadId: mov.id,
      partyId: usuario?.partyId ? BigInt(usuario.partyId) : undefined,
      motivo: dto.motivo.trim(),
      antes: {
        anulado_en: null,
        motivo_anulacion: null,
      },
      despues: {
        anulado_en: ahora.toISOString(),
        motivo_anulacion: dto.motivo.trim(),
      },
      ip,
    });

    return {
      id: actualizado.id.toString(),
      caja_id: actualizado.caja_id.toString(),
      tipo: actualizado.tipo,
      monto: Number(actualizado.monto),
      motivo: actualizado.motivo,
      anulado_en: actualizado.anulado_en,
      motivo_anulacion: actualizado.motivo_anulacion,
    };
  }
}
