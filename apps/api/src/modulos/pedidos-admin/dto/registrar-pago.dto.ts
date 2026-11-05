import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SinVoucherDto } from '../../caja/dto/cobrar.dto';

/** Código de operación que Caja lee o teclea del voucher, por medio digital (en plan mixto, uno por parte). */
export class CodigoOperacionDto {
  @IsString()
  @IsNotEmpty({ message: 'El medio del código de operación es requerido' })
  medio!: string;

  @IsString({ message: 'El código de operación debe ser texto' })
  @MaxLength(64, { message: 'El código de operación es demasiado largo' })
  codigo!: string;
}

export class RegistrarPagoDto {
  @IsString()
  @IsNotEmpty({ message: 'El método de pago es requerido' })
  metodo!: string;

  @IsString()
  @IsIn(['COORDINADO', 'PAGADO'], {
    message: 'El estado del pago debe ser COORDINADO o PAGADO',
  })
  estado!: 'COORDINADO' | 'PAGADO';

  /** Excepción a la foto del comprobante (Yape, Plin, transferencia): motivo y código del supervisor. */
  @IsOptional()
  @ValidateNested()
  @Type(() => SinVoucherDto)
  sinVoucher?: SinVoucherDto;

  /** Obligatorio por cada medio digital (Yape, Plin, transferencia, tarjeta) y ninguno en efectivo. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CodigoOperacionDto)
  codigosOperacion?: CodigoOperacionDto[];
}
