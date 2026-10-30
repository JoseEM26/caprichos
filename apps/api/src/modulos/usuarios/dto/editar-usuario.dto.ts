import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

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

  /** Solo ADMIN. Es el usuario de ingreso. */
  @IsOptional()
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener exactamente 8 dígitos' })
  dni?: string;

  /** Vacío quita el correo. */
  @IsOptional()
  @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'El correo no tiene un formato válido' })
  correo?: string;

  /** Obligatoria (solo ADMIN) cuando cambia el DNI: contraseña del administrador que opera. */
  @IsOptional()
  @IsString()
  claveAdmin?: string;
}
