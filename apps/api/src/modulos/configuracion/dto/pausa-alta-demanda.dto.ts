import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class PausaAltaDemandaDto {
  @IsBoolean({ message: 'El campo activa debe ser booleano' })
  activa!: boolean;

  @IsOptional()
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  motivo?: string;
}
