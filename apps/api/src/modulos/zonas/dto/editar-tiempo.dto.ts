import { IsInt, IsNotEmpty, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class EditarTiempoDto {
  @Type(() => Number)
  @IsInt({ message: 'El tiempo mínimo debe ser un número entero de minutos' })
  @IsNotEmpty({ message: 'El tiempo mínimo es requerido' })
  @Min(5, { message: 'El tiempo mínimo debe ser de al menos 5 minutos' })
  @Max(120, { message: 'El tiempo mínimo no puede pasar de 120 minutos' })
  minutosMin!: number;

  @Type(() => Number)
  @IsInt({ message: 'El tiempo máximo debe ser un número entero de minutos' })
  @IsNotEmpty({ message: 'El tiempo máximo es requerido' })
  @Min(5, { message: 'El tiempo máximo debe ser de al menos 5 minutos' })
  @Max(120, { message: 'El tiempo máximo no puede pasar de 120 minutos' })
  minutosMax!: number;
}
