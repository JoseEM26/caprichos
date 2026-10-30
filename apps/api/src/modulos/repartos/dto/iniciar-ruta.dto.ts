import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class IniciarRutaDto {
  @IsArray({ message: 'pedidoIds debe ser un arreglo de identificadores' })
  @ArrayNotEmpty({ message: 'pedidoIds no puede estar vacío' })
  @IsString({ each: true, message: 'Cada identificador debe ser una cadena de texto' })
  pedidoIds!: string[];
}
