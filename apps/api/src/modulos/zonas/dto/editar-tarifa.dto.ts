import { IsNotEmpty, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EditarTarifaDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'La tarifa debe ser un número' })
  @IsNotEmpty({ message: 'La tarifa es requerida' })
  @Min(0, { message: 'La tarifa debe ser mayor o igual a 0' })
  tarifa!: number;
}
