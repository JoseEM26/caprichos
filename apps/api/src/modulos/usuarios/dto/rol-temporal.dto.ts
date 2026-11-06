import { IsDateString, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class OtorgarRolExtraDto {
  @IsString()
  @IsNotEmpty({ message: 'Indica el rol que se otorga' })
  rol!: string;

  /** Motivo opcional (p. ej. «el supervisor titular no viene hoy»). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;

  /** Hasta cuándo vale (ISO con hora). Sin fecha = hasta que el ADMIN lo quite. */
  @IsOptional()
  @IsDateString({}, { message: 'La fecha de fin no es válida' })
  hasta?: string;
}
