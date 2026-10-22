import { IsOptional, IsString } from 'class-validator';

export class HistorialQueryDto {
  @IsOptional()
  @IsString()
  area?: string;
}
