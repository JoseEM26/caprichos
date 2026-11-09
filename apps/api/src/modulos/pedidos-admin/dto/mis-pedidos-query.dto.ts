import { IsIn, IsOptional, Matches } from 'class-validator';

export const RANGOS_MIS_PEDIDOS = ['hoy', 'ayer', '7dias', '30dias', 'todas'] as const;
export type RangoMisPedidos = (typeof RANGOS_MIS_PEDIDOS)[number];

export const ORDENES_MIS_PEDIDOS = ['recientes', 'mas_espera'] as const;
export type OrdenMisPedidos = (typeof ORDENES_MIS_PEDIDOS)[number];

export const ESTADOS_MIS_PEDIDOS = ['COLA', 'PREPARANDO', 'LISTO', 'ENTREGADO', 'ANULADO', 'EN_CURSO'] as const;

/** Filtros opcionales de «Mis pedidos». `desde`/`hasta` (día Lima, inclusivos) mandan sobre `rango`. */
export interface FiltrosMisPedidos {
  desde?: string;
  hasta?: string;
  mozo?: string;
  orden?: OrdenMisPedidos;
  estado?: (typeof ESTADOS_MIS_PEDIDOS)[number];
}

export class MisPedidosQueryDto implements FiltrosMisPedidos {
  @IsOptional()
  @IsIn(RANGOS_MIS_PEDIDOS)
  rango?: RangoMisPedidos;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'desde debe ser YYYY-MM-DD' })
  desde?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'hasta debe ser YYYY-MM-DD' })
  hasta?: string;

  @IsOptional()
  @Matches(/^\d+$/, { message: 'mozo debe ser el partyId' })
  mozo?: string;

  @IsOptional()
  @IsIn(ORDENES_MIS_PEDIDOS)
  orden?: OrdenMisPedidos;

  @IsOptional()
  @IsIn(ESTADOS_MIS_PEDIDOS)
  estado?: (typeof ESTADOS_MIS_PEDIDOS)[number];
}
