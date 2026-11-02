import { IsArray, IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { TIPOS_DOCUMENTO } from '../../acceso/roles-usuario';

/** Una fila de «Importar personal». Se valida dentro del servicio, fila por fila. */
export class FilaImportarPersonalDto {
  @IsString()
  @MaxLength(60, { message: 'Los nombres son demasiado largos' })
  nombres!: string;

  @IsString()
  @MaxLength(60, { message: 'Los apellidos son demasiado largos' })
  apellidos!: string;

  @IsOptional()
  @IsIn([...TIPOS_DOCUMENTO], { message: 'El tipo de documento no es válido' })
  tipoDocumento?: string;

  @IsString()
  documento!: string;

  @IsString()
  rol!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  otrosRoles?: string[];

  @IsOptional()
  @Matches(/^9\d{8}$/, { message: 'El celular debe tener 9 dígitos y empezar en 9' })
  celular?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  correo?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de nacimiento debe ser AAAA-MM-DD' })
  fechaNacimiento?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de ingreso debe ser AAAA-MM-DD' })
  fechaIngreso?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de reingreso debe ser AAAA-MM-DD' })
  fechaReingreso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  paisNacimiento?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
