import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CambiarMesaDto {
  @IsString({ message: 'mesaId debe ser un texto' })
  @IsNotEmpty({ message: 'La mesa destino es obligatoria' })
  @Matches(/^\d+$/, { message: 'mesaId debe ser un id numérico' })
  mesaId!: string;
}
