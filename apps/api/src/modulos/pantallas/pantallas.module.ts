import { Module } from '@nestjs/common';
import { PantallasController } from './pantallas.controller';
import { PantallasService } from './pantallas.service';

@Module({
  controllers: [PantallasController],
  providers: [PantallasService],
  exports: [PantallasService],
})
export class PantallasModule {}
