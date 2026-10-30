import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class AnularMovimientoDto {
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo es requerido' })
  @MinLength(3, { message: 'El motivo debe tener al menos 3 caracteres' })
  motivo!: string;
}
