import { IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class MovimientosQueryDto {
  @IsOptional()
  @IsString()
  insumo?: string;

  @IsOptional()
  @IsString()
  lugar?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  limite?: number;
}
