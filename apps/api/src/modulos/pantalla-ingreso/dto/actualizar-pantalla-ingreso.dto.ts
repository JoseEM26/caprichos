import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MAX_IMAGENES_INGRESO, MAX_LONGITUD_FRASE_INGRESO } from '../pantalla-ingreso.constantes';
import { TipoImagenIngreso } from '../pantalla-ingreso.tipos';

export class ImagenIngresoDto {
  @IsIn(['defecto', 'archivo'], { message: 'El tipo de imagen debe ser "defecto" o "archivo"' })
  tipo!: TipoImagenIngreso;

  @IsString({ message: 'El valor de la imagen debe ser texto' })
  @MaxLength(200, { message: 'El valor de la imagen es demasiado largo' })
  valor!: string;
}

export class ActualizarPantallaIngresoDto {
  @IsArray({ message: 'imagenes debe ser una lista' })
  @ArrayMinSize(1, { message: 'Elige al menos una imagen' })
  @ArrayMaxSize(MAX_IMAGENES_INGRESO, { message: `Puedes elegir hasta ${MAX_IMAGENES_INGRESO} imágenes` })
  @ValidateNested({ each: true })
  @Type(() => ImagenIngresoDto)
  imagenes!: ImagenIngresoDto[];

  @IsString({ message: 'La frase debe ser texto' })
  @MaxLength(MAX_LONGITUD_FRASE_INGRESO, {
    message: `La frase no puede superar ${MAX_LONGITUD_FRASE_INGRESO} caracteres`,
  })
  frase!: string;
}
