import { Type } from 'class-transformer';
import { IsNumber, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { ConteoDenominacionesDto, MediosVistosDto } from './arqueo.dto';

export class CerrarCajaDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => ConteoDenominacionesDto)
  conteo?: Record<string, number>;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => MediosVistosDto)
  medios?: MediosVistosDto;

  /** Efectivo contado como un solo total (sin desglosar por billetes). Se usa si no hay conteo por denominación. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  efectivoTotal?: number;

  @IsOptional()
  @IsString()
  nota?: string;
}
