import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class MovimientoAlmacenDto {
  @IsNotEmpty({ message: 'El tipo de movimiento es obligatorio' })
  @IsIn(['ENTRADA', 'SALIDA', 'MERMA', 'DEVOLUCION', 'AJUSTE'], {
    message: 'Tipo de movimiento inválido',
  })
  tipo!: 'ENTRADA' | 'SALIDA' | 'MERMA' | 'DEVOLUCION' | 'AJUSTE';

  @IsNotEmpty({ message: 'El insumo es obligatorio' })
  insumoId!: string | number;

  @IsNumber({}, { message: 'La cantidad debe ser un número' })
  @Min(0.001, { message: 'La cantidad debe ser mayor a 0' })
  cantidad!: number;

  @IsNotEmpty({ message: 'El origen es obligatorio' })
  @IsString({ message: 'El origen debe ser texto' })
  origen!: string;

  @IsOptional()
  @IsString({ message: 'El destino debe ser texto' })
  destino?: string;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser texto' })
  motivo?: string;

  @IsOptional()
  @IsString({ message: 'La nota debe ser texto' })
  nota?: string;
}
