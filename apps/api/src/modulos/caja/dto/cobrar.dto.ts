import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
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

/** Excepción a la foto del comprobante: solo Caja/Admin, con motivo escrito y código rotativo del supervisor. */
export class SinVoucherDto {
  @IsString({ message: 'El motivo debe ser texto' })
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
  motivo!: string;

  @IsString({ message: 'El código del supervisor es requerido' })
  @Matches(/^\d{6}$/, { message: 'El código del supervisor son 6 dígitos' })
  pinSupervisor!: string;
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

  /** Cobro digital sin foto: solo con motivo y código de supervisor (queda auditado). */
  @IsOptional()
  @ValidateNested()
  @Type(() => SinVoucherDto)
  sinVoucher?: SinVoucherDto;
}
