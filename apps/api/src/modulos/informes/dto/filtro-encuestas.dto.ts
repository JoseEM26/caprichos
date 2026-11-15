import { Type } from 'class-transformer';
import { MODALIDADES_INDICADORES, CANALES_INDICADORES } from './filtro-indicadores.dto';
import { IsIn, IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export class FiltroEncuestasDto {
  @IsOptional()
  @Matches(FECHA_ISO, { message: 'desde debe ser YYYY-MM-DD' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA_ISO, { message: 'hasta debe ser YYYY-MM-DD' })
  hasta?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  puntaje?: number;

  @IsOptional()
  @IsIn(MODALIDADES_INDICADORES)
  modalidad?: string;

  @IsOptional()
  @IsIn(CANALES_INDICADORES)
  canal?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limite?: number;
}
