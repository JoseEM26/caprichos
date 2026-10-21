import { IsOptional, IsString } from 'class-validator';

export class FiltrarPedidosDto {
  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  canal?: string;

  @IsOptional()
  @IsString()
  modalidad?: string;

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;

  @IsOptional()
  @IsString()
  buscar?: string;

  @IsOptional()
  pagina?: number | string;

  @IsOptional()
  limite?: number | string;
}
