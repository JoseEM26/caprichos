import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
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
import { DevolucionCulqiService, ErrorReembolso } from '../pagos-online/devolucion-culqi.service';
import { CambiarEstadoDto } from './dto/cambiar-estado.dto';

const PAGOS_CON_DINERO = ['PAGADO', 'COORDINADO'];
const MEDIOS = ['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];
const ESTADOS_CULQI_EJECUTABLES = ['PENDIENTE_APROBACION', 'PENDIENTE', 'FALLIDA'];

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
    @Optional() private readonly culqi?: DevolucionCulqiService,
  ) {}

  /** ¿Hay dinero recibido? Cobro vigente en dinero (el crédito del personal no cuenta) o pago PAGADO/COORDINADO. */
  async estaPagado(pedido: { id: bigint; pago_estado?: string | null; pago_metodo?: string | null }): Promise<boolean> {
    const cobros = await this.prisma.cobro.findMany({ where: { pedido_id: pedido.id, anulado_en: null }, select: { credito_personal: true } });
    if (cobros.length > 0) return cobros.some((c) => !c.credito_personal);
    // Pedido del personal a crédito sin saldar: nace PAGADO pero no entró dinero; no hay nada que devolver
    if (pedido.pago_metodo === 'CREDITO_PERSONAL') {
      const consumo = await this.prisma.consumoPersonal.findUnique({ where: { pedido_id: pedido.id }, select: { pagado_en: true } });
      if (consumo && !consumo.pagado_en) return false;
    }
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
    if (medio === 'CULQI') return this.devolverCulqi(pedido, dto, motivo, usuario, ip);
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
    await this.anotarPorFuera(pedido.id, medio, devueltoC, motivo, fila.movimiento_caja_id ?? undefined);

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

  /**
   * Pedido pagado por Culqi y devuelto por otro medio (efectivo, Yape...): NO se llama a Culqi; el monto queda en el intento
   * como «devuelto por fuera» (igual que en Pagos en línea › Devolver). El egreso de efectivo ya lo hizo `devolver`: aquí no se repite.
   */
  private async anotarPorFuera(pedidoId: bigint, medio: string, montoC: number, motivo: string, movimientoCajaId?: bigint) {
    if (!this.culqi) return;
    try {
      const intento = await this.culqi.intentoDelPedido(pedidoId);
      if (!intento) return;
      const monto = Math.min(montoC, intento.monto_centimos - intento.devuelto_centimos);
      if (monto <= 0 || !(await this.culqi.reservar(intento.id, intento.devuelto_centimos, monto))) return;
      await this.culqi.anotar(intento.id, {
        id: `${medio.toLowerCase()}_${intento.id}_${Date.now()}`, monto_centimos: monto, en: new Date().toISOString(), motivo, origen: 'SISTEMA', medio,
        ...(movimientoCajaId ? { movimiento_caja_id: String(movimientoCajaId) } : {}),
      });
    } catch (e) {
      this.logger.warn(`Devolución por ${medio} hecha, sin anotar en el pago en línea del pedido ${pedidoId}: ${String(e)}`);
    }
  }

  /**
   * Destino «Devolver por Culqi»: el pedido se anula con el flujo normal (cobro anulado) y deja UNA devolución CULQI.
   * ADMIN: queda PENDIENTE y se ejecuta justo después de anular (`ejecutarCulqiAlAnular`). Otro rol: PENDIENTE_APROBACION
   * y se avisa al admin, que la ejecuta desde «Cancelados por no recibir».
   */
  private async devolverCulqi(pedido: any, dto: CambiarEstadoDto, motivo: string, usuario: UsuarioAutenticado, ip?: string) {
    const intento = this.culqi ? await this.culqi.intentoDelPedido(pedido.id) : null;
    if (!intento) {
      throw new ConflictException({ codigo: 'SIN_PAGO_CULQI', mensaje: 'Este pedido no tiene un pago aprobado por Culqi: elige otro medio de devolución' });
    }
    const restanteC = intento.monto_centimos - intento.devuelto_centimos;
    const montoC = dto.devolucionMonto != null ? aCentimos(dto.devolucionMonto) : restanteC;
    if (montoC <= 0 || montoC > restanteC) {
      throw new BadRequestException({
        codigo: 'MONTO_DEVOLUCION_INVALIDO',
        mensaje: `El monto devuelto debe ser mayor a cero y no pasar de lo que falta devolver (S/ ${enPesos(restanteC).toFixed(2)})`,
      });
    }
    if (await this.prisma.devolucionPedido.findUnique({ where: { pedido_id: pedido.id }, select: { id: true } })) {
      throw new ConflictException({ codigo: 'DEVOLUCION_YA_REGISTRADA', mensaje: 'Ya hay una devolución registrada para este pedido' });
    }
    const cobro = await this.prisma.cobro.findFirst({ where: { pedido_id: pedido.id, anulado_en: null }, include: { caja: { select: { estado: true } } } });
    const cajaCerrada = !!cobro && cobro.caja.estado !== 'ABIERTA';
    if (cajaCerrada && !tieneRol(usuario, 'ADMIN')) {
      throw new ConflictException({ codigo: 'PEDIDO_COBRADO_CAJA_CERRADA', mensaje: 'El cobro de este pedido pertenece a una caja ya cerrada: pide al administrador que lo anule.' });
    }
    if (cajaCerrada) await this.exigirCajaHoyAbierta();

    let bajaEstado: string | null = null;
    if (cobro && this.cobros) {
      const dtoCobro = { motivo: `Pedido anulado: ${motivo}` };
      const r: any = cajaCerrada
        ? await this.cobros.anularCobroCajaCerrada(cobro.id, dtoCobro, usuario, ip)
        : await this.cobros.anularCobro(cobro.id, dtoCobro, usuario, ip);
      bajaEstado = r?.comprobante_baja?.estado ?? null;
    }
    const esAdmin = tieneRol(usuario, 'ADMIN');
    const partyId = BigInt(usuario.partyId);
    const fila = await this.prisma.devolucionPedido.create({
      data: {
        pedido_id: pedido.id, monto_pagado: enPesos(Math.max(intento.monto_centimos, montoC)), monto_envio: Number(pedido.envio ?? 0),
        monto_sugerido: enPesos(montoC), monto_devuelto: enPesos(montoC), medio: 'CULQI', codigo_operacion: null, motivo,
        por_party_id: partyId, autorizado_por_party_id: partyId, comprobante_baja_estado: bajaEstado,
        estado: esAdmin ? 'PENDIENTE' : 'PENDIENTE_APROBACION', culqi_intento_id: intento.id,
      },
      select: { id: true },
    });
    await this.auditoria.registrar({
      categoria: 'CAMBIO', modulo: 'pedidos', accion: 'DEVOLUCION_AL_ANULAR', resultado: 'OK', entidad: 'devolucion_pedido', entidadId: fila.id, motivo,
      despues: { pedido: pedido.codigo, medio: 'CULQI', estado: esAdmin ? 'PENDIENTE' : 'PENDIENTE_APROBACION', montoDevuelto: enPesos(montoC), cobroAnulado: cobro ? String(cobro.id) : null, comprobanteBaja: bajaEstado },
      partyId, ip,
    });
    if (!esAdmin) {
      await this.avisarAdmin('CULQI_DEVOLUCION_PENDIENTE', 'Devolución por Culqi pendiente de tu aprobación', `El pedido ${pedido.codigo} se anuló y falta devolver S/ ${enPesos(montoC).toFixed(2)} por Culqi. Apruébala en Cancelados por no recibir.`);
    }
  }

  private async avisarAdmin(tipo: string, titulo: string, mensaje: string) {
    await this.prisma.notificacion.create({ data: { tipo, rol_destino: 'ADMIN', titulo, mensaje, enlace: '/admin/pedidos' } }).catch((e: unknown) => this.logger.warn(`Sin aviso a la campanita: ${String(e)}`));
  }

  /** Tras anular: si el que anuló es ADMIN, ejecuta el reembolso Culqi que quedó PENDIENTE. Nunca rompe la anulación. */
  async ejecutarCulqiAlAnular(pedidoId: bigint, usuario: UsuarioAutenticado, ip?: string): Promise<void> {
    if (!tieneRol(usuario, 'ADMIN')) return;
    try {
      const fila = await this.prisma.devolucionPedido.findUnique({ where: { pedido_id: pedidoId }, select: { medio: true, estado: true } });
      if (fila?.medio === 'CULQI' && fila.estado === 'PENDIENTE') await this.ejecutarCulqi(pedidoId, usuario, ip);
    } catch (e) {
      this.logger.error(`Reembolso Culqi del pedido ${pedidoId} sin ejecutar: ${String(e)}`);
    }
  }

  /**
   * Ejecuta (o reintenta) el reembolso Culqi de la devolución del pedido. Solo ADMIN. Idempotente: la devolución lleva su `ref`
   * en el intento, así que repetir no devuelve dos veces. Si Culqi falla: PENDIENTE (1.er fallo) o FALLIDA, con aviso al admin.
   */
  async ejecutarCulqi(pedidoId: bigint, usuario: UsuarioAutenticado, ip?: string) {
    if (!tieneRol(usuario, 'ADMIN')) {
      throw new ForbiddenException({ codigo: 'SOLO_ADMIN', mensaje: 'Solo el administrador puede devolver por Culqi' });
    }
    const fila = await this.prisma.devolucionPedido.findUnique({ where: { pedido_id: pedidoId }, include: { pedido: { select: { codigo: true } } } });
    if (!fila || fila.medio !== 'CULQI' || !fila.culqi_intento_id) {
      throw new NotFoundException({ codigo: 'SIN_DEVOLUCION_CULQI', mensaje: 'Este pedido no tiene una devolución por Culqi' });
    }
    if (fila.estado === 'HECHA') return { estado: 'HECHA', yaHecha: true, culqiDevolucionId: fila.culqi_devolucion_id };
    if (!this.culqi || !ESTADOS_CULQI_EJECUTABLES.includes(fila.estado)) {
      throw new ConflictException({ codigo: 'DEVOLUCION_NO_EJECUTABLE', mensaje: 'Esta devolución no se puede ejecutar' });
    }
    const reintento = fila.estado === 'FALLIDA' || fila.error != null;
    const partyId = BigInt(usuario.partyId);
    try {
      const r = await this.culqi.reembolsar({
        intentoId: fila.culqi_intento_id, montoCentimos: aCentimos(fila.monto_devuelto), motivo: (fila.motivo ?? 'Anulación del pedido').slice(0, 200),
        ref: `dp:${fila.id}`, verificarPrevio: reintento,
      });
      await this.prisma.devolucionPedido.update({ where: { id: fila.id }, data: { estado: 'HECHA', culqi_devolucion_id: r.devolucionId, error: null, autorizado_por_party_id: partyId } });
      await this.auditoria.registrar({
        categoria: 'CAMBIO', modulo: 'pedidos', accion: 'DEVOLUCION_CULQI_EJECUTADA', resultado: 'OK', entidad: 'devolucion_pedido', entidadId: fila.id,
        despues: { pedido: fila.pedido.codigo, culqiDevolucion: r.devolucionId, monto_centimos: aCentimos(fila.monto_devuelto), repetido: r.repetido }, partyId, ip,
      });
      return { estado: 'HECHA', yaHecha: false, culqiDevolucionId: r.devolucionId };
    } catch (e: any) {
      if (!(e instanceof ErrorReembolso)) throw e;
      const estado = reintento ? 'FALLIDA' : 'PENDIENTE';
      await this.prisma.devolucionPedido.update({ where: { id: fila.id }, data: { estado, error: e.message } });
      await this.auditoria.registrar({
        categoria: 'CAMBIO', modulo: 'pedidos', accion: 'DEVOLUCION_CULQI_FALLIDA', resultado: 'RECHAZADO', entidad: 'devolucion_pedido', entidadId: fila.id,
        despues: { pedido: fila.pedido.codigo, error: e.message, estado }, partyId, ip,
      });
      await this.avisarAdmin('CULQI_DEVOLUCION_FALLIDA', 'Devolución por Culqi pendiente: reintentar', `Culqi no devolvió el dinero del pedido ${fila.pedido.codigo} (${e.message}). Reintenta en Cancelados por no recibir.`);
      return { estado, yaHecha: false, error: e.message };
    }
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
