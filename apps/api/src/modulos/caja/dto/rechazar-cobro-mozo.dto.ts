import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RechazarCobroMozoDto {
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo es requerido' })
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
  motivo!: string;
}
