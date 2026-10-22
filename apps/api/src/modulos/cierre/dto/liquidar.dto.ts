import { IsNotEmpty, IsNumber, Min } from 'class-validator';

export class LiquidarRepartidorDto {
  @IsNotEmpty({ message: 'repartidorPartyId es requerido' })
  repartidorPartyId!: number | string;

  @IsNumber({}, { message: 'El monto entregado debe ser un número' })
  @Min(0, { message: 'El monto entregado no puede ser negativo' })
  entregado!: number;
}
