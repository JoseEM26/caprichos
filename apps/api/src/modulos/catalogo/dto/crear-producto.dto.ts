import {
  IsInt,
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TamanoProductoInputDto {
  @IsNotEmpty({ message: 'El ID del valor de tamaño es requerido' })
  tamanoValorId!: string | number;

  @IsNumber({}, { message: 'El precio del tamaño debe ser un número' })
  @Min(0, { message: 'El precio del tamaño debe ser mayor o igual a 0' })
  precio!: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  /** Unidades que lleva el tamaño (entero ≥ 1): Unidad=1, 1/2 docena=6, Docena=12. Sin valor: 1 al crear, sin cambio al editar. */
  @IsOptional()
  @IsInt({ message: 'Las unidades del tamaño deben ser un entero' })
  @Min(1, { message: 'Las unidades del tamaño deben ser al menos 1' })
  unidades?: number;
}

export class GrupoProductoInputDto {
  @IsNotEmpty({ message: 'El ID del grupo es requerido' })
  grupoId!: string | number;

  @IsOptional()
  @IsNumber()
  orden?: number;
}

export class CrearProductoDto {
  @IsString({ message: 'El nombre debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre es requerido' })
  nombre!: string;

  @IsNotEmpty({ message: 'La categoría es requerida' })
  categoriaId!: string | number;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  descripcion?: string;

  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(0, { message: 'El precio debe ser mayor o igual a 0' })
  precio!: number;

  @IsOptional()
  fotoArchivoId?: string | number | null;

  @IsOptional()
  @IsNumber({}, { message: 'El orden debe ser un número' })
  orden?: number;

  @IsOptional()
  @IsBoolean()
  noSumaBeneficios?: boolean;

  /** Cocina: resaltar la opción menos pedida (30 días) de cada grupo de este producto. */
  @IsOptional()
  @IsBoolean()
  resaltarOpcionMenosPedida?: boolean;

  /** Controla el stock de este producto (donas, galletas), aunque «Control de almacén» de insumos esté apagado. */
  @IsOptional()
  @IsBoolean()
  controlaStock?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TamanoProductoInputDto)
  tamanos?: TamanoProductoInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GrupoProductoInputDto)
  grupos?: GrupoProductoInputDto[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sabores?: string[];
}
