import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class FiltrarReclamosDto {
  @IsOptional()
  @IsIn(['RECIBIDO', 'EN_REVISION', 'RESPONDIDO'], {
    message: 'El estado debe ser RECIBIDO, EN_REVISION o RESPONDIDO',
  })
  estado?: string;

  @IsOptional()
  @IsIn(['RECLAMO', 'QUEJA'], {
    message: 'El tipo debe ser RECLAMO o QUEJA',
  })
  tipo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  buscar?: string;

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
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
  @Max(100)
  limite?: number = 20;
}
