import { IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarInsumoDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsString()
  unidad_compra?: string;

  @IsOptional()
  @IsString()
  unidad_almacen?: string;

  @IsOptional()
  @IsString()
  unidad_receta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El factor de compra debe ser un número' })
  @IsPositive({ message: 'El factor de compra debe ser mayor a cero' })
  factor_compra?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El factor de receta debe ser un número' })
  @IsPositive({ message: 'El factor de receta debe ser mayor a cero' })
  factor_receta?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El nivel mínimo debe ser un número' })
  minimo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El nivel intermedio debe ser un número' })
  intermedio?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El nivel máximo debe ser un número' })
  maximo?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El costo unitario debe ser un número' })
  costo_unit?: number;

  @IsOptional()
  lugar_consumo_id?: string | number | null;

  @IsOptional()
  proveedor_a?: string | number | null;

  @IsOptional()
  proveedor_b?: string | number | null;

  @IsOptional()
  proveedor_c?: string | number | null;
}
