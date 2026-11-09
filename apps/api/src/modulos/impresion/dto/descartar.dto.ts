import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

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

/** Quitar de la cola trabajos concretos (los no impresos); el motivo es opcional. */
export class QuitarTrabajosDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos un papel' })
  @ArrayMaxSize(200, { message: 'Máximo 200 papeles a la vez' })
  @IsString({ each: true })
  ids!: string[];

  @IsOptional()
  @IsString()
  motivo?: string;
}
