import { IsOptional } from 'class-validator';

export class ActualizarPagosDto {
  @IsOptional()
  efectivo?: { activo: boolean };

  @IsOptional()
  yape?: { activo: boolean; numero?: string; titular?: string };

  @IsOptional()
  plin?: { activo: boolean; numero?: string; titular?: string };

  @IsOptional()
  transferencia?: { activo: boolean; cuenta?: string; cci?: string; banco?: string; titular?: string };

  @IsOptional()
  tarjeta?: { activo: boolean };
}
