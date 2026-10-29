import { IsIn, IsOptional, IsString } from 'class-validator';

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

  /** '1': pedidos de días anteriores aún en curso o con pago pendiente (ignora desde/hasta). */
  @IsOptional()
  @IsIn(['1'])
  pendientes?: string;

  @IsOptional()
  pagina?: number | string;

  @IsOptional()
  limite?: number | string;
}
