import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LiberarMesaDto {
  @IsString({ message: 'El motivo debe ser un texto' })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
  motivo!: string;
}
