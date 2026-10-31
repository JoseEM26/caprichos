import { ArrayMaxSize, ArrayNotEmpty, ArrayUnique, IsArray, IsString, Matches } from 'class-validator';

export class TomarRutaDto {
  @IsArray({ message: 'ids debe ser un arreglo de identificadores' })
  @ArrayNotEmpty({ message: 'ids no puede estar vacío' })
  @ArrayMaxSize(50, { message: 'Demasiados pedidos en la ruta' })
  @ArrayUnique({ message: 'ids no puede repetir pedidos' })
  @IsString({ each: true, message: 'Cada identificador debe ser texto' })
  @Matches(/^\d+$/, { each: true, message: 'Cada identificador debe ser numérico' })
  ids!: string[];
}
