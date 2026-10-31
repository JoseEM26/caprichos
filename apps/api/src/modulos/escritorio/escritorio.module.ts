import { Module } from '@nestjs/common';
import { EscritorioOperativoController } from './escritorio-operativo.controller';
import { EscritorioOperativoService } from './escritorio-operativo.service';

@Module({
  controllers: [EscritorioOperativoController],
  providers: [EscritorioOperativoService],
})
export class EscritorioModule {}
