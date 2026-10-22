import { IsOptional, IsString } from 'class-validator';

export class FiltrarRepartosDto {
  @IsOptional()
  @IsString()
  repartidor?: string;

  @IsOptional()
  @IsString()
  estado?: string;
}
