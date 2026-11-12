import { Matches } from 'class-validator';

export class VincularCuentaClienteDto {
  /** Celular de 9 dígitos de la cuenta de cliente de esa persona. */
  @Matches(/^9\d{8}$/, { message: 'El celular debe tener 9 dígitos y empezar en 9' })
  celular!: string;
}
