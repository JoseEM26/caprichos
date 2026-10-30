import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class MarcarEmitidoDto {
  @IsString({ message: 'referenciaExterna debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'referenciaExterna es requerida' })
  @MinLength(3, { message: 'referenciaExterna debe tener al menos 3 caracteres' })
  referenciaExterna!: string;
}
