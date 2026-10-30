import { IsNotEmpty, IsString } from 'class-validator';

export class CambiarClaveUsuarioDto {
  @IsString({ message: 'La contraseña nueva debe ser un texto' })
  @IsNotEmpty({ message: 'La contraseña nueva es requerida' })
  claveNueva!: string;

  @IsString({ message: 'Escribe tu contraseña de administrador' })
  @IsNotEmpty({ message: 'Escribe tu contraseña de administrador' })
  claveAdmin!: string;
}
