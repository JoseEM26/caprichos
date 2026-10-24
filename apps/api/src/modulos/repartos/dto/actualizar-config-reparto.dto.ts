import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class ActualizarConfigRepartoDto {
  @IsOptional()
  @IsInt({ message: 'El umbral retrasado debe ser un número entero' })
  @Min(1, { message: 'El umbral retrasado debe ser al menos 1 minuto' })
  @Max(180, { message: 'El umbral retrasado no puede exceder 180 minutos' })
  @Type(() => Number)
  retrasadoMin?: number;

  @IsOptional()
  @IsInt({ message: 'El umbral tarde debe ser un número entero' })
  @Min(2, { message: 'El umbral tarde debe ser al menos 2 minutos' })
  @Max(240, { message: 'El umbral tarde no puede exceder 240 minutos' })
  @Type(() => Number)
  tardeMin?: number;

  @IsOptional()
  @IsInt({ message: 'El umbral muy tarde debe ser un número entero' })
  @Min(3, { message: 'El umbral muy tarde debe ser al menos 3 minutos' })
  @Max(360, { message: 'El umbral muy tarde no puede exceder 360 minutos' })
  @Type(() => Number)
  muyTardeMin?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La velocidad media debe ser un número' })
  @Min(5, { message: 'La velocidad media debe ser al menos 5 km/h' })
  @Max(100, { message: 'La velocidad media no puede exceder 100 km/h' })
  @Type(() => Number)
  velocidadKmh?: number;

  @IsOptional()
  @IsInt({ message: 'El máximo de pedidos debe ser un número entero' })
  @Min(1, { message: 'El máximo de pedidos debe ser al menos 1' })
  @Max(20, { message: 'El máximo de pedidos no puede exceder 20' })
  @Type(() => Number)
  maxPedidos?: number;
}
