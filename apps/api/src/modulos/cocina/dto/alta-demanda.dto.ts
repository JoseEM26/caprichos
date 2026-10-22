import { IsBoolean, IsInt, IsOptional } from 'class-validator';

export class AltaDemandaDto {
  @IsBoolean({ message: 'activa debe ser un booleano' })
  activa!: boolean;

  @IsOptional()
  @IsInt({ message: 'minutos debe ser un entero' })
  minutos?: number;

  @IsOptional()
  @IsBoolean({ message: 'pausa debe ser un booleano' })
  pausa?: boolean;
}
