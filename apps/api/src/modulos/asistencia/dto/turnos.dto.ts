import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, MaxLength, Min, MinLength } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CrearTurnoDto {
  @IsIn(['REEMPLAZO', 'CAMBIO_TURNO'], { message: 'Elige reemplazo o cambio de turno' })
  tipo!: 'REEMPLAZO' | 'CAMBIO_TURNO';

  @Type(() => Number)
  @IsInt({ message: 'Elige a la persona' })
  @Min(1)
  reemplazoPartyId!: number;

  @Matches(FECHA, { message: 'La fecha no es válida' })
  fecha!: string;

  @Matches(HORA, { message: 'La hora de inicio no es válida' })
  desde!: string;

  @Matches(HORA, { message: 'La hora de fin no es válida' })
  hasta!: string;

  /** Solo CAMBIO_TURNO: el turno de la otra persona que yo cubro a cambio. */
  @IsOptional()
  @Matches(FECHA, { message: 'La fecha del turno que cubres no es válida' })
  fechaDevolucion?: string;

  @IsOptional()
  @Matches(HORA, { message: 'La hora de inicio no es válida' })
  desdeDevolucion?: string;

  @IsOptional()
  @Matches(HORA, { message: 'La hora de fin no es válida' })
  hastaDevolucion?: string;

  @IsString()
  @MinLength(5, { message: 'Escribe el motivo (mínimo 5 caracteres)' })
  @MaxLength(300)
  motivo!: string;
}

export class CandidatosTurnoDto {
  @Matches(FECHA, { message: 'La fecha no es válida' })
  fecha!: string;

  @Matches(HORA, { message: 'La hora de inicio no es válida' })
  desde!: string;

  @Matches(HORA, { message: 'La hora de fin no es válida' })
  hasta!: string;
}

export class RechazarTurnoDto {
  @IsString()
  @MinLength(5, { message: 'Escribe el motivo (mínimo 5 caracteres)' })
  @MaxLength(300)
  motivo!: string;
}

export class AprobarTurnoDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  nota?: string;
}

export class ListarTurnosDto {
  @IsOptional()
  @IsString()
  @MaxLength(20)
  estado?: string;
}
