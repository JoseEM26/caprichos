import { IsOptional, IsString } from 'class-validator';

export class AlmacenQueryDto {
  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  fechaDesde?: string;

  @IsOptional()
  @IsString()
  fechaHasta?: string;

  @IsOptional()
  @IsString()
  origen?: string;

  @IsOptional()
  @IsString()
  destino?: string;

  @IsOptional()
  @IsString()
  insumoId?: string;

  @IsOptional()
  @IsString()
  q?: string;
}
