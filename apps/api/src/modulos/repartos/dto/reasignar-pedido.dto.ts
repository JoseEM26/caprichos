import { IsNotEmpty, IsString } from 'class-validator';

export class ReasignarPedidoDto {
  @IsString({ message: 'El identificador del nuevo repartidor debe ser texto' })
  @IsNotEmpty({ message: 'El identificador del nuevo repartidor es obligatorio' })
  repartidorPartyId!: string;

  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  motivo!: string;
}
