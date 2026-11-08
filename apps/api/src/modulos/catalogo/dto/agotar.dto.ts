import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AgotarDto {
  /**
   * Puede ser una fecha ISO (regreso automático), 'infinity' o ausente (hasta que lo reactive una persona).
   */
  @IsOptional()
  @IsString({ message: 'La fecha o indicador de agotado debe ser un texto' })
  agotadoHasta?: string | null;

  /** Motivo corto («se acabó la masa»); solo para agotar productos. */
  @IsOptional()
  @IsString({ message: 'El motivo debe ser un texto' })
  @MaxLength(120, { message: 'El motivo admite hasta 120 caracteres' })
  motivo?: string | null;
}
