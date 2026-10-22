import { IsArray, IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CrearListaDto {
  @IsString({ message: 'El nombre de la lista debe ser texto' })
  @IsNotEmpty({ message: 'El nombre de la lista es requerido' })
  nombre!: string;

  @IsOptional()
  @IsString({ message: 'El código debe ser texto' })
  codigo?: string;
}

export class ActualizarListaDto {
  @IsOptional()
  @IsString({ message: 'El nombre de la lista debe ser texto' })
  nombre?: string;

  @IsOptional()
  @IsString({ message: 'El código debe ser texto' })
  codigo?: string;
}

export class AgregarValorDto {
  @IsString({ message: 'El nombre del valor debe ser texto' })
  @IsNotEmpty({ message: 'El nombre del valor es requerido' })
  nombre!: string;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un entero' })
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ActualizarValorDto {
  @IsOptional()
  @IsString({ message: 'El nombre del valor debe ser texto' })
  nombre?: string;

  @IsOptional()
  @IsInt({ message: 'El orden debe ser un entero' })
  orden?: number;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class AsignarGrupoCategoriasDto {
  @IsArray({ message: 'Las categorías deben enviarse en una lista' })
  categoriaIds!: (string | number)[];
}
