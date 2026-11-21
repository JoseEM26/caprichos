import { Module } from '@nestjs/common';
import { ComunModule } from '../../comun/comun.module';
import { PantallaLocalController } from './pantalla-local.controller';
import { PantallaLocalService } from './pantalla-local.service';

@Module({
  imports: [ComunModule],
  controllers: [PantallaLocalController],
  providers: [PantallaLocalService],
})
export class PantallaLocalModule {}
