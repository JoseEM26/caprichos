import { ArrayMaxSize, IsArray, IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MEDIOS_PAGO_PROPINA } from '../propinas-reparto.util';

export class PagarRepartoDto {
  @IsIn([...MEDIOS_PAGO_PROPINA], { message: 'Medio de pago no válido' })
  medio!: string;

  /** Fecha del pago (ISO). Si no se indica, ahora. */
  @IsOptional()
  @IsDateString()
  fecha?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;

  /** Personas a pagar. Sin lista = todas las pendientes del reparto. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsInt({ each: true })
  partyIds?: number[];
}

export class AnularRepartoDto {
  @IsString()
  @MinLength(5, { message: 'Escribe el motivo (mínimo 5 caracteres)' })
  @MaxLength(300)
  motivo!: string;
}

export class ParticipacionDto {
  /** true/false = forzado por el ADMIN; sin valor (null) = según el rol. */
  @IsOptional()
  @IsBoolean()
  participa?: boolean;
}
