import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

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

  handleConnection(client: Socket) {
    this.logger.log(`Cliente WebSocket conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Cliente WebSocket desconectado: ${client.id}`);
  }
}
