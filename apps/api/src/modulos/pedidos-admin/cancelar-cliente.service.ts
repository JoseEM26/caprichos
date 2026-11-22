import { ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { usuarioSistema } from '../pagos-online/usuario-sistema';
import { CancelarPedidoClientePuerto } from '../chatbot/puerto/cancelar-pedido-cliente.puerto';
import { cancelablesDelTelefono, cargarCancelable } from '../pedidos/cancelable-cliente';
import { verificarTokenSeguimiento } from '../pedidos/seguimiento.tokens';
import { PedidosEstadoService } from './pedidos-estado.service';

const noEncontrado = () => new NotFoundException({ codigo: 'PEDIDO_NO_ENCONTRADO', mensaje: 'Pedido no encontrado' });
const mismoCelular = (a?: string | null, b?: string | null) => {
  const x = String(a ?? '').replace(/\D/g, '').slice(-8);
  const y = String(b ?? '').replace(/\D/g, '').slice(-8);
  return x.length === 8 && x === y;
};

/**
 * El cliente cancela su propio pedido (carta con token de seguimiento, o WhatsApp por su celular).
 * Reutiliza la anulación de Caja (stock, mesa, cupones, puntos, historial, auditoría y avisos), con la cuenta del sistema.
 */
@Injectable()
export class CancelarClienteService implements CancelarPedidoClientePuerto {
  private readonly logger = new Logger(CancelarClienteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly estados: PedidosEstadoService,
    @Optional() private readonly eventos?: EventosGateway,
  ) {}

  /** Carta: el acceso lo da el token del seguimiento. */
  async cancelarPorToken(codigo: string, token: string | undefined, motivo?: string) {
    const p = await this.prisma.pedido.findUnique({ where: { codigo }, select: { id: true } });
    if (!p || !verificarTokenSeguimiento(p.id, token)) throw noEncontrado();
    return this.cancelar(p.id, motivo);
  }

  /** WhatsApp: el pedido debe ser del mismo celular que escribe. */
  async cancelarPorTelefono(codigo: string, telefono: string, motivo?: string) {
    const p = await this.prisma.pedido.findUnique({ where: { codigo }, select: { id: true, cliente_telefono: true } });
    if (!p || !mismoCelular(p.cliente_telefono, telefono)) throw noEncontrado();
    return this.cancelar(p.id, motivo);
  }

  async evaluarPorTelefono(telefono: string) {
    const filas = await cancelablesDelTelefono(this.prisma, telefono);
    return filas.map(({ pedido, resultado }) => ({
      id: pedido.id.toString(),
      codigo: pedido.codigo,
      cancelable: resultado.cancelable,
      mensaje: resultado.cancelable ? undefined : resultado.mensaje,
    }));
  }

  private async cancelar(pedidoId: bigint, motivo?: string) {
    const actual = await cargarCancelable(this.prisma, { id: pedidoId });
    if (!actual) throw noEncontrado();
    if (!actual.resultado.cancelable) {
      throw new ConflictException({ codigo: 'NO_CANCELABLE', mensaje: actual.resultado.mensaje, razon: actual.resultado.razon });
    }
    const detalle = String(motivo ?? '').trim().slice(0, 120);
    const usuario = await usuarioSistema(this.prisma);
    try {
      // ponytail: la ventana entre la revisión y el cambio es de milisegundos; cambiarEstado vuelve a validar el estado
      // y rechaza con 409 si Caja ya lo movió. Si hiciera falta, bloquear la fila en una sola transacción.
      await this.estados.cambiarEstado(pedidoId, { estado: 'ANULADO', motivo: `Cancelado por el cliente${detalle ? `: ${detalle}` : ''}` } as any, usuario as any);
    } catch (e: any) {
      if (e?.getResponse?.()?.codigo === 'TRANSICION_INVALIDA') {
        throw new ConflictException({ codigo: 'NO_CANCELABLE', mensaje: 'Caja ya aceptó tu pedido y no se puede cancelar.' });
      }
      throw e;
    }
    await this.prisma.pagoOnlineIntento.updateMany({ where: { pedido_id: pedidoId, estado: 'CREADO' }, data: { estado: 'FALLIDO', mensaje: 'El cliente canceló el pedido' } }).catch(() => undefined);
    await this.avisarCaja(pedidoId, actual.pedido.codigo).catch((e: any) => this.logger.warn(`Aviso de cancelación ${actual.pedido.codigo}: ${e?.message}`));
    return { codigo: actual.pedido.codigo };
  }

  private async avisarCaja(pedidoId: bigint, codigo: string) {
    const aviso = await this.prisma.notificacion.create({
      data: {
        tipo: 'PEDIDO_CANCELADO_CLIENTE',
        rol_destino: null,
        titulo: `Pedido ${codigo} cancelado por el cliente`,
        mensaje: 'El cliente lo canceló antes de pagar. No lo prepares.',
        enlace: `/admin/caja?pedido=${pedidoId}`,
      },
    });
    this.eventos?.emitirAdmin('notificaciones:nueva', { id: aviso.id.toString(), titulo: aviso.titulo });
  }
}
