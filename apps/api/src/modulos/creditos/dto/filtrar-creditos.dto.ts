import { IsOptional, IsString } from 'class-validator';

export class FiltrarCreditosDto {
  @IsOptional()
  @IsString()
  periodo?: 'semana' | 'mes' | 'rango';

  @IsOptional()
  semanaOffset?: string | number;

  @IsOptional()
  mesOffset?: string | number;

  @IsOptional()
  @IsString()
  desde?: string;

  @IsOptional()
  @IsString()
  hasta?: string;
}
