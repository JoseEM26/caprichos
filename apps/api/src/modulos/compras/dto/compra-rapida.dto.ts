import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CompraRapidaDto {
  @IsNotEmpty({ message: 'El insumo es obligatorio' })
  insumoId!: string | number;

  @Type(() => Number)
  @IsNumber({}, { message: 'La cantidad debe ser numérica' })
  @Min(0.001, { message: 'La cantidad debe ser mayor a 0' })
  cantidad!: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'El costo total debe ser numérico' })
  @Min(0, { message: 'El costo total no puede ser negativo' })
  costoTotal!: number;

  @IsNotEmpty({ message: 'El medio de pago es obligatorio' })
  @IsString({ message: 'El medio de pago debe ser texto' })
  medioPago!: string;

  @IsOptional()
  @IsString({ message: 'La nota debe ser texto' })
  nota?: string;
}
