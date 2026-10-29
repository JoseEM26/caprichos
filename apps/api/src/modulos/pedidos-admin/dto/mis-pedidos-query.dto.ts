import { IsIn, IsOptional } from 'class-validator';

export const RANGOS_MIS_PEDIDOS = ['hoy', 'ayer', '7dias'] as const;
export type RangoMisPedidos = (typeof RANGOS_MIS_PEDIDOS)[number];

export class MisPedidosQueryDto {
  @IsOptional()
  @IsIn(RANGOS_MIS_PEDIDOS)
  rango?: RangoMisPedidos;
}
