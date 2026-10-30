import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarElementoDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'x debe ser un número' })
  @Min(0, { message: 'x debe ser mayor o igual a 0' })
  x?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'y debe ser un número' })
  @Min(0, { message: 'y debe ser mayor o igual a 0' })
  y?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'ancho debe ser un número' })
  @Min(1, { message: 'ancho debe ser mayor a 0' })
  ancho?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'alto debe ser un número' })
  @Min(1, { message: 'alto debe ser mayor a 0' })
  alto?: number;

  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @Type(() => Number)
  asientos?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
