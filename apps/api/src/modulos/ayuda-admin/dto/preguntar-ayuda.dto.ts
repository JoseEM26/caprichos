import { IsString, IsOptional, MaxLength, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class MensajeHistorialDto {
  @IsString()
  @IsIn(['usuario', 'capri'])
  rol!: 'usuario' | 'capri';

  @IsString()
  texto!: string;
}

export class PreguntarAyudaDto {
  @IsString()
  @MaxLength(500)
  pregunta!: string;

  @IsOptional()
  @IsString()
  ruta?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MensajeHistorialDto)
  historial?: MensajeHistorialDto[];
}
