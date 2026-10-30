import { IsOptional, IsString } from 'class-validator';

export class ComprasQueryDto {
  @IsOptional()
  @IsString()
  proveedorPartyId?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  condicion?: string;

  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @IsOptional()
  @IsString()
  fechaHasta?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
