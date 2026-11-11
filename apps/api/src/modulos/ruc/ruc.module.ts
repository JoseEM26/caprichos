import { Module } from '@nestjs/common';
import { DniAdminController, RucAdminController, RucPublicoController } from './ruc.controller';
import { DniService } from './dni.service';
import { RucService } from './ruc.service';

@Module({
  controllers: [RucPublicoController, RucAdminController, DniAdminController],
  providers: [RucService, DniService],
  exports: [RucService, DniService],
})
export class RucModule {}
