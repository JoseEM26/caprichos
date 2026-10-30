import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConteoDenominacionesDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  '200'?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  '100'?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  '50'?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  '20'?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  '10'?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  '5'?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  '2'?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  '1'?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  '0.5'?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  '0.2'?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  '0.1'?: number;

  [key: string]: number | undefined;
}

export class MediosVistosDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  yape?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  plin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  transferencia?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  tarjeta?: number;

  [key: string]: number | undefined;
}

export class ArqueoDto {
  @IsNotEmpty({ message: 'El conteo por denominación es requerido' })
  @IsObject()
  @ValidateNested()
  @Type(() => ConteoDenominacionesDto)
  conteo!: Record<string, number>;

  @IsNotEmpty({ message: 'Los montos por medios digitales son requeridos' })
  @IsObject()
  @ValidateNested()
  @Type(() => MediosVistosDto)
  medios!: MediosVistosDto;
}
