import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CerrarPorRepartidorDto {
  /** Repartidor que entregó. Si se omite, se usa el que ya tiene el pedido. */
  @IsOptional()
  @IsString()
  repartidorPartyId?: string;

  @IsString({ message: 'El motivo debe ser texto' })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  motivo!: string;

  /** Solo el administrador: entrega aunque el delivery digital no esté cobrado. */
  @IsOptional()
  @IsBoolean()
  forzarSinCobro?: boolean;
}
