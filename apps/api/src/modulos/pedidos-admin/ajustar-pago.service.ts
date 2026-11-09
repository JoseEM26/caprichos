import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { ROLES_ALCANCE_AMPLIO, esSoloMozo, rolesDelUsuario } from '../acceso/roles-usuario';
import { bloquearCaja, cobroVigente } from '../caja/caja.calculo';
import { PagoPlanService, PlanPagoItem, efectivoDelPedido } from '../pedidos/pago-plan.service';
import { repartirPropina, totalCobrable } from '../propinas/propinas.util';
import { nombresDePartes } from './devolucion-pedido.util';

const redondear = (n: number) => Math.round(n * 100) / 100;

const NOMBRES: Record<string, string> = { EFECTIVO: 'Efectivo', YAPE: 'Yape', PLIN: 'Plin', TARJETA: 'Tarjeta', TRANSFERENCIA: 'Transferencia' };

/** «Efectivo 21.00 + Yape 20.00» (para historial y auditoría). */
export const textoPlanPago = (plan: PlanPagoItem[]) => plan.map((f) => `${NOMBRES[f.medio] ?? f.medio} ${Number(f.monto).toFixed(2)}`).join(' + ');

const mismoPlan = (a: PlanPagoItem[], b: PlanPagoItem[]) => {
  const k = (p: PlanPagoItem[]) =>
    p
      .map((f) => `${f.medio}:${redondear(Number(f.monto)).toFixed(2)}`)
      .sort()
      .join('|');
  return k(a) === k(b);
};

export interface AjustarPagoDto {
  plan?: unknown;
  pagaCon?: unknown;
  motivo?: unknown;
}

/**
 * Único camino para cambiar o agregar medios de pago de un pedido NO anulado, en cualquier estado y SIN aprobación
 * ni código de supervisor (pedido del dueño: «siempre»). Lo usan Caja/Admin/Supervisor, el mozo (sus pedidos) y el
 * repartidor (los asignados a él; ver CambioCobroService.solicitar). Mantiene el total, la caja y el turno del cobro:
 *  - Cobro vigente completo de una caja ABIERTA: se reasignan sus renglones por medio (misma transacción, caja
 *    bloqueada), así el cuadre por medio y el efectivo esperado salen del plan nuevo.
 *  - Caja ya CERRADA: el cierre es inmutable, así que el cobro no se toca; el cambio queda en el pedido, en el
 *    historial y en la auditoría con `ajuste_posterior_al_cierre` (decisión abierta para el dueño).
 * No emite ni anula comprobantes, no toca stock ni puntos (dependen del total, no del medio).
 */
