import { Module } from '@nestjs/common';
import { RucAdminController, RucPublicoController } from './ruc.controller';
import { RucService } from './ruc.service';

@Module({
  controllers: [RucPublicoController, RucAdminController],
  providers: [RucService],
  exports: [RucService],
})
export class RucModule {}
