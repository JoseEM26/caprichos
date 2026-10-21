import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class CrearFechaEspecialDto {
  @IsString({ message: 'fecha debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'fecha es requerida' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'fecha debe tener formato YYYY-MM-DD' })
  fecha!: string;

  @IsBoolean({ message: 'cerrado debe ser booleano' })
  cerrado!: boolean;

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
