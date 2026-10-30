import { IsNotEmpty, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CrearPisoDto {
  @IsString({ message: 'El nombre del piso debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre del piso es requerido' })
  nombre!: string;

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
  cuadricula?: {
    ancho?: number;
    alto?: number;
  };
}
