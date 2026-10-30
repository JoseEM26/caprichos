import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class CancelarReservaDto {
  @IsString({ message: 'El motivo es obligatorio' })
  @IsNotEmpty({ message: 'El motivo no puede estar vacío' })
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
  motivo!: string;
}
