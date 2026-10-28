import { IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SinVoucherDto } from '../../caja/dto/cobrar.dto';

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
}
