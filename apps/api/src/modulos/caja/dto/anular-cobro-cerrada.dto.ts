import { IsNotEmpty, IsString, MinLength } from 'class-validator';

/** Anular el cobro de una caja ya cerrada (solo ADMIN): el motivo pide al menos 10 caracteres. */
export class AnularCobroCerradaDto {
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo es requerido' })
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  motivo!: string;
}
