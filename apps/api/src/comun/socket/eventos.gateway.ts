import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Eventos de tiempo real de la sala «admin» (se emiten SIEMPRE después de guardar):
 *  pedido:nuevo {id,codigo,estado}        pedido creado (bot, carta, mozo, caja)  -> Caja, Cocina, Repartos
 *  pedido:estado {id,estado,...}          cambio de estado, ubicación, reparto    -> Caja, Cocina, Repartos
 *  pedido:pago {id,pago_estado,cambio}    cobrado | coordinado | anulado          -> Caja, Cocina, Repartos
 *  vouchers:actualizado {pedidoIds,codigo,motivo,origen}
 *      motivo: subido | reemplazado | quitado | reasignado | revisado | plan | enviado_caja -> Caja (lista y modal)
 *  cocina:comanda / cocina:comanda-actualizada / pedido:progreso / carta:disponibilidad      -> Cocina
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

  constructor(private readonly jwt: JwtService) {}

  // Solo entra a la sala «admin» quien trae un token de acceso válido en handshake.auth.token;
  // los pedidos y sus estados nunca salen a conexiones anónimas.
  async handleConnection(client: Socket) {
    try {
      const token = String(client.handshake.auth?.token || '');
      await this.jwt.verifyAsync(token, { audience: 'admin' });
      await client.join('admin');
      this.logger.log(`Cliente WebSocket autenticado: ${client.id}`);
    } catch {
      this.logger.warn(`Conexión WebSocket rechazada (sin token válido): ${client.id}`);
      client.disconnect(true);
    }
  }

  emitirAdmin(evento: string, datos: unknown) {
    this.server?.to('admin').emit(evento, datos);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente WebSocket desconectado: ${client.id}`);
  }
}
