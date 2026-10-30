import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class ReasignarVoucherDto {
  @IsString({ message: 'El pedido destino es requerido' })
  @IsNotEmpty({ message: 'El pedido destino es requerido' })
  @Matches(/^\d+$/, { message: 'El pedido destino no es válido' })
  pedidoId!: string;
}
