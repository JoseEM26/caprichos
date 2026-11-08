import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';

export class PermisoExtraDto {
  @IsString() @IsNotEmpty({ message: 'Indica el módulo' }) @MaxLength(40)
  modulo!: string;

  @IsString() @IsNotEmpty({ message: 'Indica la acción' }) @MaxLength(40)
  accion!: string;

  /** Hasta cuándo vale (ISO). Sin fecha = hasta que el ADMIN lo quite. Máximo 1 año. */
  @IsOptional() @IsDateString({}, { message: 'La fecha de fin no es válida' })
  venceEn?: string | null;

  @IsOptional() @IsString() @MaxLength(200)
  nota?: string | null;
}

export class PermisosExtraDto {
  @IsArray() @ArrayMaxSize(300) @ValidateNested({ each: true }) @Type(() => PermisoExtraDto)
  permisos!: PermisoExtraDto[];

  /** Confirmación fuerte: obligatoria si se otorga algún permiso sensible (gestión de personas, dinero, configuración, facturación). */
  @IsOptional() @IsBoolean()
  confirmacionFuerte?: boolean;
}
