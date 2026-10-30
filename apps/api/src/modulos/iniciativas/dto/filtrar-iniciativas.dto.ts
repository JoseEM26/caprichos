import { IsOptional, IsString } from 'class-validator';

export class FiltrarIniciativasDto {
  @IsOptional()
  @IsString()
  busqueda?: string;

  @IsOptional()
  @IsString()
  tipo?: string;

  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  soloMias?: boolean | string;
}
