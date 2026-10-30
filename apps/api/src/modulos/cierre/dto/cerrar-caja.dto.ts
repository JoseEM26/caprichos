import { Type } from 'class-transformer';
import { IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
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

  @IsOptional()
  @IsString()
  nota?: string;
}
