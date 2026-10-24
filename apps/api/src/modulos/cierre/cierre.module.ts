import { Module } from '@nestjs/common';
import { CajaModule } from '../caja/caja.module';
import { CierreController } from './cierre.controller';
import { CierreService } from './cierre.service';

@Module({
  imports: [CajaModule],
  controllers: [CierreController],
  providers: [CierreService],
  exports: [CierreService],
})
export class CierreModule {}
