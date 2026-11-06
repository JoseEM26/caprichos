import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { MEDIOS_COBRO } from '../../caja/caja.calculo';

export class LiquidarAjusteUbicacionDto {
  @IsIn(MEDIOS_COBRO, { message: 'Medio de pago no válido' })
  medio!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  codigoOperacion?: string;
}
