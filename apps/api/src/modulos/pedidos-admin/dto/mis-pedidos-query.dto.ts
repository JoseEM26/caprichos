import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateBy,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

export const RANGOS_MIS_PEDIDOS = ['hoy', 'ayer', '7dias', '30dias', 'todas'] as const;
export type RangoMisPedidos = (typeof RANGOS_MIS_PEDIDOS)[number];

export const ORDENES_MIS_PEDIDOS = ['recientes', 'mas_espera'] as const;
export type OrdenMisPedidos = (typeof ORDENES_MIS_PEDIDOS)[number];

export const ESTADOS_MIS_PEDIDOS = [
  'COLA',
  'PREPARANDO',
  'LISTO',
  'EN_CAMINO',
  'ENTREGADO',
  'ANULADO',
  'RECHAZADO',
  'DEVUELTO',
  'PROGRAMADO',
  'EN_CURSO',
] as const;
export const MODALIDADES_MIS_PEDIDOS = ['MESA', 'LOCAL', 'COMER_LOCAL', 'LLEVAR', 'RECOGER', 'DELIVERY'] as const;
export const PAGO_ESTADOS_MIS_PEDIDOS = ['PENDIENTE', 'COORDINADO', 'PAGADO', 'DEVUELTO', 'CONFIRMADO'] as const;
export const METODOS_MIS_PEDIDOS = ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA', 'MIXTO', 'CREDITO_PERSONAL'] as const;

/** Lista separada por comas en la que cada valor está en `valores` (p. ej. `COLA,LISTO`). */
export function EnLista(valores: readonly string[], opciones?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'enLista',
      constraints: [valores],
      validator: {
        validate: (v: unknown, args: ValidationArguments) =>
          typeof v === 'string' && v.split(',').every((x) => (args.constraints[0] as readonly string[]).includes(x.trim())),
        defaultMessage: (args: ValidationArguments) =>
          `${args.property} debe ser una lista de: ${(args.constraints[0] as readonly string[]).join(', ')}`,
      },
    },
    opciones,
  );
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const MONTO = /^\d{1,7}(\.\d{1,2})?$/;

/** Filtros opcionales de «Mis pedidos». `desde`/`hasta` (día Lima, inclusivos) mandan sobre `rango`. */
export interface FiltrosMisPedidos {
  desde?: string;
  hasta?: string;
  mozo?: string;
  orden?: OrdenMisPedidos;
  /** Estados separados por comas; EN_CURSO agrupa COLA, PREPARANDO, LISTO y EN_CAMINO */
  estado?: string;
  /** Cliente, código o nombre de mesa (sin tildes ni mayúsculas; el guion no cuenta) */
  q?: string;
  modalidad?: string;
  pago?: string;
  metodo?: string;
  montoMin?: string;
  montoMax?: string;
}

export class MisPedidosQueryDto implements FiltrosMisPedidos {
  @IsOptional()
  @IsIn(RANGOS_MIS_PEDIDOS)
  rango?: RangoMisPedidos;

  @IsOptional()
  @Matches(FECHA, { message: 'desde debe ser YYYY-MM-DD' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA, { message: 'hasta debe ser YYYY-MM-DD' })
  hasta?: string;

  @IsOptional()
  @Matches(/^\d+$/, { message: 'mozo debe ser el partyId' })
  mozo?: string;

  @IsOptional()
  @IsIn(ORDENES_MIS_PEDIDOS)
  orden?: OrdenMisPedidos;

  @IsOptional()
  @EnLista(ESTADOS_MIS_PEDIDOS)
  estado?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @IsOptional()
  @EnLista(MODALIDADES_MIS_PEDIDOS)
  modalidad?: string;

  @IsOptional()
  @EnLista(PAGO_ESTADOS_MIS_PEDIDOS)
  pago?: string;

  @IsOptional()
  @EnLista(METODOS_MIS_PEDIDOS)
  metodo?: string;

  @IsOptional()
  @Matches(MONTO, { message: 'montoMin debe ser un monto en soles, p. ej. 12.5' })
  montoMin?: string;

  @IsOptional()
  @Matches(MONTO, { message: 'montoMax debe ser un monto en soles, p. ej. 80' })
  montoMax?: string;
}
