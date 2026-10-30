import { IsOptional, IsString } from 'class-validator';

export class CocinaQueryDto {
  @IsOptional()
  @IsString()
  historial?: string;
}
