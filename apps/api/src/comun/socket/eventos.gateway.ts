import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { rolesDeCuenta } from '../../modulos/acceso/roles-usuario';
import { JwtService } from '@nestjs/jwt';

/**
 * Eventos de tiempo real de la sala «admin» (se emiten SIEMPRE después de guardar):
 *  pedido:nuevo {id,codigo,estado}        pedido creado (bot, carta, mozo, caja)  -> Caja, Cocina, Repartos
 *  pedido:estado {id,estado,...}          cambio de estado, ubicación, reparto    -> Caja, Cocina, Repartos
 *  pedido:pago {id,pago_estado,cambio}    cobrado | coordinado | anulado          -> Caja, Cocina, Repartos
 *  vouchers:actualizado {pedidoIds,codigo,motivo,origen}
 *      motivo: subido | reemplazado | quitado | reasignado | revisado | plan | enviado_caja -> Caja (lista y modal)
 *  cocina:comanda / cocina:comanda-actualizada / pedido:progreso / carta:disponibilidad      -> Cocina
 *  cambio-cobro:solicitud {pedidoId,codigo,solicitudId,estado,repartidorPartyId}   cambio de forma de pago en la puerta (PENDIENTE y su resultado) -> Caja, Repartidor
 *  reparto:rutas / reparto:incidente                                                         -> Repartos, Caja
 */
@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class EventosGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(EventosGateway.name);

  @WebSocketServer()
  server!: Server;

  afterInit() {
    this.logger.log('Servidor WebSocket (Socket.IO) inicializado correctamente');
  }

  constructor(
    private readonly jwt: JwtService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  // Solo entra quien trae un token de acceso válido en handshake.auth.token (los pedidos y sus estados nunca salen a
  // conexiones anónimas). Además de la sala común «admin» entra a `party:<id>` (avisos personales) y `rol:<ROL>`
  // por cada rol que la BASE le da hoy (principal y extra), no los del token. Cuenta desactivada o sesión cerrada
  // después de emitir el token = conexión rechazada.
  async handleConnection(client: Socket) {
    try {
      const token = String(client.handshake.auth?.token || '');
      const payload: any = await this.jwt.verifyAsync(token, { audience: 'admin' });
      const partyId = String(payload?.partyId ?? payload?.sub ?? '');
      if (!/^\d+$/.test(partyId)) throw new Error('token sin partyId');
      let roles: string[] = Array.isArray(payload?.roles) ? payload.roles.map(String) : [String(payload?.rol ?? '')];
      if (this.prisma) {
        const cuenta = await this.prisma.userAccount.findUnique({ where: { party_id: BigInt(partyId) } });
        if (!cuenta || !cuenta.activo) throw new Error('cuenta no válida');
        const cierre = cuenta.sesiones_cerradas_en;
        if (cierre && typeof payload.iat === 'number' && payload.iat < Math.floor(cierre.getTime() / 1000)) {
          throw new Error('sesión cerrada');
        }
        roles = await rolesDeCuenta(this.prisma, cuenta.id, cuenta.rol);
      }
      await client.join(['admin', `party:${partyId}`, ...roles.filter(Boolean).map((r) => `rol:${r}`)]);
      this.logger.log(`Cliente WebSocket autenticado: ${client.id}`);
    } catch {
      this.logger.warn(`Conexión WebSocket rechazada (sin token válido): ${client.id}`);
      client.disconnect(true);
    }
  }

  emitirAdmin(evento: string, datos: unknown) {
    // «notificaciones:nueva» es solo una señal para que cada panel vuelva a pedir SU lista (el servidor filtra por
    // rol, permisos y destinatario): el título o el texto de un aviso nunca viajan por la sala común.
    if (evento === 'notificaciones:nueva') {
      const id = (datos as { id?: unknown } | null)?.id;
      datos = id === undefined ? {} : { id: String(id) };
    }
    this.server?.to('admin').emit(evento, datos);
  }

  /** Solo a las pantallas abiertas de una persona (avisos y lecturas suyas). */
  emitirAParty(partyId: bigint | string, evento: string, datos: unknown) {
    this.server?.to(`party:${partyId}`).emit(evento, datos);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente WebSocket desconectado: ${client.id}`);
  }
}
