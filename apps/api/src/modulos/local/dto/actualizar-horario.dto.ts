import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ActualizarHorarioDiaDto {
  @IsInt({ message: 'dia_semana debe ser un número entero entre 1 y 7' })
  @Min(1)
  @Max(7)
  dia_semana!: number;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'abre debe tener formato HH:mm' })
  abre?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'cierra debe tener formato HH:mm' })
  cierra?: string | null;

  @IsBoolean({ message: 'cerrado debe ser booleano' })
  cerrado!: boolean;
}

export class ActualizarHorarioSemanaDto {
  @IsArray({ message: 'dias debe ser un arreglo' })
  @ValidateNested({ each: true })
  @Type(() => ActualizarHorarioDiaDto)
  dias!: ActualizarHorarioDiaDto[];
}
