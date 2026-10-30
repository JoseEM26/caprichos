import { IsArray, IsBoolean, IsNumber, IsOptional, IsPositive, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class RecetaLineaDto {
  insumo_id!: string | number;

  @Type(() => Number)
  @IsNumber({}, { message: 'La cantidad de la línea debe ser numérica' })
  @IsPositive({ message: 'La cantidad debe ser mayor a cero' })
  cantidad!: number;

  @IsOptional()
  producto_tamano_id?: string | number | null;
}

export class GuardarRecetaDto {
  @IsOptional()
  tamano_valor_id?: string | number | null;

  @IsOptional()
  @IsBoolean()
  es_produccion?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rinde?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecetaLineaDto)
  lineas!: RecetaLineaDto[];
}
