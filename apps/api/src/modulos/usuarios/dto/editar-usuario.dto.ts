import { IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { TIPOS_DOCUMENTO } from '../../acceso/roles-usuario';

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

  /** Solo ADMIN. Tipo del documento de ingreso (por defecto, el actual). */
  @IsOptional()
  @IsIn([...TIPOS_DOCUMENTO], { message: 'El tipo de documento no es válido' })
  tipoDocumento?: string;

  /** Solo ADMIN. Número del documento de ingreso. Reemplaza a `dni` (alias). */
  @IsOptional()
  @IsString()
  documento?: string;

  /** Alias de `documento` (compatibilidad). */
  @IsOptional()
  @IsString()
  dni?: string;

  /** Roles extra: reemplazan el conjunto actual. Vacío = sin roles extra. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  otrosRoles?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'El país de nacimiento es demasiado largo' })
  paisNacimiento?: string;

  /** Cumpleaños: DD/MM o AAAA-MM-DD (solo se guarda día y mes). Vacío lo quita. Solo ADMIN. */
  @IsOptional()
  @IsString()
  cumpleanos?: string;

  /** Solo ADMIN. Celular de 9 dígitos (con o sin +51): queda como contacto activo y da el descuento de personal en la carta. */
  @IsOptional()
  @IsString()
  celular?: string;

  /** Vacío quita el correo. */
  @IsOptional()
  @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'El correo no tiene un formato válido' })
  correo?: string;

  /** Solo ADMIN. Recibe los avisos del sistema por correo (exige correo). */
  @IsOptional()
  @IsBoolean()
  avisosCorreo?: boolean;

  /** Solo ADMIN. Disponible 24/7 (recibe avisos si nadie con casilla está de turno). */
  @IsOptional()
  @IsBoolean()
  horario24_7?: boolean;

  /** Obligatoria (solo ADMIN) cuando cambia el DNI: contraseña del administrador que opera. */
  @IsOptional()
  @IsString()
  claveAdmin?: string;
}
