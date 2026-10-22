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
import { AbrirCajaDto } from './dto/abrir-caja.dto';
import { CrearMovimientoDto } from './dto/movimiento.dto';
import { AnularMovimientoDto } from './dto/anular-movimiento.dto';

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
    const abiertaAnterior = await this.prisma.caja.findFirst({ where: { estado: 'ABIERTA' } });
    if (abiertaAnterior) {
      const dia = abiertaAnterior.fecha.toISOString().slice(0, 10).split('-').reverse().join('/');
      throw new HttpException(
        {
          codigo: 'CAJA_ANTERIOR_SIN_CERRAR',
          mensaje: `La caja del ${dia} sigue abierta: ciérrala en «Caja y cierres» antes de abrir la de hoy`,
        },
        HttpStatus.CONFLICT,
      );
    }

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

    const caja = await this.prisma.caja.create({
      data: {
        fecha: fechaDate,
        apertura: new Prisma.Decimal(aperturaMonto),
        estado: 'ABIERTA',
        abierta_por: BigInt(usuario.partyId),
      },
    });

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
   * Obtiene la caja del día, totales por medio de pago hoy y el efectivo esperado.
   * Efectivo esperado = apertura + cobros en efectivo - vueltos + ingresos - egresos.
   */
  async obtenerCajaActual(usuario?: any) {
    const { fechaDate, fechaIso } = this.obtenerFechaHoyLima();

    const caja = await this.prisma.caja.findUnique({
      where: { fecha: fechaDate },
      include: {
        cobros: {
          include: { pagos: true },
        },
        movimientos: true,
      },
    });

    if (!caja) {
      return {
        caja: null,
        abierta: false,
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
        },
        efectivoEsperado: 0,
      };
    }

    const totalesPorMedio: Record<string, number> = {
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
        totalesPorMedio[medio] = Number(
          ((totalesPorMedio[medio] || 0) + Number(pago.monto)).toFixed(2),
        );

        if (medio === 'EFECTIVO') {
          cobrosEfectivo += Number(pago.monto);
          if (pago.vuelto) {
            vueltosEfectivo += Number(pago.vuelto);
          }
        }
      }
    }

    let ingresos = 0;
    let egresos = 0;

    for (const mov of caja.movimientos) {
      if (mov.anulado_en) continue;
      if (mov.tipo === 'INGRESO') {
        ingresos += Number(mov.monto);
      } else if (mov.tipo === 'EGRESO') {
        egresos += Number(mov.monto);
      }
    }

    const apertura = Number(caja.apertura);
    const efectivoEsperado = Number(
      (apertura + cobrosEfectivo + ingresos - egresos).toFixed(2),
    );

    return {
      caja: {
        id: caja.id.toString(),
        fecha: fechaIso,
        apertura,
        estado: caja.estado,
        abierta_por: caja.abierta_por.toString(),
        cerrada_por: caja.cerrada_por ? caja.cerrada_por.toString() : null,
        cerrada_en: caja.cerrada_en,
      },
      abierta: caja.estado === 'ABIERTA',
      totalesPorMedio,
      resumen: {
        apertura,
        cobrosEfectivo: Number(cobrosEfectivo.toFixed(2)),
        vueltosEfectivo: Number(vueltosEfectivo.toFixed(2)),
        ingresos: Number(ingresos.toFixed(2)),
        egresos: Number(egresos.toFixed(2)),
      },
      efectivoEsperado,
    };
  }

  /**
   * Registra un ingreso o egreso en la caja chica.
   */
  async crearMovimiento(dto: CrearMovimientoDto, usuario: any, ip?: string) {
    const { fechaDate } = this.obtenerFechaHoyLima();

    const caja = await this.prisma.caja.findUnique({
      where: { fecha: fechaDate },
    });

    if (!caja || caja.estado !== 'ABIERTA') {
      throw new HttpException(
        {
          codigo: 'CAJA_CERRADA',
          mensaje: 'No hay una caja abierta para registrar movimientos',
        },
        HttpStatus.CONFLICT,
      );
    }

    const mov = await this.prisma.movimientoCaja.create({
      data: {
        caja_id: caja.id,
        tipo: dto.tipo,
        monto: new Prisma.Decimal(dto.monto),
        motivo: dto.motivo.trim(),
      },
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

    return movimientos.map((m) => ({
      id: m.id.toString(),
      caja_id: m.caja_id.toString(),
      tipo: m.tipo,
      monto: Number(m.monto),
      motivo: m.motivo,
      anulado_en: m.anulado_en,
      motivo_anulacion: m.motivo_anulacion,
    }));
  }

  /**
   * Anula un movimiento de caja chico con motivo (no se borra físicamente, RN-CAP-014).
   */
  async anularMovimiento(
    id: bigint | string | number,
    dto: AnularMovimientoDto,
    usuario: any,
    ip?: string,
  ) {
    const movimientoId = this.parsearId(id);

    const mov = await this.prisma.movimientoCaja.findUnique({
      where: { id: movimientoId },
    });

    if (!mov) {
      throw new HttpException(
        {
          codigo: 'MOVIMIENTO_NO_ENCONTRADO',
          mensaje: 'El movimiento de caja no existe',
        },
        HttpStatus.NOT_FOUND,
      );
    }

    if (mov.anulado_en) {
      throw new HttpException(
        {
          codigo: 'MOVIMIENTO_YA_ANULADO',
          mensaje: 'El movimiento de caja ya fue anulado',
        },
        HttpStatus.CONFLICT,
      );
    }

    const ahora = new Date();

    const actualizado = await this.prisma.movimientoCaja.update({
      where: { id: movimientoId },
      data: {
        anulado_en: ahora,
        motivo_anulacion: dto.motivo.trim(),
      },
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
