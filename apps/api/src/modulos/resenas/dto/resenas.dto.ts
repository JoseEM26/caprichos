import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsNumber, IsOptional, IsString, IsUrl, Length, Matches, MaxLength } from 'class-validator';

export class BuscarNegocioDto {
  @IsString()
  @Length(3, 120, { message: 'Escribe al menos 3 letras del nombre de tu local' })
  consulta!: string;
}

export class GuardarNegocioDto {
  @IsString()
  @Length(1, 60)
  businessId!: string;

  @IsString()
  @MaxLength(200)
  nombre!: string;

  @IsOptional()
  @IsNumber()
  rating?: number;

  @IsOptional()
  @IsNumber()
  total?: number;

  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true }, { message: 'El enlace del local debe ser una URL https' })
  @MaxLength(500)
  enlaceLocal?: string;
}

export class CargaInicialDto {
  @IsOptional()
  @IsBoolean()
  repetir?: boolean;
}

export class VisibleResenaDto {
  @IsBoolean({ message: 'visible debe ser verdadero o falso' })
  visible!: boolean;
}

/** Cambio de visibilidad en lote: hasta 200 reseñas por vez (la lista del admin trae como máximo 200). */
export class VisibleLoteDto {
  @IsArray({ message: 'ids debe ser una lista de reseñas' })
  @ArrayMinSize(1, { message: 'Elige al menos una reseña' })
  @ArrayMaxSize(200, { message: 'Máximo 200 reseñas por vez' })
  @IsString({ each: true })
  @Matches(/^\d+$/, { each: true, message: 'Reseña no válida' })
  ids!: string[];

  @IsBoolean({ message: 'visible debe ser verdadero o falso' })
  visible!: boolean;
}
