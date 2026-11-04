import { IsIn, IsNumber, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class RegistrarDevolucionDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'El monto a devolver debe ser un número válido' })
  @IsPositive({ message: 'El monto a devolver debe ser mayor a 0' })
  montoDevuelto!: number;

  @IsString()
  @IsIn(['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'], { message: 'El medio de devolución no es válido' })
  medio!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64, { message: 'El código de operación es demasiado largo' })
  codigoOperacion?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'El motivo es demasiado largo' })
  motivo?: string;
}
