import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class ActualizarFechaEspecialDto {
  @IsOptional()
  @IsBoolean({ message: 'cerrado debe ser booleano' })
  cerrado?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'abre debe tener formato HH:mm' })
  abre?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'cierra debe tener formato HH:mm' })
  cierra?: string | null;

  @IsOptional()
  @IsString()
  motivo?: string | null;
}
