import {
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PagoItemDto {
  @IsString({ message: 'El medio de pago debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El medio de pago es requerido' })
  medio!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El monto debe ser un número válido' })
  @Min(0.01, { message: 'El monto debe ser mayor a 0' })
  monto!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El monto recibido debe ser un número válido' })
  @Min(0, { message: 'El monto recibido no puede ser negativo' })
  recibido?: number;
}

/** Excepción a la foto del comprobante: solo con motivo escrito (queda auditada). */
export class SinVoucherDto {
  @IsString({ message: 'El motivo debe ser texto' })
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
  motivo!: string;
}

export class CobrarDto {
  @IsNotEmpty({ message: 'El ID del pedido es requerido' })
  pedidoId!: string | number;

  @IsArray({ message: 'Los pagos deben ser una lista' })
  @ArrayMinSize(1, { message: 'Debe ingresar al menos un pago' })
  @ValidateNested({ each: true })
  @Type(() => PagoItemDto)
  pagos!: PagoItemDto[];

  /** Foto ya subida (POST /admin/vouchers). Se enlaza al pedido como prueba del cobro. */
  @IsOptional()
  voucherId?: string | number;

  /** Cobro digital sin foto: solo con motivo (queda auditado). */
  @IsOptional()
  @ValidateNested()
  @Type(() => SinVoucherDto)
  sinVoucher?: SinVoucherDto;

  /** Casilla «ya hablé con el cliente y pagó» (local, sin captura): sin motivo ni supervisor. */
  @IsOptional()
  @IsBoolean()
  confirmaSinCaptura?: boolean;

  /** Propina (monto libre, aparte de la venta) escrita al cobrar un pedido que aún no la tiene. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'La propina debe ser un monto con hasta 2 decimales' })
  @Min(0, { message: 'La propina no puede ser negativa' })
  propina?: number;
}
