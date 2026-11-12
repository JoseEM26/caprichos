import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class VincularCuentaClienteDto {
  /** Celular de 9 dígitos de la cuenta de cliente de esa persona. */
  @Matches(/^9\d{8}$/, { message: 'El celular debe tener 9 dígitos y empezar en 9' })
  celular!: string;
}

/** Vista previa del celular de un usuario (nombres y apellidos solo para altas: comparar con la cuenta de cliente). */
export class PreviaCelularUsuarioDto extends VincularCuentaClienteDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  nombres?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  apellidos?: string;
}
