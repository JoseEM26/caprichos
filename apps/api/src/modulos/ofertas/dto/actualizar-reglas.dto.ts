import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ActualizarReglasDto {
  @IsOptional()
  @IsBoolean()
  cuponConDescuento?: boolean;

  @IsOptional()
  @IsBoolean()
  promoConDescuento?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10)
  cuponesPorComprobante?: number;

  @IsOptional()
  @IsString()
  textoPie?: string;
}
