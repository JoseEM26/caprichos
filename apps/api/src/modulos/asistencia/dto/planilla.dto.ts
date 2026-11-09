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
