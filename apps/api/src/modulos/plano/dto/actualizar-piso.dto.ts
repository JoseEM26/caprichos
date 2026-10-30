import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarPisoDto {
  @IsOptional()
  @IsString({ message: 'El nombre del piso debe ser un texto' })
  nombre?: string;

  @IsOptional()
  @IsBoolean({ message: 'activo debe ser un booleano' })
  activo?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'cuadriculaAncho debe ser un número' })
  @Min(1, { message: 'cuadriculaAncho debe ser mayor a 0' })
  cuadriculaAncho?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'cuadriculaAlto debe ser un número' })
  @Min(1, { message: 'cuadriculaAlto debe ser mayor a 0' })
  cuadriculaAlto?: number;

  @IsOptional()
  @Type(() => Number)
  cuadricula_ancho?: number;

  @IsOptional()
  @Type(() => Number)
  cuadricula_alto?: number;
}
