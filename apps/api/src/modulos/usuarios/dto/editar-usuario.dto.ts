import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class EditarUsuarioDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'Los nombres no pueden estar vacíos' })
  nombres?: string;

  @IsOptional()
  @IsString()
  apellidos?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'El rol no puede estar vacío' })
  rol?: string;
}
