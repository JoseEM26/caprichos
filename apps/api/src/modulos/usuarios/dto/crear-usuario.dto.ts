import {
  IsEmail,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ConfigurarHorarioDto } from './horario.dto';

export class CrearUsuarioDto extends ConfigurarHorarioDto {
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

  @IsOptional()
  @Matches(/^9\d{8}$/, { message: 'El celular debe tener 9 dígitos y empezar en 9' })
  celular?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  correo?: string;

  /** AAAA-MM-DD. Solo se guarda día y mes (cumpleaños). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de nacimiento debe ser AAAA-MM-DD' })
  fechaNacimiento?: string;

  /** Descuento de personal en %. Si viene, se crea el rol TRABAJADOR con su detalle. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  descuentoPct?: number;
}
