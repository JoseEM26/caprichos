import { Module } from '@nestjs/common';
import { LocalController } from './local.controller';
import { CartaLocalController } from './carta-local.controller';
import { LocalService } from './local.service';

@Module({
  controllers: [CartaLocalController, LocalController],
  providers: [LocalService],
  exports: [LocalService],
})
export class LocalModule {}
