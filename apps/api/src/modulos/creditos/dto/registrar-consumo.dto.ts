import { IsNotEmpty } from 'class-validator';

export class RegistrarConsumoDto {
  @IsNotEmpty({ message: 'El identificador del pedido es obligatorio' })
  pedidoId!: string | number;

  @IsNotEmpty({ message: 'El identificador del colaborador (partyId) es obligatorio' })
  partyId!: string | number;
}
