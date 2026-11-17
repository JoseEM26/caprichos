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

  /** '1': auditoría de pagos en línea que nunca se pagaron (POR_PAGAR y vencidos sin pago). Sin él, Caja no los ve. */
  @IsOptional()
  @IsIn(['1'])
  abandonadosEnLinea?: string;

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

  /** '1': solo pedidos PROGRAMADO («Programados / encargos»), por fecha pactada; ignora pendientes y desde/hasta. */
  @IsOptional()
  @IsIn(['1'])
  programados?: string;

  /** Con programados=1: fecha de entrega desde/hasta (YYYY-MM-DD de Lima). Sin ellas, desde hoy en adelante. */
  @IsOptional()
  @IsString()
  entregaDesde?: string;

  @IsOptional()
  @IsString()
  entregaHasta?: string;

  /** Medios de pago (uno o varios separados por coma): YAPE,PLIN,TARJETA,EFECTIVO,TRANSFERENCIA, y CULQI (pagado por la pasarela). */
  @IsOptional()
  @Matches(/^(YAPE|PLIN|TARJETA|EFECTIVO|TRANSFERENCIA|CULQI)(,(YAPE|PLIN|TARJETA|EFECTIVO|TRANSFERENCIA|CULQI))*$/, {
    message: 'medios no válido',
  })
  medios?: string;
}
