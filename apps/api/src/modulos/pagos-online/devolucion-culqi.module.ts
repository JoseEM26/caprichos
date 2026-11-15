import { Module } from '@nestjs/common';
import { DevolucionCulqiService } from './devolucion-culqi.service';
import { PASARELA_PAGO } from './pasarela.puerto';
import { crearPasarela } from './pasarela.fabrica';

/** Pasarela + reembolso: aparte para que Pagos en línea y Pedidos admin lo compartan sin dependerse el uno del otro. */
@Module({
  providers: [{ provide: PASARELA_PAGO, useFactory: () => crearPasarela() }, DevolucionCulqiService],
  exports: [PASARELA_PAGO, DevolucionCulqiService],
})
export class DevolucionCulqiModule {}
