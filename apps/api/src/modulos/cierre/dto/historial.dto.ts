import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, Max, Min } from 'class-validator';

export class HistorialCierresDto {
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

  @IsOptional()
  @IsDateString({}, { message: 'La fecha desde debe tener formato AAAA-MM-DD' })
  desde?: string;

  @IsOptional()
  @IsDateString({}, { message: 'La fecha hasta debe tener formato AAAA-MM-DD' })
  hasta?: string;
}
