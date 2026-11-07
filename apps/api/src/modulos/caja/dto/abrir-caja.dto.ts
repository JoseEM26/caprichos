import { IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AbrirCajaDto {
  /** Sin monto, se abre con el monto inicial oficial de Configuración. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El monto de apertura debe ser un número válido' })
  @Min(0, { message: 'El monto de apertura no puede ser negativo' })
  apertura?: number;
}
