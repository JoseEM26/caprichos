import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Matches, Min } from 'class-validator';

export class FiltrarUsuariosDto {
  @IsOptional()
  @IsString()
  rol?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsString()
  busqueda?: string;

  /** Alta: hoy | 7 | 30 | ano | mas90. */
  @IsOptional()
  @IsString()
  creado?: string;

  /** Último acceso: hoy | 7 | 30 | mas30 | nunca. */
  @IsOptional()
  @IsString()
  acceso?: string;

  /** Alta entre estas fechas (YYYY-MM-DD, calendario de Lima). */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  desde?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limite?: number = 20;
}
