import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RechazarPropuestaUbicacionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}
