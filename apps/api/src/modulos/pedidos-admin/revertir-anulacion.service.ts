import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { esAdminOSupervisor } from '../acceso/roles-usuario';
import { PuntosService } from '../clientes/puntos.service';
import { StockService } from '../stock/stock.service';

const PREFIJO_ANULACION_COBRO = 'Pedido anulado:';

/**
 * Revierte un pedido ANULADO (por error). Solo ADMIN y SUPERVISOR; motivo obligatorio; queda auditado (antes/después).
 * Vuelve al estado que tenía antes de anular (pedido_estado_historial), vuelve a descontar el stock y a sumar los puntos
 * que la anulación devolvió, y reactiva el cobro que la anulación anuló SOLO si es seguro:
 *  - sin devolución de dinero registrada, con la caja del cobro aún abierta y sin boleta/factura dada de baja.
 * En otro caso el pedido vuelve con el pago PENDIENTE y hay que registrar el cobro de nuevo (se avisa en la respuesta).
 * Si la anulación devolvió puntos canjeados no se revierte (el descuento quedaría sin su costo): 409.
 */
@Injectable()
export class RevertirAnulacionService {
  private readonly logger = new Logger(RevertirAnulacionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    @Optional() private readonly stock?: StockService,
    @Optional() private readonly puntos?: PuntosService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  async revertir(idRaw: string, motivoRaw: string | undefined, usuario: UsuarioAutenticado, ip?: string) {
    if (!esAdminOSupervisor(usuario)) {
      throw new ForbiddenException({ codigo: 'SIN_PERMISO', mensaje: 'Solo el administrador o el supervisor pueden revertir una anulación' });
    }
    if (!/^\d+$/.test(String(idRaw))) {
      throw new BadRequestException({ codigo: 'ID_INVALIDO', mensaje: 'El identificador del pedido no es válido' });
    }
    const motivo = (motivoRaw ?? '').trim();
    if (motivo.length < 5) {
      throw new BadRequestException({ codigo: 'MOTIVO_REQUERIDO', mensaje: 'Escribe el motivo (al menos 5 letras)' });
    }
    const id = BigInt(idRaw);
    const pedido = await this.prisma.pedido.findUnique({ where: { id } });
    if (!pedido) throw new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
    if (pedido.estado !== 'ANULADO') {
      throw new ConflictException({ codigo: 'TRANSICION_INVALIDA', mensaje: `Solo se revierte un pedido anulado (está ${pedido.estado})` });
    }

    const ultima = await this.prisma.pedidoEstadoHistorial.findFirst({
      where: { pedido_id: id, estado_nuevo: 'ANULADO' },
      orderBy: { en: 'desc' },
    });
    const previo = ultima?.estado_anterior;
    if (!previo || previo === 'ANULADO') {
      throw new ConflictException({ codigo: 'SIN_ESTADO_PREVIO', mensaje: 'No se encontró el estado que tenía antes de anular' });
    }
    // Lo que devolvió la anulación empieza en anulado_en (se toma antes de anular el cobro)
    const desde = pedido.anulado_en ?? ultima!.en;

    const canjeDevuelto = await this.prisma.movimientoPuntos.findFirst({
      where: { pedido_id: id, tipo: 'DEVOLUCION_CANJE', en: { gte: desde } },
      select: { id: true },
    });
    if (canjeDevuelto) {
      throw new ConflictException({
        codigo: 'PUNTOS_CANJEADOS_DEVUELTOS',
        mensaje: 'La anulación devolvió puntos canjeados al cliente: no se puede revertir. Crea un pedido nuevo.',
      });
    }

    // Cobro que anuló la anulación del pedido (no uno anulado a mano antes)
    const cobro = await this.prisma.cobro.findFirst({
      where: { pedido_id: id, anulado_en: { gte: new Date(desde.getTime() - 1000) }, motivo_anulacion: { startsWith: PREFIJO_ANULACION_COBRO } },
      orderBy: { anulado_en: 'desc' },
      include: { caja: { select: { estado: true } } },
    });
    let reactivar = false;
    let aviso: string | null = null;
    if (cobro) {
      const vigente = await this.prisma.cobro.count({ where: { pedido_id: id, anulado_en: null } });
      const devolucion = await this.prisma.devolucionPedido.findUnique({ where: { pedido_id: id }, select: { id: true } });
      const baja = await this.prisma.comprobante.count({ where: { pedido_id: id, anulado_en: { not: null }, tipo: { in: ['BOLETA', 'FACTURA'] } } });
      if (vigente > 0) aviso = null;
      else if (devolucion) aviso = 'El dinero ya se devolvió al cliente: registra el cobro de nuevo.';
      else if (cobro.caja.estado !== 'ABIERTA') aviso = 'La caja del cobro ya cerró: registra el cobro de nuevo.';
      else if (baja > 0) aviso = 'La boleta o factura ya se dio de baja: registra el cobro de nuevo para emitir otra.';
      else reactivar = true;
    }

    const ahora = new Date();
    await this.prisma.$transaction(async (tx) => {
      const r = await tx.pedido.updateMany({
        where: { id, estado: 'ANULADO' },
        data: { estado: previo, anulado_en: null, anulado_por: null, motivo_anulacion: null, anulacion_aprobada_por: null },
      });
      if (r.count === 0) throw new ConflictException({ codigo: 'TRANSICION_INVALIDA', mensaje: 'El pedido ya no está anulado' });
      if (reactivar && cobro) {
        await tx.cobro.update({ where: { id: cobro.id }, data: { anulado_en: null, anulado_por: null, motivo_anulacion: null } });
        await tx.pedido.update({ where: { id }, data: { pago_estado: 'PAGADO' } });
      }
      await tx.pedidoEstadoHistorial.create({
        data: { pedido_id: id, estado_anterior: 'ANULADO', estado_nuevo: previo, motivo: `Anulación revertida: ${motivo}`, por_party_id: BigInt(usuario.partyId), en: ahora },
      });
    });

    // Stock y puntos: idempotentes; si fallan no deshacen la reversión, quedan en log y en la auditoría
    const pendientes: string[] = [];
    for (const [que, paso] of [
      ['el stock', () => this.stock?.reaplicarPorPedido(id, desde, usuario.partyId)],
      ['los puntos', () => (reactivar ? this.puntos?.acumularPorPedido(id) : undefined)],
    ] as Array<[string, () => Promise<unknown> | undefined]>) {
      try {
        await paso();
      } catch (e) {
        pendientes.push(que);
        this.logger.error(`Anulación revertida del pedido ${id}, pero no se pudo rehacer ${que}: ${String(e)}`);
      }
    }

    await this.auditoria.registrar({
      categoria: 'CAMBIO',
      modulo: 'pedidos',
      accion: 'REVERTIR_ANULACION',
      resultado: 'OK',
      entidad: 'pedido',
      entidadId: id,
      antes: { estado: 'ANULADO', motivo_anulacion: pedido.motivo_anulacion, anulado_por: pedido.anulado_por ? String(pedido.anulado_por) : null, pago_estado: pedido.pago_estado },
      despues: { estado: previo, cobroReactivado: reactivar, aviso, pendientes },
      motivo,
      partyId: BigInt(usuario.partyId),
      ip,
    });
    this.eventos?.emitirAdmin('pedido:estado', { id: Number(id), codigo: pedido.codigo, estado: previo });
    if (reactivar) this.eventos?.emitirAdmin('pedido:pago', { id: String(id), pago_estado: 'PAGADO', cambio: 'reactivado' });

    return { id: String(id), codigo: pedido.codigo, estado: previo, cobroReactivado: reactivar, avisoCobro: aviso, pendientes };
  }
}
