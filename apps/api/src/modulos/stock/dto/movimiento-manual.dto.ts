import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class MovimientoManualDto {
  @IsNotEmpty({ message: 'El insumo es obligatorio' })
  insumoId!: string | number;

  @IsNotEmpty({ message: 'El lugar de stock es obligatorio' })
  lugarId!: string | number;

  @IsIn(['ENTRADA', 'SALIDA', 'AJUSTE', 'MERMA', 'DEVOLUCION', 'TRASLADO'], {
    message: 'El tipo debe ser ENTRADA, SALIDA, AJUSTE, MERMA, DEVOLUCION o TRASLADO',
  })
  tipo!: 'ENTRADA' | 'SALIDA' | 'AJUSTE' | 'MERMA' | 'DEVOLUCION' | 'TRASLADO';

  @IsOptional()
  lugarDestinoId?: string | number;

  @Type(() => Number)
  @IsNumber({}, { message: 'La cantidad debe ser numérica' })
  @IsPositive({ message: 'La cantidad debe ser mayor a cero' })
  cantidad!: number;

  @IsOptional()
  @IsIn(['compra', 'almacen', 'receta'], {
    message: 'La unidad debe ser compra, almacen o receta',
  })
  unidad?: 'compra' | 'almacen' | 'receta';

  @IsOptional()
  @IsString()
  motivo?: string;

  @IsOptional()
  @IsIn(['SUMAR', 'RESTAR'], {
    message: 'La acción de ajuste debe ser SUMAR o RESTAR',
  })
  accionAjuste?: 'SUMAR' | 'RESTAR';
}
