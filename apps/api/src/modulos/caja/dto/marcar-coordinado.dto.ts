import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SinVoucherDto } from './cobrar.dto';

/** Pago coordinado: en medio digital, sin foto útil solo con motivo. */
export class MarcarCoordinadoDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => SinVoucherDto)
  sinVoucher?: SinVoucherDto;

  @IsOptional()
  @IsBoolean()
  confirmaSinCaptura?: boolean;
}
