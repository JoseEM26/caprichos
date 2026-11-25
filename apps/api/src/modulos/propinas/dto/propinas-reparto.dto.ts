import { IsBoolean, IsOptional } from 'class-validator';

export class ParticipacionDto {
  /** true/false = forzado por el ADMIN; sin valor (null) = según el rol. */
  @IsOptional()
  @IsBoolean()
  participa?: boolean;
}
