import { IsIn, IsOptional, IsString } from 'class-validator';

export class FiltrarRepartosDto {
  @IsOptional()
  @IsString()
  repartidor?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  /** 'true' para incluir pedidos ya entregados, anulados u otros estados (historial). Por defecto solo activos. */
  @IsOptional()
  @IsIn(['true', 'false'])
  historial?: string;
}
