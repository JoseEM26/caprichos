import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class IngresarDto {
  @IsString({ message: 'El DNI debe ser un texto' })
  @IsNotEmpty({ message: 'El DNI es requerido' })
  dni!: string;

  @IsString({ message: 'La contraseña debe ser un texto' })
  @IsNotEmpty({ message: 'La contraseña es requerida' })
  contrasena!: string;
}

export class CambiarContrasenaDto {
  @IsString({ message: 'La contraseña actual debe ser un texto' })
  @IsNotEmpty({ message: 'La contraseña actual es requerida' })
  contrasenaActual!: string;

  @IsString({ message: 'La nueva contraseña debe ser un texto' })
  @MinLength(8, { message: 'La nueva contraseña debe tener mínimo 8 caracteres' })
  contrasenaNueva!: string;
}
