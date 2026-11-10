import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class SueldoDto {
  @IsIn(['SEMANAL', 'MENSUAL']) modalidad!: 'SEMANAL' | 'MENSUAL';
  /** Monto de la modalidad elegida; el otro se calcula (semanal = mensual×12/52). */
  @Type(() => Number) @IsNumber() @Min(0) @Max(1_000_000) monto!: number;
}

export class PlanillaFechaDto {
  /** Cualquier día del período; vacío = hoy. */
  @IsOptional() @Matches(FECHA) fecha?: string;
  /** Ids de consumos que pasan al siguiente período, separados por coma. */
  @IsOptional() @IsString() @MaxLength(2000) excluir?: string;
}

export class PagarPlanillaDto {
  @Type(() => Number) @IsInt() @Min(1) partyId!: number;
  @Matches(FECHA) fecha!: string;
  @IsOptional() @IsString({ each: true }) excluirConsumoIds?: string[];
}

export class ReabrirPlanillaDto {
  @IsString() @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' }) @MaxLength(300) motivo!: string;
}

export class AjusteDto {
  @Type(() => Number) @IsInt() @Min(1) partyId!: number;
  @Matches(FECHA) fecha!: string;
  @Type(() => Number) @IsNumber() @Min(0.01) @Max(1_000_000) monto!: number;
  @IsString() @MinLength(3) @MaxLength(300) motivo!: string;
}

export class AnularAjusteDto {
  @IsString() @MinLength(3) @MaxLength(300) motivo!: string;
}

export class ExtraDto {
  @Type(() => Number) @IsInt() @Min(1) partyId!: number;
  @Matches(FECHA) jornada!: string;
  @IsBoolean() aprobada!: boolean;
}

export class VinculoDto {
  @IsIn(['PLANILLA', 'CONTRATO_TEMPORAL']) tipo!: 'PLANILLA' | 'CONTRATO_TEMPORAL';
  @Matches(FECHA) fechaIngreso!: string;
  /** Solo contrato temporal. */
  @IsOptional() @Matches(FECHA) fechaFin?: string | null;
  /** Solo planilla: 30 o 15 días al año (por defecto 30). */
  @IsOptional() @Type(() => Number) @IsIn([30, 15]) regimenVacaciones?: 30 | 15;
  @IsOptional() @IsString() @MaxLength(500) notas?: string;
}

export class VacacionMovimientoDto {
  @Type(() => Number) @IsInt() @Min(1) partyId!: number;
  @IsIn(['TOMADAS', 'PAGADAS', 'AJUSTE']) tipo!: 'TOMADAS' | 'PAGADAS' | 'AJUSTE';
  /** TOMADAS: inicio del rango. PAGADAS y AJUSTE: la fecha del movimiento (en PAGADAS fija el período de planilla). */
  @Matches(FECHA) desde!: string;
  /** Solo TOMADAS (fin del rango, inclusive). */
  @IsOptional() @Matches(FECHA) hasta?: string;
  /** PAGADAS (positivo) y AJUSTE (con signo). En TOMADAS se calcula con su horario. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-365) @Max(365) dias?: number;
  /** Solo PAGADAS. */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0.01) @Max(1_000_000) monto?: number;
  @IsOptional() @IsString() @MaxLength(300) motivo?: string;
}
