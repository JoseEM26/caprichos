import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ProduccionTandasDto {
  @IsNotEmpty({ message: 'La receta es obligatoria' })
  recetaId!: string | number;

  /** Producto por sabor: sabor que se produce (obligatorio en esos productos). */
  @IsOptional()
  saborId?: string | number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El número de tandas debe ser un número' })
  @Min(0.01, { message: 'El número de tandas debe ser mayor a 0' })
  tandas?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Las unidades obtenidas deben ser un número' })
  @Min(0.01, { message: 'Las unidades obtenidas deben ser mayores a 0' })
  unidadesObtenidas?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Las unidades reales deben ser un número' })
  @Min(0, { message: 'Las unidades no pueden ser negativas' })
  unidadesReales?: number;
}

