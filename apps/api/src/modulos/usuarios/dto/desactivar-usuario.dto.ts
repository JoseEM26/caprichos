import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class DesactivarUsuarioDto {
  /** Fecha de salida (AAAA-MM-DD). Por defecto hoy. Cierra el periodo abierto. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de salida debe ser AAAA-MM-DD' })
  fechaSalida?: string;

  /** Motivo opcional (queda en la auditoría). */
  @IsOptional()
  @IsString()
  @MaxLength(200, { message: 'El motivo es demasiado largo' })
  motivo?: string;
}
