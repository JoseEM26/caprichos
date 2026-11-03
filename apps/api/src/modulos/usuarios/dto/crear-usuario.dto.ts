import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { TIPOS_DOCUMENTO } from '../../acceso/roles-usuario';
import { ConfigurarHorarioDto } from './horario.dto';

export class CrearUsuarioDto extends ConfigurarHorarioDto {
  @IsString()
  @IsNotEmpty({ message: 'Los nombres son requeridos' })
  nombres!: string;

  @IsString()
  @IsNotEmpty({ message: 'Los apellidos son requeridos' })
  apellidos!: string;

  /** DNI (por defecto), CE, CEDULA o PASAPORTE. La validación del número la hace el servicio. */
  @IsOptional()
  @IsIn([...TIPOS_DOCUMENTO], { message: 'El tipo de documento no es válido' })
  tipoDocumento?: string;

  /** Número del documento. Reemplaza a `dni` (que se acepta como alias). */
  @IsOptional()
  @IsString()
  documento?: string;

  /** Alias de `documento` (compatibilidad). */
  @IsOptional()
  @IsString()
  dni?: string;

  /** Rol principal. */
  @IsString()
  @IsNotEmpty({ message: 'El rol es requerido' })
  rol!: string;

  /** Roles extra (la persona tiene también estos puestos). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  otrosRoles?: string[];

  /** Inicio del primer periodo trabajado (AAAA-MM-DD). Sin fecha, abre hoy. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de ingreso debe ser AAAA-MM-DD' })
  fechaIngreso?: string;

  /** Vuelta a trabajar (AAAA-MM-DD): si se indica, el ingreso queda cerrado el día anterior y abre un periodo nuevo. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de reingreso debe ser AAAA-MM-DD' })
  fechaReingreso?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80, { message: 'El país de nacimiento es demasiado largo' })
  paisNacimiento?: string;

  /** Por defecto activo. */
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @Matches(/^9\d{8}$/, { message: 'El celular debe tener 9 dígitos y empezar en 9' })
  celular?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  correo?: string;

  /** Recibe los avisos del sistema por correo. Por defecto: ADMIN y SUPERVISOR con correo. Exige correo. */
  @IsOptional()
  @IsBoolean()
  avisosCorreo?: boolean;

  /** Disponible 24/7 (recibe avisos si nadie con casilla está de turno). Por defecto: ADMIN. */
  @IsOptional()
  @IsBoolean()
  horario24_7?: boolean;

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
