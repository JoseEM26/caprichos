import { Module } from '@nestjs/common';
import { ConsumoRecetaService } from './consumo-receta.service';

/** Consumo de insumos por receta: módulo mínimo (sin controladores ni dependencias de Stock) para que Cocina, Pedidos y Almacén lo compartan sin ciclos. */
@Module({
  providers: [ConsumoRecetaService],
  exports: [ConsumoRecetaService],
})
export class ConsumoRecetaModule {}
