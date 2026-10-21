import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class CrearUsuarioDto {
  @IsString()
  @IsNotEmpty({ message: 'Los nombres son requeridos' })
  nombres!: string;

  @IsString()
  @IsNotEmpty({ message: 'Los apellidos son requeridos' })
  apellidos!: string;

  @IsString()
  @Matches(/^\d{8}$/, { message: 'El DNI debe tener exactamente 8 dígitos' })
  dni!: string;

  @IsString()
  @IsNotEmpty({ message: 'El rol es requerido' })
  rol!: string;
}
