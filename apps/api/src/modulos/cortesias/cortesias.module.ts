import { Module } from '@nestjs/common';
import { CortesiasController, CortesiaLineaController } from './cortesias.controller';
import { CortesiasService } from './cortesias.service';

@Module({
  controllers: [CortesiasController, CortesiaLineaController],
  providers: [CortesiasService],
  exports: [CortesiasService],
})
export class CortesiasModule {}
