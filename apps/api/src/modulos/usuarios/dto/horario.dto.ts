import { Type } from 'class-transformer';
import { IsArray, IsInt, IsOptional, Matches, Max, Min, ValidateNested } from 'class-validator';

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export class HorarioDiaDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dia!: number; // 0 = Domingo

  @Matches(HORA, { message: 'La entrada debe tener formato HH:MM' })
  entrada!: string;

  @Matches(HORA, { message: 'La salida debe tener formato HH:MM' })
  salida!: string; // si es menor que la entrada, el turno cruza la medianoche

  /** Almuerzo programado (opcional): ambos o ninguno. */
  @IsOptional()
  @Matches(HORA, { message: 'El inicio de almuerzo debe tener formato HH:MM' })
  almuerzoInicio?: string;

  @IsOptional()
  @Matches(HORA, { message: 'El fin de almuerzo debe tener formato HH:MM' })
  almuerzoFin?: string;
}

export class ReemplazoDiaDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dia!: number;

  @Matches(/^\d+$/, { message: 'El reemplazo no es válido' })
  reemplazaPartyId!: string;
}

export class ConfigurarHorarioDto {
  /** Solo los días que trabaja. Los demás quedan como descanso. Omitido = no se toca. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HorarioDiaDto)
  horarios?: HorarioDiaDto[];

  /** Reemplazo fijo por día de la semana. Omitido = no se toca. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReemplazoDiaDto)
  reemplazos?: ReemplazoDiaDto[];
}
