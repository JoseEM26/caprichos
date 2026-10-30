import { ArrayNotEmpty, IsArray, IsOptional, IsString } from 'class-validator';

export class TomarRutaSugeridaDto {
  @IsArray({ message: 'pedidoIds debe ser un arreglo de identificadores' })
  @ArrayNotEmpty({ message: 'pedidoIds no puede estar vacío' })
  @IsString({ each: true, message: 'Cada identificador debe ser una cadena de texto' })
  pedidoIds!: string[];

  /** Solo Caja/Admin: el repartidor al que se asigna la ruta. El repartidor siempre se asigna a sí mismo. */
  @IsOptional()
  @IsString({ message: 'El identificador del repartidor debe ser texto' })
  repartidorPartyId?: string;
}
