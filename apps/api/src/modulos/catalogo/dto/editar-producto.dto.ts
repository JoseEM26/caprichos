import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  MaxLength,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ALERGENOS_PERMITIDOS, GrupoProductoInputDto, TamanoProductoInputDto } from './crear-producto.dto';

export class SaborInputDto {
  @IsOptional()
  id?: string | number;

  @IsString({ message: 'El nombre del sabor debe ser texto' })
  nombre!: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class EditarProductoDto {
  @IsOptional()
  @IsString({ message: 'El nombre debe ser un texto' })
  nombre?: string;

  @IsOptional()
  categoriaId?: string | number;

  @IsOptional()
  @IsString({ message: 'La descripción debe ser un texto' })
  descripcion?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(0, { message: 'El precio debe ser mayor o igual a 0' })
  precio?: number;

  @IsOptional()
  fotoArchivoId?: string | number | null;

  @IsOptional()
  @IsNumber({}, { message: 'El orden debe ser un número' })
  orden?: number;

  @IsOptional()
  @IsBoolean()
  oculto?: boolean;

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

  /** «Alcanza para»: texto corto, p. ej. «8 a 10 personas». */
  @IsOptional()
  @IsString({ message: 'Alcanza para debe ser un texto' })
  @MaxLength(60, { message: 'Alcanza para admite hasta 60 caracteres' })
  porciones?: string | null;

  @IsOptional()
  @IsArray({ message: 'Los alérgenos deben ser una lista' })
  @IsIn(ALERGENOS_PERMITIDOS, { each: true, message: 'Alérgeno no permitido' })
  alergenos?: string[];

  /** El admin revisó la lista de alérgenos de este producto. */
  @IsOptional()
  @IsBoolean()
  alergenosConfirmados?: boolean;

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

  /**
   * Si es true, los grupos que NO vengan en `grupos` se desligan de este producto
   * (solo el vínculo producto-grupo; el grupo y sus opciones no se tocan).
   */
  @IsOptional()
  @IsBoolean()
  sincronizarGrupos?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaborInputDto)
  sabores?: SaborInputDto[];
}
