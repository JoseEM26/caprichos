import { IsNumber, IsOptional, Max, Min } from 'class-validator';

/** Posición del repartidor. Caja razonable alrededor de Perú; precisión hasta 200 m. */
export class UbicacionRepartidorDto {
  @IsNumber({}, { message: 'Latitud no válida' })
  @Min(-19.5, { message: 'La latitud está fuera de Perú' })
  @Max(0.5, { message: 'La latitud está fuera de Perú' })
  lat!: number;

  @IsNumber({}, { message: 'Longitud no válida' })
  @Min(-82, { message: 'La longitud está fuera de Perú' })
  @Max(-68, { message: 'La longitud está fuera de Perú' })
  lng!: number;

  @IsNumber({}, { message: 'Precisión no válida' })
  @Min(0)
  @Max(200, { message: 'La precisión del GPS es muy baja (más de 200 m)' })
  precision!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(360)
  rumbo?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100) // m/s
  velocidad?: number;
}
