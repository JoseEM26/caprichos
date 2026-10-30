import { IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CrearCategoriaDto {
  @IsString({ message: 'El nombre de la categoría debe ser texto' })
  @IsNotEmpty({ message: 'El nombre de la categoría es requerido' })
  nombre!: string;

  @IsNotEmpty({ message: 'El área de cocina es requerida' })
  areaId!: string | number;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un entero' })
  orden?: number;

  @IsOptional()
  @IsBoolean()
  llevaOpciones?: boolean;

  @IsOptional()
  @IsBoolean()
  oculta?: boolean;
}

export class ActualizarCategoriaDto {
  @IsOptional()
  @IsString({ message: 'El nombre de la categoría debe ser texto' })
  nombre?: string;

  @IsOptional()
  areaId?: string | number;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un entero' })
  orden?: number;

  @IsOptional()
  @IsBoolean()
  llevaOpciones?: boolean;

  @IsOptional()
  @IsBoolean()
  oculta?: boolean;
}
