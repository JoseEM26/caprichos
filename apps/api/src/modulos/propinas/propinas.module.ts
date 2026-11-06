import { Module } from '@nestjs/common';
import { PropinasController } from './propinas.controller';
import { PropinasService } from './propinas.service';

@Module({
  controllers: [PropinasController],
  providers: [PropinasService],
  exports: [PropinasService],
})
export class PropinasModule {}
