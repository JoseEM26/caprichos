import { Module } from '@nestjs/common';
import { ContenidoService } from './contenido.service';
import {
  CartaContenidoController,
  ContenidoAdminController,
} from './contenido.controller';

@Module({
  controllers: [CartaContenidoController, ContenidoAdminController],
  providers: [ContenidoService],
  exports: [ContenidoService],
})
export class ContenidoModule {}
