import { IsIn, IsNotEmpty, IsNumber, IsPositive, IsString, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CrearMovimientoDto {
  @IsString({ message: 'El tipo debe ser una cadena de texto' })
  @IsIn(['INGRESO', 'EGRESO'], { message: 'El tipo debe ser INGRESO o EGRESO' })
  tipo!: 'INGRESO' | 'EGRESO';

  @Type(() => Number)
  @IsNumber({}, { message: 'El monto debe ser un número válido' })
  @IsPositive({ message: 'El monto debe ser mayor a 0' })
  monto!: number;

  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo es requerido' })
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres' })
  motivo!: string;
}
