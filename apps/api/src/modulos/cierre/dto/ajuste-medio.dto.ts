import { IsIn, IsNotEmpty, IsNumber, IsString, Min, MinLength } from 'class-validator';

export const MEDIOS_DIGITALES_AJUSTABLES = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'] as const;

export class AjusteMedioDto {
  @IsNotEmpty({ message: 'El medio digital es requerido' })
  @IsIn(MEDIOS_DIGITALES_AJUSTABLES, { message: 'El medio debe ser YAPE, PLIN, TRANSFERENCIA o TARJETA' })
  medio!: (typeof MEDIOS_DIGITALES_AJUSTABLES)[number];

  @IsNumber({}, { message: 'El monto nuevo debe ser un número' })
  @Min(0, { message: 'El monto nuevo no puede ser negativo' })
  montoNuevo!: number;

  @IsString({ message: 'El motivo es obligatorio' })
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  motivo!: string;
}
