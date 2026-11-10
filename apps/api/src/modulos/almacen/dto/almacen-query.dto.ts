import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limite?: number;
}
