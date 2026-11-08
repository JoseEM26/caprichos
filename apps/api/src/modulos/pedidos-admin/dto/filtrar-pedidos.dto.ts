import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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

  /** '1': agrega `resumen` (conteo por estado y cobro de todo el filtro, en una sola consulta agrupada). */
  @IsOptional()
  @IsIn(['1'])
  resumen?: string;

  /** Página (desde 1). Con el límite de abajo, «Cargar más» de Caja pide la siguiente hasta cubrir `total`. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  pagina?: number;

  /** Pedidos por página: 1 a 100 (por defecto 20). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number;
}
