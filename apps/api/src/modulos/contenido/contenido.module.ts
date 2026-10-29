import { Module } from '@nestjs/common';
import { ContenidoService } from './contenido.service';
import { ContenidoBaseService } from './contenido-base.service';
import {
  CartaContenidoController,
  ContenidoAdminController,
} from './contenido.controller';

@Module({
  controllers: [CartaContenidoController, ContenidoAdminController],
  providers: [ContenidoService, ContenidoBaseService],
  exports: [ContenidoService],
})
export class ContenidoModule {}
