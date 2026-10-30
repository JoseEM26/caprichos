import { IsOptional, IsString } from 'class-validator';

export class AgotarDto {
  /**
   * Puede ser una fecha ISO, 'infinity', o null para dejar disponible.
   * Si no se envía fecha, por defecto se considera indefinido ('infinity').
   */
  @IsOptional()
  @IsString({ message: 'La fecha o indicador de agotado debe ser un texto' })
  agotadoHasta?: string | null;
}
