import { IsBoolean, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CambiarEstadoDto {
  @IsString()
  @IsNotEmpty({ message: 'El estado es requerido' })
  estado!: string;

  @IsOptional()
  @IsString()
  motivo?: string;

  /** Solo el administrador: pasa el pedido aunque Cocina no haya despejado (exige `motivo`). */
  @IsOptional()
  @IsBoolean()
  forzar?: boolean;

  /** Solo el administrador: entrega o despacha aunque el pedido no esté cobrado (exige `motivo`). */
  @IsOptional()
  @IsBoolean()
  forzarSinCobro?: boolean;

  /** Al anular con el control de almacén encendido: MERMA (se llegó a preparar; defecto) o DEVOLVER los insumos a Cocina. */
  @IsOptional()
  @IsIn(['MERMA', 'DEVOLVER'])
  consumoAlmacen?: 'MERMA' | 'DEVOLVER';

  /** Anular un pedido ya pagado: obliga a elegir qué pasa con el dinero (DEVOLVER lo devuelve al cliente; REPROGRAMAR no anula). */
  @IsOptional()
  @IsIn(['DEVOLVER', 'REPROGRAMAR'])
  destinoDinero?: 'DEVOLVER' | 'REPROGRAMAR';

  /** Con DEVOLVER: medio de la devolución, monto devuelto y código de operación (no efectivo). */
  @IsOptional()
  @IsIn(['EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'])
  devolucionMedio?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  devolucionMonto?: number;

  @IsOptional()
  @IsString()
  devolucionCodigo?: string;

  /** Al anular un pedido programado con adelanto: DEVUELVE (egreso de la caja de hoy si es efectivo, o registro del medio). Para reprogramar se usa POST :id/reprogramar. */
  @IsOptional()
  @IsIn(['DEVUELVE'])
  adelanto?: 'DEVUELVE';
}
