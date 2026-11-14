import { BadRequestException, ConflictException, Injectable, Logger, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { tieneRol } from '../acceso/roles-usuario';
import { CobrosService } from '../caja/cobros.service';
import { aCentimos, enPesos, registrarEgresoDevolucionCajaHoy } from '../caja/caja.calculo';
import { obtenerFechaHoraLima } from '../local/local.util';
import { AvisosPedidoService } from '../chatbot/servicios/avisos-pedido.service';
import { ESTADO_REPROG, NUMERO_PREGUNTA_REPROG } from '../chatbot/servicios/reprogramacion.service';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';

const PAGOS_CON_DINERO = ['PAGADO', 'COORDINADO'];
const MEDIOS = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];

/**
 * Anular un pedido YA PAGADO (cobro vigente o pago coordinado) obliga a decidir qué pasa con el dinero:
 *  - DEVOLVER: se registra la devolución (medio y monto), se anula el cobro por su camino de siempre y, si sale
 *    efectivo que el cobro no cubría, se crea el egreso de la caja de hoy. Nada queda en el aire para el cierre.
 *  - REPROGRAMAR: el pedido NO se anula; vuelve a «Para elegir» en reparto con el pago intacto.
 */
@Injectable()
export class AnulacionPagadoService {
  private readonly logger = new Logger(AnulacionPagadoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly cobros?: CobrosService,
    @Optional() private readonly avisos?: AvisosPedidoService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  /** ¿Hay dinero recibido? Cobro vigente en dinero (el crédito del personal no cuenta) o pago PAGADO/COORDINADO. */
  async estaPagado(pedido: { id: bigint; pago_estado?: string | null }): Promise<boolean> {
    const cobros = await this.prisma.cobro.findMany({ where: { pedido_id: pedido.id, anulado_en: null }, select: { credito_personal: true } });
    if (cobros.length > 0) return cobros.some((c) => !c.credito_personal);
    return PAGOS_CON_DINERO.includes(String(pedido.pago_estado));
  }

  /**
   * Resuelve el dinero de un pedido pagado antes de anular. Devuelve 'REPROGRAMADO' (el llamador no anula) o 'DEVUELTO'
   * (el llamador sigue y anula). Sin destino elegido: 400.
   */
  async resolver(pedido: any, dto: CambiarEstadoDto, motivo: string, usuario: UsuarioAutenticado, ip?: string): Promise<'REPROGRAMADO' | 'DEVUELTO'> {
    if (!dto.destinoDinero) {
      throw new BadRequestException({
        codigo: 'DESTINO_DINERO_REQUERIDO',
        mensaje: 'El pedido ya está pagado: elige qué pasa con el dinero (devolverlo al cliente o reprogramar el pedido)',
      });
    }
    if (dto.destinoDinero === 'REPROGRAMAR') {
      await this.reprogramar(pedido, motivo, usuario, ip);
      return 'REPROGRAMADO';
    }
    await this.devolver(pedido, dto, motivo, usuario, ip);
    return 'DEVUELTO';
  }

  private async devolver(pedido: any, dto: CambiarEstadoDto, motivo: string, usuario: UsuarioAutenticado, ip?: string) {
    const medio = dto.devolucionMedio ?? '';
    if (!MEDIOS.includes(medio)) {
      throw new BadRequestException({ codigo: 'MEDIO_DEVOLUCION_REQUERIDO', mensaje: 'Elige el medio con el que se devuelve el dinero' });
    }
    const pagadoC = aCentimos(pedido.total);
    const devueltoC = aCentimos(dto.devolucionMonto ?? 0);
    if (devueltoC <= 0 || devueltoC > pagadoC) {
      throw new BadRequestException({
        codigo: 'MONTO_DEVOLUCION_INVALIDO',
        mensaje: `El monto devuelto debe ser mayor a cero y no pasar de lo pagado (S/ ${enPesos(pagadoC).toFixed(2)})`,
      });
    }
    const codigoOp = (dto.devolucionCodigo ?? '').trim();
    if (medio !== 'EFECTIVO' && !codigoOp) {
      throw new BadRequestException({ codigo: 'CODIGO_OPERACION_REQUERIDO', mensaje: 'Escribe el código de operación de la devolución' });
    }

    const cobro = await this.prisma.cobro.findFirst({
      where: { pedido_id: pedido.id, anulado_en: null },
      include: { caja: { select: { estado: true } }, pagos: true },
    });
    const cajaCerrada = !!cobro && cobro.caja.estado !== 'ABIERTA';
    if (cajaCerrada && !tieneRol(usuario, 'ADMIN')) {
      throw new ConflictException({
        codigo: 'PEDIDO_COBRADO_CAJA_CERRADA',
        mensaje: 'El cobro de este pedido pertenece a una caja ya cerrada: pide al administrador que lo anule.',
      });
    }
    // Efectivo que sale de la caja de hoy y que el cobro anulado no cubre (el efectivo del propio cobro ya sale del arqueo al anularlo)
    const efectivoCobroC = (cobro?.pagos ?? [])
      .filter((p) => (p.medio || '').trim().toUpperCase() === 'EFECTIVO')
      .reduce((t, p) => t + aCentimos(p.monto) + aCentimos(p.propina), 0);
    const egresoC = medio === 'EFECTIVO' ? Math.max(0, devueltoC - efectivoCobroC) : 0;
    if (egresoC > 0 || cajaCerrada) await this.exigirCajaHoyAbierta();

    // 1) Devolución y egreso en una transacción; 2) anular el cobro; si 2 falla se deshace 1 (no queda devolución sin cobro anulado)
    let fila: { id: bigint; movimiento_caja_id: bigint | null };
    try {
      fila = await this.prisma.$transaction(async (tx) => {
        const egreso = egresoC > 0 ? await registrarEgresoDevolucionCajaHoy(tx, enPesos(egresoC), `Devolución ${pedido.codigo} (anulación)`) : null;
        return tx.devolucionPedido.create({
          data: {
            pedido_id: pedido.id,
            monto_pagado: enPesos(pagadoC),
            monto_envio: Number(pedido.envio ?? 0),
            monto_sugerido: enPesos(devueltoC),
            monto_devuelto: enPesos(devueltoC),
            medio,
            codigo_operacion: medio === 'EFECTIVO' ? null : codigoOp,
            motivo,
            por_party_id: BigInt(usuario.partyId),
            autorizado_por_party_id: BigInt(usuario.partyId),
            movimiento_caja_id: egreso?.id ?? null,
          },
          select: { id: true, movimiento_caja_id: true },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ codigo: 'DEVOLUCION_YA_REGISTRADA', mensaje: 'Ya hay una devolución registrada para este pedido' });
      }
      throw e;
    }

    let bajaEstado: string | null = null;
    if (cobro && this.cobros) {
      try {
        const dtoCobro = { motivo: `Pedido anulado: ${motivo}` };
        const r: any = cajaCerrada
          ? await this.cobros.anularCobroCajaCerrada(cobro.id, dtoCobro, usuario, ip)
          : await this.cobros.anularCobro(cobro.id, dtoCobro, usuario, ip);
        bajaEstado = r?.comprobante_baja?.estado ?? null;
      } catch (e) {
        await this.prisma.devolucionPedido.delete({ where: { id: fila.id } }).catch((x) => this.logger.error(`No se deshizo la devolución ${fila.id}: ${String(x)}`));
        if (fila.movimiento_caja_id) {
          await this.prisma.movimientoCaja.delete({ where: { id: fila.movimiento_caja_id } }).catch((x) => this.logger.error(`No se deshizo el egreso ${fila.movimiento_caja_id}: ${String(x)}`));
        }
        throw e;
      }
      if (bajaEstado) await this.prisma.devolucionPedido.update({ where: { id: fila.id }, data: { comprobante_baja_estado: bajaEstado } });
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'DEVOLUCION_AL_ANULAR',
      resultado: 'OK',
      entidad: 'devolucion_pedido',
      entidadId: fila.id,
      motivo,
      despues: {
        pedido: pedido.codigo,
        medio,
        montoDevuelto: enPesos(devueltoC),
        egresoCaja: enPesos(egresoC),
        cobroAnulado: cobro ? String(cobro.id) : null,
        comprobanteBaja: bajaEstado,
      },
      partyId: BigInt(usuario.partyId),
      ip,
    });
  }

  private async exigirCajaHoyAbierta() {
    const { fechaIso } = obtenerFechaHoraLima();
    const caja = await this.prisma.caja.findUnique({ where: { fecha: new Date(`${fechaIso}T00:00:00.000Z`) } });
    if (caja?.estado !== 'ABIERTA') {
      throw new ConflictException({ codigo: 'CAJA_CERRADA', mensaje: 'Abre la caja de hoy para registrar la devolución' });
    }
  }

  /** El pedido NO se anula: un delivery devuelto al local (movilidad retirada) vuelve a «Para elegir» con el pago intacto. */
  private async reprogramar(pedido: any, motivo: string, usuario: UsuarioAutenticado, ip?: string) {
    if (pedido.modalidad !== 'DELIVERY' || pedido.estado !== 'LISTO' || pedido.motivo_falla == null || pedido.repartidor_party_id != null) {
      throw new ConflictException({
        codigo: 'SIN_REPROGRAMACION',
        mensaje: 'Solo se reprograma un delivery que volvió al local tras una entrega fallida. Si no, elige devolver el dinero.',
      });
    }
    const ahora = new Date();
    const partyId = BigInt(usuario.partyId);
    await this.prisma.$transaction(async (tx) => {
      const ultimo = await tx.incidenteEntrega.findFirst({ where: { pedido_id: pedido.id }, orderBy: { en: 'desc' } });
      if (ultimo) await tx.incidenteEntrega.update({ where: { id: ultimo.id }, data: { cierre: 'REPROGRAMADO', cerrado_por: partyId } });
      await tx.pedido.update({ where: { id: pedido.id }, data: { motivo_falla: null } });
      await tx.mensajeReparto.updateMany({
        where: { pedido_id: pedido.id, numero: NUMERO_PREGUNTA_REPROG },
        data: { estado: ESTADO_REPROG.REPROGRAMADO },
      });
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pedido.id,
          estado_anterior: 'LISTO',
          estado_nuevo: 'LISTO',
          motivo: `Reprogramado en lugar de anular (pagado): ${motivo}`,
          por_party_id: partyId,
          en: ahora,
        },
      });
      await this.avisos?.avisar(pedido.id, 'REENVIADO', {}, tx);
    });
    this.avisos?.despertar();
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'REPROGRAMAR_EN_VEZ_DE_ANULAR',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      antes: { estado: 'LISTO', motivo_falla: pedido.motivo_falla },
      despues: { estado: 'LISTO', motivo_falla: null, pago_estado: pedido.pago_estado },
      motivo,
      partyId,
      ip,
    });
    this.eventos?.emitirAdmin('pedido:estado', { id: Number(pedido.id), codigo: pedido.codigo, estado: 'LISTO', motivo_falla: null });
  }
}
