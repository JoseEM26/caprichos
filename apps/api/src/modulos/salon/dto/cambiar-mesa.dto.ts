import { IsBoolean, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class CambiarMesaDto {
  @IsString({ message: 'mesaId debe ser un texto' })
  @IsNotEmpty({ message: 'La mesa destino es obligatoria' })
  @Matches(/^\d+$/, { message: 'mesaId debe ser un id numérico' })
  mesaId!: string;

  /** Opcional: mover solo esta mesa del pedido (si no, la mesa destino reemplaza a todas). */
  @IsOptional()
  @Matches(/^\d+$/, { message: 'desdeMesaId debe ser un id numérico' })
  desdeMesaId?: string;

  /** Solo lista de espera: permite tomar una mesa ocupada (el pedido que la ocupa pasa a la lista). */
  @IsOptional()
  @IsBoolean()
  forzarOcupada?: boolean;
}
