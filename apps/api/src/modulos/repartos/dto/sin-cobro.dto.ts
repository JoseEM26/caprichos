import { IsBoolean, IsOptional, IsString } from 'class-validator';

/** Solo el administrador: salir o entregar un delivery sin cobrar, con motivo. */
export class SinCobroDto {
  @IsOptional()
  @IsBoolean()
  forzarSinCobro?: boolean;

  @IsOptional()
  @IsString()
  motivo?: string;
}
