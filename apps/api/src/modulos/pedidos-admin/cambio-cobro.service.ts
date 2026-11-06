import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { PagoPlanService, PlanPagoItem, efectivoDelPedido, mediosDigitalesDelPedido } from '../pedidos/pago-plan.service';
import { VouchersService } from '../vouchers/vouchers.service';
import { totalCobrable } from '../propinas/propinas.util';
import { nombresDePartes } from './devolucion-pedido.util';

export const ACCIONES_RESOLVER = ['APROBAR', 'RECHAZAR', 'AUTORIZAR_SIN_VALIDAR'] as const;
export type AccionResolver = (typeof ACCIONES_RESOLVER)[number];

const ESTADO_POR_ACCION: Record<AccionResolver, string> = {
  APROBAR: 'APROBADA',
  RECHAZAR: 'RECHAZADA',
  AUTORIZAR_SIN_VALIDAR: 'AUTORIZADA_SIN_VALIDAR',
};

/** Una captura por medio digital del plan nuevo; el archivo llega en el campo `captura_<MEDIO>`. */
export type CapturasCambioCobro = Record<string, Express.Multer.File | undefined>;

const redondear = (n: number) => Math.round(n * 100) / 100;

/** Plan que hoy tiene el pedido: sus renglones, o el medio único por el total cobrable. */
export function planActualDelPedido(p: {
  planPago?: Array<{ medio: string; monto: unknown }> | null;
  pago_metodo: string | null;
  pago_preferido?: string | null;
  total: unknown;
  propina?: unknown;
}): PlanPagoItem[] {
  if (p.planPago && p.planPago.length > 0) return p.planPago.map((f) => ({ medio: f.medio, monto: redondear(Number(f.monto)) }));
  return [{ medio: String(p.pago_metodo ?? p.pago_preferido ?? 'EFECTIVO').toUpperCase(), monto: totalCobrable(p) }];
}

/** Mismo plan (mismos medios y montos, sin importar el orden). */
export function mismoPlan(a: PlanPagoItem[], b: PlanPagoItem[]): boolean {
  const clave = (pl: PlanPagoItem[]) =>
    pl
      .map((f) => `${f.medio}:${redondear(Number(f.monto)).toFixed(2)}`)
      .sort()
      .join('|');
  return clave(a) === clave(b);
}

/**
 * El delivery pide cambiar la forma de pago en la puerta y Caja la valida. Mientras la solicitud esté PENDIENTE el
 * pedido sigue con su medio original y no se puede marcar Entregado (lo corta RepartosService.entregar). Al aprobar o
 * autorizar se reescribe el plan (pedido_pago_plan) y pago_metodo: así el efectivo por rendir y el cierre cuentan el
 * medio final. El historial de solicitudes es inmutable (trigger en la BD).
 */
