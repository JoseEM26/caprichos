import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
