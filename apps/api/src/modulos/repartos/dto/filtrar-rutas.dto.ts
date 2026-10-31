import { IsOptional, IsString, Matches } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Filtros de GET /admin/repartos/mis-rutas y /admin/repartos/rutas (fechas en hora de Lima). */
export class FiltrarRutasDto {
  @IsOptional()
  @Matches(FECHA, { message: 'desde debe ser YYYY-MM-DD' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA, { message: 'hasta debe ser YYYY-MM-DD' })
  hasta?: string;

  /** Solo para caja/admin: party_id del repartidor. */
  @IsOptional()
  @IsString()
  repartidor?: string;

  @IsOptional()
  @Matches(/^\d+$/, { message: 'pagina debe ser un número' })
  pagina?: string;
}
