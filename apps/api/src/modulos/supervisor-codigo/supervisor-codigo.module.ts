import { Global, Module } from '@nestjs/common';
import { SupervisorCodigoController } from './supervisor-codigo.controller';
import { SupervisorCodigoService } from './supervisor-codigo.service';
import { SupervisorCodigoGuard } from './supervisor-codigo.guard';

@Global()
@Module({
  controllers: [SupervisorCodigoController],
  providers: [SupervisorCodigoService, SupervisorCodigoGuard],
  exports: [SupervisorCodigoService, SupervisorCodigoGuard],
})
export class SupervisorCodigoModule {}
