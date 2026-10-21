import { IsOptional } from 'class-validator';

export class ActualizarPagosDto {
  @IsOptional()
  efectivo?: { activo: boolean };

  @IsOptional()
  yape?: { activo: boolean; numero?: string };

  @IsOptional()
  plin?: { activo: boolean; numero?: string };

  @IsOptional()
  transferencia?: { activo: boolean; cuenta?: string; banco?: string };

  @IsOptional()
  tarjeta?: { activo: boolean };
}
