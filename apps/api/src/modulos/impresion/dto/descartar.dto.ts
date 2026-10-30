import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class VaciarColaDto {
  /** ANTIGUAS: solo las pendientes con más de `minutos`; TODAS: todas las pendientes. */
  @IsIn(['ANTIGUAS', 'TODAS'], { message: 'El alcance debe ser ANTIGUAS o TODAS' })
  alcance!: 'ANTIGUAS' | 'TODAS';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100000)
  minutos?: number;

  @IsOptional()
  @IsString()
  pedido_id?: string;

  @IsString({ message: 'El motivo es obligatorio' })
  motivo!: string;
}

export class DescartarDto {
  @IsOptional()
  @IsString()
  motivo?: string;
}
