import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';

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

  /** Pedidos por página: 1 a 100 (por defecto 20) o 'todas' (tope de 2000 en el servidor). */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value))
  @ValidateIf((o) => o.limite !== 'todas')
  @IsInt()
  @Min(1)
  @Max(100)
  limite?: number | 'todas';

  /** Medios de pago (uno o varios separados por coma): YAPE,PLIN,TARJETA,EFECTIVO,TRANSFERENCIA. */
  @IsOptional()
  @Matches(/^(YAPE|PLIN|TARJETA|EFECTIVO|TRANSFERENCIA)(,(YAPE|PLIN|TARJETA|EFECTIVO|TRANSFERENCIA))*$/, {
    message: 'medios no válido',
  })
  medios?: string;
}