@Injectable()
export class AjustarPagoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly pagoPlan: PagoPlanService,
    @Optional() private readonly eventosGateway?: EventosGateway,
  ) {}

  async ajustar(idRaw: string | bigint, dto: AjustarPagoDto, usuario: UsuarioAutenticado, ip?: string, origen?: 'CAJA' | 'REPARTIDOR') {
    if (!/^\d+$/.test(String(idRaw ?? ''))) {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'El identificador no es válido' });
    }
    const pedidoId = BigInt(String(idRaw));
    const partyId = BigInt(usuario.partyId);
    const motivo = typeof dto?.motivo === 'string' ? dto.motivo.trim().slice(0, 120) : '';

    const previo = await this.prisma.pedido.findUnique({ where: { id: pedidoId }, select: { id: true, estado: true, repartidor_party_id: true, party_id: true, canal: true } });
    if (!previo) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    if (previo.estado === 'ANULADO') {
      throw new ConflictException({ codigo: 'PEDIDO_ANULADO', mensaje: 'El pedido está anulado: no tiene pago que cambiar' });
    }
    this.exigirAlcance(previo, usuario);

    const rawPlan = typeof dto?.plan === 'string' ? safeJson(dto.plan) : dto?.plan;
    if (!Array.isArray(rawPlan) || rawPlan.length === 0) {
      throw new BadRequestException({ codigo: 'PLAN_PAGO_INVALIDO', mensaje: 'Elige la forma de pago' });
    }

    const r = await this.prisma.$transaction(async (tx) => {
      // Con cobro vigente se bloquea su caja: el cambio y el cierre no corren a la vez
      const cobroCaja = await tx.cobro.findFirst({ where: { pedido_id: pedidoId, anulado_en: null }, select: { caja_id: true } });
      const caja = cobroCaja ? await bloquearCaja(tx, cobroCaja.caja_id) : null;

      const p = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: { planPago: { orderBy: { orden: 'asc' } }, cobros: { include: { pagos: true } } },
      });
      if (!p) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
      if (p.estado === 'ANULADO') throw new ConflictException({ codigo: 'PEDIDO_ANULADO', mensaje: 'El pedido está anulado: no tiene pago que cambiar' });

      const total = totalCobrable(p);
      const plan = this.pagoPlan.validar(rawPlan as PlanPagoItem[], total);
      if (!plan) throw new BadRequestException({ codigo: 'PLAN_PAGO_INVALIDO', mensaje: 'Elige la forma de pago' });
      const planNuevo: PlanPagoItem[] = plan.map((f) => ({ medio: f.medio, monto: f.monto }));

      const efectivo = efectivoDelPedido(planNuevo, null, total);
      let pagaCon: number | null = null;
      if (efectivo > 0 && dto?.pagaCon != null && String(dto.pagaCon).trim() !== '') {
        pagaCon = redondear(Number(dto.pagaCon));
        if (!Number.isFinite(pagaCon) || pagaCon < efectivo) {
          throw new BadRequestException({
            codigo: 'PAGA_CON_INVALIDO',
            mensaje: `Con cuánto paga debe ser al menos el efectivo a cobrar (S/ ${efectivo.toFixed(2)})`,
          });
        }
      }

      const cobro = cobroVigente(p.cobros);
      const planAntes: PlanPagoItem[] = cobro
        ? cobro.pagos.map((x) => ({ medio: x.medio, monto: redondear(Number(x.monto) + Number(x.propina)) }))
        : p.planPago.length > 0
          ? p.planPago.map((f) => ({ medio: f.medio, monto: redondear(Number(f.monto)) }))
          : [{ medio: String(p.pago_metodo ?? p.pago_preferido ?? 'EFECTIVO').toUpperCase(), monto: total }];
      if (mismoPlan(planAntes, planNuevo) && pagaCon == null) {
        throw new BadRequestException({ codigo: 'SIN_CAMBIO', mensaje: 'La forma de pago elegida es la misma que ya tiene el pedido' });
      }

      // Plan del pedido (renglones solo si hay varios medios) y medio principal, igual que al cobrar o al pedir
      await tx.pedidoPagoPlan.deleteMany({ where: { pedido_id: pedidoId } });
      if (planNuevo.length > 1) await this.pagoPlan.guardar(tx, pedidoId, planNuevo);
      const pagado = p.pago_estado === 'PAGADO' || cobro != null;
      const principal = planNuevo.length > 1 ? this.pagoPlan.pagoPrincipal(planNuevo) : planNuevo[0].medio;
      await tx.pedido.update({
        where: { id: pedidoId },
        data: {
          pago_metodo: pagado && planNuevo.length > 1 ? 'MIXTO' : principal,
          pago_preferido: principal,
          paga_con: efectivo > 0 ? pagaCon : null,
          // Cobro por mozo aún sin cobrar: Caja ve el medio nuevo
          ...(p.cobro_mozo_en && !pagado
            ? { cobro_mozo_medio: planNuevo.map((f) => f.medio).join('+'), cobro_mozo_recibido: efectivo > 0 ? pagaCon : null }
            : {}),
        },
      });

      // Cobro vigente completo en caja abierta: sus renglones pasan al plan nuevo (mismo cobro, caja y turno)
      let cobroActualizado = false;
      let cierre = false;
      if (cobro) {
        if (caja && caja.estado !== 'ABIERTA') cierre = true;
        else if (Number(cobro.total) >= Number(p.total)) {
          const propinas = repartirPropina(planNuevo.map((f) => ({ monto: f.monto })), Number(p.propina ?? 0));
          await tx.cobroPago.deleteMany({ where: { cobro_id: cobro.id } });
          await tx.cobroPago.createMany({
            data: planNuevo.map((f, i) => {
              const conRecibido = f.medio === 'EFECTIVO' && pagaCon != null;
              return {
                cobro_id: cobro.id,
                medio: f.medio,
                monto: new Prisma.Decimal(redondear(f.monto - propinas[i])),
                propina: new Prisma.Decimal(propinas[i]),
                recibido: conRecibido ? new Prisma.Decimal(pagaCon as number) : null,
                vuelto: conRecibido ? new Prisma.Decimal(redondear((pagaCon as number) - f.monto)) : null,
              };
            }),
          });
          cobroActualizado = true;
        }
      }

      const comprobanteEmitido = cobro != null && (await tx.comprobante.count({ where: { pedido_id: pedidoId, anulado_en: null } })) > 0;
      const nombre = (await nombresDePartes(this.prisma, [partyId])).get(String(partyId)) ?? null;
      const desde = origen ?? (usuario.rol === 'REPARTIDOR' ? 'REPARTIDOR' : 'CAJA');
      await tx.pedidoEstadoHistorial.create({
        data: {
          pedido_id: pedidoId,
          estado_anterior: p.estado,
          estado_nuevo: p.estado,
          motivo: `Pago modificado${desde === 'REPARTIDOR' ? ' por el repartidor' : ''}: ${textoPlanPago(planAntes)} → ${textoPlanPago(planNuevo)}${cierre ? ' (ajuste posterior al cierre)' : ''}${motivo ? ` · ${motivo}` : ''}`,
          por_party_id: partyId,
        },
      });
      return { p, planAntes, planNuevo, cobroActualizado, cierre, comprobanteEmitido, nombre, desde };
    });

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'CAMBIO_PAGO',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: pedidoId,
      motivo: motivo || undefined,
      antes: { plan: textoPlanPago(r.planAntes) },
      despues: {
        plan: textoPlanPago(r.planNuevo),
        estado_pedido: r.p.estado,
        pago_estado: r.p.pago_estado,
        rol: usuario.rol,
        origen: r.desde,
        cobro_actualizado: r.cobroActualizado,
        ajuste_posterior_al_cierre: r.cierre,
        comprobante_conserva_medio: r.comprobanteEmitido,
      },
      partyId,
      ip,
    });

    this.eventosGateway?.emitirAdmin('pedido:pago', { id: r.p.id.toString(), codigo: r.p.codigo, pago_estado: r.p.pago_estado, cambio: 'pago_ajustado' });
    if (r.desde === 'REPARTIDOR') {
      this.eventosGateway?.emitirAdmin('cambio-cobro:solicitud', {
        pedidoId: String(pedidoId),
        codigo: r.p.codigo,
        estado: 'APROBADA',
        repartidorPartyId: String(partyId),
      });
    }

    return {
      ok: true,
      mensaje: 'Pago actualizado',
      pedidoId: String(pedidoId),
      antes: r.planAntes,
      ahora: r.planNuevo,
      modificadoPor: r.nombre,
      cobroActualizado: r.cobroActualizado,
      ajustePosteriorAlCierre: r.cierre,
      avisos: [
        ...(r.comprobanteEmitido ? ['El comprobante ya emitido conserva el medio original'] : []),
        ...(r.cierre ? ['Este pedido es de un día cerrado: el cambio queda como ajuste, el cierre no se modifica'] : []),
      ],
    };
  }

  /** Caja, Admin y Supervisor: cualquier pedido. Repartidor: asignado a él. Mozo: los que él tomó. */
  private exigirAlcance(p: { repartidor_party_id: bigint | null; party_id: bigint | null; canal: string }, usuario: UsuarioAutenticado) {
    if (rolesDelUsuario(usuario).some((r) => (ROLES_ALCANCE_AMPLIO as readonly string[]).includes(r))) return;
    const yo = BigInt(usuario.partyId);
    if (p.repartidor_party_id != null && BigInt(p.repartidor_party_id) === yo) return;
    if (esSoloMozo(usuario) && p.canal === 'MOZO' && p.party_id != null && BigInt(p.party_id) === yo) return;
    throw new ForbiddenException({ codigo: 'PEDIDO_AJENO', mensaje: 'Este pedido no es tuyo: no puedes cambiar su pago' });
  }
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}
