import { Module } from '@nestjs/common';
import { CierreController } from './cierre.controller';
import { CierreService } from './cierre.service';

@Module({
  controllers: [CierreController],
  providers: [CierreService],
  exports: [CierreService],
})
export class CierreModule {}
