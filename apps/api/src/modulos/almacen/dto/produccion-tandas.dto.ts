import { IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class ProduccionTandasDto {
  @IsNotEmpty({ message: 'La receta es obligatoria' })
  recetaId!: string | number;

  @IsNumber({}, { message: 'El número de tandas debe ser un número' })
  @Min(0.01, { message: 'El número de tandas debe ser mayor a 0' })
  tandas!: number;

  @IsOptional()
  @IsNumber({}, { message: 'Las unidades reales deben ser un número' })
  @Min(0, { message: 'Las unidades no pueden ser negativas' })
  unidadesReales?: number;
}
