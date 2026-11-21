import { Module } from '@nestjs/common';
import { CocinaModule } from '../cocina/cocina.module';
import { SalonModule } from '../salon/salon.module';
import { TvController } from './tv.controller';
import { TvGuard } from './tv.guard';
import { TvService } from './tv.service';

@Module({
  imports: [CocinaModule, SalonModule],
  controllers: [TvController],
  providers: [TvService, TvGuard],
})
export class TvModule {}