@Injectable()
export class CambioCobroService {
  private readonly logger = new Logger(CambioCobroService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly vouchers: VouchersService,
    private readonly pagoPlan: PagoPlanService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  private parseId(valor: unknown, codigo = 'ID_INVALIDO'): bigint {
    if (!/^\d+$/.test(String(valor ?? ''))) {
      throw new BadRequestException({ codigo, mensaje: 'El identificador no es válido' });
    }
    return BigInt(String(valor));
  }

  /** Pedido del repartidor autenticado (dueño) y en camino; cualquier otro es 403/409. */
  private async pedidoDelRepartidor(idRaw: string, usuario: UsuarioAutenticado) {
    const id = this.parseId(idRaw);
    const pedido = await this.prisma.pedido.findUnique({ where: { id }, include: { planPago: { orderBy: { orden: 'asc' } } } });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    if (pedido.repartidor_party_id == null || BigInt(pedido.repartidor_party_id) !== BigInt(usuario.partyId)) {
      throw new ForbiddenException({ codigo: 'PEDIDO_AJENO', mensaje: 'Este pedido no está asignado a ti' });
    }
    if (pedido.modalidad !== 'DELIVERY' || pedido.estado !== 'EN_CAMINO') {
      throw new ConflictException({
        codigo: 'ESTADO_INVALIDO',
        mensaje: 'Solo puedes cambiar la forma de pago de un pedido que va en camino o ya llegó',
      });
    }
    if (pedido.pago_estado === 'PAGADO') {
      throw new ConflictException({ codigo: 'YA_PAGADO', mensaje: 'Este pedido ya está pagado: no hay cobro que cambiar' });
    }
    return pedido;
  }

  private parsearPlan(planRaw: unknown): PlanPagoItem[] {
    let valor: unknown = planRaw;
    if (typeof planRaw === 'string') {
      try {
        valor = JSON.parse(planRaw);
      } catch {
        valor = null;
      }
    }
    if (!Array.isArray(valor) || valor.length === 0) {
      throw new BadRequestException({ codigo: 'PLAN_PAGO_INVALIDO', mensaje: 'Elige la nueva forma de pago' });
    }
    return valor as PlanPagoItem[];
  }

  /** El repartidor solicita el cambio. Sube la captura de cada medio digital junto con la solicitud. */
  async solicitar(
    idRaw: string,
    body: { plan?: unknown; pagaCon?: unknown },
    capturas: CapturasCambioCobro,
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedido = await this.pedidoDelRepartidor(idRaw, usuario);
    const partyId = BigInt(usuario.partyId);
    const total = totalCobrable(pedido);

    const plan = this.pagoPlan.validar(this.parsearPlan(body.plan), total);
    if (!plan) throw new BadRequestException({ codigo: 'PLAN_PAGO_INVALIDO', mensaje: 'Elige la nueva forma de pago' });
    const planNuevo: PlanPagoItem[] = plan.map((f) => ({ medio: f.medio, monto: f.monto }));
    const planOriginal = planActualDelPedido(pedido);
    if (mismoPlan(planNuevo, planOriginal)) {
      throw new BadRequestException({ codigo: 'SIN_CAMBIO', mensaje: 'La forma de pago elegida es la misma que ya tiene el pedido' });
    }

    // Captura obligatoria por cada medio digital (voucher siempre obligatorio); la tarjeta no la exige
    const digitales = mediosDigitalesDelPedido(planNuevo, null, total);
    for (const d of digitales) {
      if (!capturas[d.medio]?.buffer) {
        throw new BadRequestException({
          codigo: 'CAPTURA_REQUERIDA',
          mensaje: `Sube la captura del pago por ${d.medio === 'TRANSFERENCIA' ? 'transferencia' : d.medio} (S/ ${d.monto.toFixed(2)})`,
          medio: d.medio,
        });
      }
    }

    const montoEfectivo = efectivoDelPedido(planNuevo, null, total);
    let pagaCon: number | null = null;
    if (montoEfectivo > 0 && body.pagaCon != null && String(body.pagaCon).trim() !== '') {
      pagaCon = redondear(Number(body.pagaCon));
      if (!Number.isFinite(pagaCon) || pagaCon < montoEfectivo) {
        throw new BadRequestException({
          codigo: 'PAGA_CON_INVALIDO',
          mensaje: `Con cuánto paga debe ser al menos el efectivo a cobrar (S/ ${montoEfectivo.toFixed(2)})`,
        });
      }
    }

    const previa = await this.prisma.solicitudCambioCobro.findFirst({ where: { pedido_id: pedido.id, estado: 'PENDIENTE' } });
    if (previa) {
      throw new ConflictException({ codigo: 'CAMBIO_COBRO_PENDIENTE', mensaje: 'Ya hay una solicitud pendiente: espera a que Caja la valide' });
    }

    // Subir las capturas (se leen con la IA y cuentan contra el plan NUEVO). Una ilegible no cuenta: se retira y se pide otra.
    const voucherIds: bigint[] = [];
    const retirar = async (ids: bigint[], motivo: string) => {
      if (ids.length === 0) return;
      await this.prisma.voucherPago.updateMany({
        where: { id: { in: ids } },
        data: { retirado: true, reemplazado_en: new Date(), motivo_cambio: motivo },
      });
    };
    for (const d of digitales) {
      const r: any = await this.vouchers.subirYProcesar(
        capturas[d.medio],
        {
          pedidoId: pedido.id,
          medio: d.medio as 'YAPE' | 'PLIN' | 'TRANSFERENCIA',
          origen: 'REPARTIDOR',
          planEsperado: planNuevo,
          motivoCambio: 'Cambio de forma de pago en la puerta (solicitud del repartidor)',
        },
        usuario,
        ip,
      );
      const vid = BigInt(r.id);
      voucherIds.push(vid);
      if (r.legible === false) {
        await retirar(voucherIds, 'Captura ilegible en cambio de cobro');
        throw new BadRequestException({
          codigo: 'CAPTURA_ILEGIBLE',
          mensaje: `La captura de ${d.medio} no se lee bien. Toma otra foto, por favor.`,
          medio: d.medio,
        });
      }
    }

    let fila;
    try {
      fila = await this.prisma.solicitudCambioCobro.create({
        data: {
          pedido_id: pedido.id,
          solicitado_por_party_id: partyId,
          estado: 'PENDIENTE',
          plan_original: planOriginal as unknown as Prisma.InputJsonValue,
          plan_solicitado: planNuevo as unknown as Prisma.InputJsonValue,
          paga_con: pagaCon,
          voucher_ids: voucherIds,
        },
      });
    } catch (e) {
      await retirar(voucherIds, 'Solicitud de cambio de cobro no registrada');
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({ codigo: 'CAMBIO_COBRO_PENDIENTE', mensaje: 'Ya hay una solicitud pendiente: espera a que Caja la valide' });
      }
      throw e;
    }

    const nombre = (await nombresDePartes(this.prisma, [partyId])).get(String(partyId)) ?? 'el repartidor';
    await this.prisma.pedidoEstadoHistorial.create({
      data: {
        pedido_id: pedido.id,
        estado_anterior: pedido.estado,
        estado_nuevo: pedido.estado,
        motivo: `Cambio de pago solicitado: ${this.texto(planOriginal)} → ${this.texto(planNuevo)}`,
        por_party_id: partyId,
      },
    });
    await this.avisarCaja(pedido.codigo, nombre, fila.id, pedido.id, partyId);
    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'repartos',
      accion: 'SOLICITAR_CAMBIO_COBRO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedido.id,
      antes: { plan: this.texto(planOriginal) },
      despues: { solicitudId: String(fila.id), plan: this.texto(planNuevo), pagaCon, vouchers: voucherIds.map(String) },
      partyId,
      ip,
    });
    return this.salida(fila, new Map([[String(partyId), nombre]]));
  }

  /** Solicitud más reciente del pedido (cualquier estado), o null. El repartidor solo ve las de sus pedidos. */
  async vigente(idRaw: string, usuario: UsuarioAutenticado) {
    const id = this.parseId(idRaw);
    if (usuario.rol === 'REPARTIDOR') {
      const p = await this.prisma.pedido.findUnique({ where: { id }, select: { repartidor_party_id: true } });
      if (!p || p.repartidor_party_id == null || BigInt(p.repartidor_party_id) !== BigInt(usuario.partyId)) {
        throw new ForbiddenException({ codigo: 'PEDIDO_AJENO', mensaje: 'Este pedido no está asignado a ti' });
      }
    }
    const fila = await this.prisma.solicitudCambioCobro.findFirst({ where: { pedido_id: id }, orderBy: { id: 'desc' } });
    if (!fila) return null;
    const nombres = await nombresDePartes(this.prisma, [fila.solicitado_por_party_id, ...(fila.resuelto_por_party_id ? [fila.resuelto_por_party_id] : [])]);
    return this.salida(fila, nombres);
  }

  /** Solicitudes pendientes de todos los pedidos (insignia y panel de Caja). */
  async pendientes() {
    const filas = await this.prisma.solicitudCambioCobro.findMany({
      where: { estado: 'PENDIENTE' },
      orderBy: { solicitado_en: 'asc' },
      include: { pedido: { select: { id: true, codigo: true, cliente_nombre: true, total: true, propina: true, estado: true, pago_estado: true, paga_con: true } } },
    });
    const nombres = await nombresDePartes(this.prisma, filas.map((f) => f.solicitado_por_party_id));
    return filas.map((f) => ({
      ...this.salida(f, nombres),
      codigo: f.pedido.codigo,
      cliente: f.pedido.cliente_nombre,
      total: totalCobrable(f.pedido),
      estadoPedido: f.pedido.estado,
      pagoEstado: f.pedido.pago_estado,
    }));
  }

  /** Caja/Admin/Supervisor resuelve: aprobar, rechazar o autorizar la entrega sin validar (con motivo). */
  async resolver(
    idRaw: string,
    solicitudIdRaw: string,
    dto: { accion?: unknown; motivo?: unknown },
    usuario: UsuarioAutenticado,
    ip?: string,
  ) {
    const pedidoId = this.parseId(idRaw);
    const solicitudId = this.parseId(solicitudIdRaw, 'SOLICITUD_NO_ENCONTRADA');
    const accion = String(dto?.accion ?? '').toUpperCase() as AccionResolver;
    if (!ACCIONES_RESOLVER.includes(accion)) {
      throw new BadRequestException({ codigo: 'ACCION_INVALIDA', mensaje: 'La acción debe ser APROBAR, RECHAZAR o AUTORIZAR_SIN_VALIDAR' });
    }
    const motivo = typeof dto?.motivo === 'string' ? dto.motivo.trim() : '';
    if (accion === 'AUTORIZAR_SIN_VALIDAR' && motivo.length < 5) {
      throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe el motivo para autorizar la entrega sin validar (mínimo 5 caracteres)' });
    }

    const solicitud = await this.prisma.solicitudCambioCobro.findUnique({ where: { id: solicitudId } });
    if (!solicitud || solicitud.pedido_id !== pedidoId) {
      throw new NotFoundException({ codigo: 'SOLICITUD_NO_ENCONTRADA', mensaje: 'La solicitud no existe en este pedido' });
    }
    if (solicitud.estado !== 'PENDIENTE') {
      throw new ConflictException({ codigo: 'SOLICITUD_NO_VIGENTE', mensaje: 'La solicitud ya fue resuelta' });
    }
    const partyId = BigInt(usuario.partyId);
    const planNuevo = solicitud.plan_solicitado as unknown as PlanPagoItem[];
    const planOriginal = solicitud.plan_original as unknown as PlanPagoItem[];

    const { pedido, resuelta } = await this.prisma.$transaction(async (tx) => {
      const p = await tx.pedido.findUnique({ where: { id: pedidoId } });
      if (!p) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
      // La fila se resuelve primero y solo si sigue PENDIENTE: dos Cajas a la vez no la aplican dos veces
      const r = await tx.solicitudCambioCobro.updateMany({
        where: { id: solicitudId, estado: 'PENDIENTE' },
        data: { estado: ESTADO_POR_ACCION[accion], resuelto_por_party_id: partyId, resuelto_en: new Date(), motivo: motivo || null },
      });
      if (r.count !== 1) throw new ConflictException({ codigo: 'SOLICITUD_NO_VIGENTE', mensaje: 'La solicitud ya fue resuelta' });

      if (accion === 'RECHAZAR') {
        // El pedido sigue con su medio original; las capturas del intento quedan retiradas en el historial
        await tx.voucherPago.updateMany({
          where: { id: { in: solicitud.voucher_ids } },
          data: { retirado: true, reemplazado_en: new Date(), reemplazado_por: partyId, motivo_cambio: 'Cambio de forma de pago rechazado por Caja' },
        });
      } else {
        if (p.estado === 'ANULADO' || p.pago_estado === 'PAGADO') {
          throw new ConflictException({ codigo: 'PEDIDO_NO_MODIFICABLE', mensaje: 'El pedido ya está anulado o pagado: no se puede cambiar el cobro' });
        }
        await tx.pedidoPagoPlan.deleteMany({ where: { pedido_id: pedidoId } });
        if (planNuevo.length > 1) await this.pagoPlan.guardar(tx, pedidoId, planNuevo);
        const medio = planNuevo.length > 1 ? this.pagoPlan.pagoPrincipal(planNuevo) : planNuevo[0].medio;
        const hayEfectivo = efectivoDelPedido(planNuevo, medio, 0) > 0;
        await tx.pedido.update({
          where: { id: pedidoId },
          data: {
            pago_metodo: medio,
            pago_preferido: medio,
            paga_con: hayEfectivo && solicitud.paga_con != null ? solicitud.paga_con : null,
          },
        });
        // Solo al aprobar la captura queda validada; autorizar sin validar la deja pendiente de revisión
        if (accion === 'APROBAR') {
          await tx.voucherPago.updateMany({
            where: { id: { in: solicitud.voucher_ids }, revisado_en: null },
            data: { revisado_en: new Date(), revisado_por: partyId },
          });
        }
      }
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pedidoId,
          estado_anterior: p.estado,
          estado_nuevo: p.estado,
          motivo:
            accion === 'RECHAZAR'
              ? `Cambio de pago rechazado (sigue ${this.texto(planOriginal)})${motivo ? `: ${motivo}` : ''}`
              : `Cambio de pago ${accion === 'APROBAR' ? 'aprobado' : 'autorizado sin validar'}: ${this.texto(planOriginal)} → ${this.texto(planNuevo)}${motivo ? ` (${motivo})` : ''}`,
          por_party_id: partyId,
        },
      });
      return { pedido: p, resuelta: await tx.solicitudCambioCobro.findUniqueOrThrow({ where: { id: solicitudId } }) };
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: `${accion}_CAMBIO_COBRO`,
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      motivo: motivo || undefined,
      antes: { plan: this.texto(planOriginal) },
      despues: { solicitudId: String(solicitudId), estado: ESTADO_POR_ACCION[accion], plan: this.texto(accion === 'RECHAZAR' ? planOriginal : planNuevo) },
      partyId,
      ip,
    });
    await this.avisarRepartidor(pedido.codigo, pedido.id, solicitud.solicitado_por_party_id, solicitudId, accion, motivo);
    const nombres = await nombresDePartes(this.prisma, [resuelta.solicitado_por_party_id, partyId]);
    return this.salida(resuelta, nombres);
  }

  private texto(plan: PlanPagoItem[]): string {
    return plan.map((f) => `${f.medio} ${Number(f.monto).toFixed(2)}`).join(' + ');
  }

  private salida(f: {
    id: bigint;
    pedido_id: bigint;
    solicitado_por_party_id: bigint;
    solicitado_en: Date;
    estado: string;
    plan_original: unknown;
    plan_solicitado: unknown;
    paga_con: unknown;
    voucher_ids: bigint[];
    motivo: string | null;
    resuelto_por_party_id: bigint | null;
    resuelto_en: Date | null;
  }, nombres: Map<string, string>) {
    return {
      id: String(f.id),
      pedidoId: String(f.pedido_id),
      estado: f.estado,
      planOriginal: f.plan_original as PlanPagoItem[],
      planSolicitado: f.plan_solicitado as PlanPagoItem[],
      pagaCon: f.paga_con != null ? Number(f.paga_con) : null,
      voucherIds: f.voucher_ids.map(String),
      motivo: f.motivo,
      solicitadoPor: nombres.get(String(f.solicitado_por_party_id)) ?? null,
      solicitadoPorPartyId: String(f.solicitado_por_party_id),
      solicitadoEn: f.solicitado_en,
      resueltoPor: f.resuelto_por_party_id ? nombres.get(String(f.resuelto_por_party_id)) ?? null : null,
      resueltoEn: f.resuelto_en,
    };
  }

  private async avisarCaja(codigo: string, nombre: string, solicitudId: bigint, pedidoId: bigint, repartidor: bigint) {
    const titulo = `Cambio de pago solicitado por ${nombre}`;
    try {
      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'CAMBIO_COBRO_SOLICITADO',
          rol_destino: 'CAJERO',
          titulo,
          mensaje: `Pedido ${codigo}: valida la captura y aprueba o rechaza el cambio`,
          enlace: '/admin/pedidos',
        },
      });
      this.eventosGateway?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
    } catch (err) {
      this.logger.error(`Aviso de cambio de cobro no registrado: ${(err as Error).message}`);
    }
    this.eventosGateway?.emitirAdmin('cambio-cobro:solicitud', {
      pedidoId: String(pedidoId),
      codigo,
      solicitudId: String(solicitudId),
      estado: 'PENDIENTE',
      repartidorPartyId: String(repartidor),
    });
  }

  private async avisarRepartidor(codigo: string, pedidoId: bigint, repartidor: bigint, solicitudId: bigint, accion: AccionResolver, motivo: string) {
    const titulo =
      accion === 'RECHAZAR'
        ? `Caja rechazó el cambio de pago de ${codigo}: cobra con el medio original`
        : accion === 'APROBAR'
        ? `Caja aprobó el cambio de pago de ${codigo}`
        : `Caja autorizó entregar ${codigo} sin validar el pago`;
    try {
      const notif = await this.prisma.notificacion.create({
        data: {
          tipo: 'CAMBIO_COBRO_RESUELTO',
          party_destino: repartidor,
          titulo,
          mensaje: motivo || null,
          enlace: '/admin/repartos',
        },
      });
      this.eventosGateway?.emitirAdmin('notificaciones:nueva', { id: notif.id.toString(), titulo });
    } catch (err) {
      this.logger.error(`Aviso de resultado del cambio de cobro no registrado: ${(err as Error).message}`);
    }
    const estado = ESTADO_POR_ACCION[accion];
    this.eventosGateway?.emitirAdmin('cambio-cobro:solicitud', {
      pedidoId: String(pedidoId),
      codigo,
      solicitudId: String(solicitudId),
      estado,
      repartidorPartyId: String(repartidor),
    });
    // Las listas de Caja y del repartidor se recargan con los eventos de siempre
    this.eventosGateway?.emitirAdmin('pedido:pago', { id: Number(pedidoId), codigo, pago_estado: 'PENDIENTE', cambio: 'cambio_cobro' });
  }
}
