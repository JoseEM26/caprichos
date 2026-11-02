import { IsOptional, Matches } from 'class-validator';

export class EditarPeriodoDto {
  /** Inicio del periodo (AAAA-MM-DD). */
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de ingreso debe ser AAAA-MM-DD' })
  desde!: string;

  /** Salida (AAAA-MM-DD). Vacío o null = el periodo sigue abierto. */
  @IsOptional()
  @Matches(/^$|^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de salida debe ser AAAA-MM-DD' })
  hasta?: string | null;
}
