import { IsOptional, Matches } from 'class-validator';

export class ReactivarUsuarioDto {
  /** Fecha de reingreso (AAAA-MM-DD). Por defecto hoy. Abre un periodo nuevo. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de reingreso debe ser AAAA-MM-DD' })
  fechaReingreso?: string;
}
