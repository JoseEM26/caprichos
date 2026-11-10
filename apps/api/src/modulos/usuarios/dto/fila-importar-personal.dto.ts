import { IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { TIPOS_DOCUMENTO } from '../../acceso/roles-usuario';
import { ACUERDOS_LABORALES, AcuerdoLaboral } from '../importar-planilla.util';

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

  // --- Planilla (opcionales; ver docs/operacion/importar-personal-columnas.md) ---

  /** Área del Excel (informativa; va a la nota del vínculo). */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  area?: string;

  @IsOptional()
  @IsIn([...ACUERDOS_LABORALES], { message: 'El acuerdo laboral no es válido' })
  acuerdoLaboral?: AcuerdoLaboral;

  @IsOptional()
  @IsNumber({}, { message: 'El sueldo mensual debe ser un número' })
  @Min(0)
  @Max(1_000_000)
  sueldoMensual?: number;

  @IsOptional()
  @IsNumber({}, { message: 'La tarifa por hora debe ser un número' })
  @Min(0.01)
  @Max(10_000)
  tarifaHora?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  diasMes?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(24)
  horasDia?: number;

  /** Celular de Yape/Plin (dato personal: no se imprime). */
  @IsOptional()
  @Matches(/^\+?\d{9,15}$/, { message: 'El celular de pago no es válido' })
  pagoCelular?: string;

  @IsOptional()
  @IsIn(['YAPE', 'PLIN', 'TRANSFERENCIA', 'EFECTIVO'], { message: 'El medio de pago no es válido' })
  pagoMedio?: string;

  /** Nombres de áreas de cocina (Bebidas, Salado, Postres, Repostería...). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  areasCocina?: string[];
}
