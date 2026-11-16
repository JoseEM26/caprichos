import { IsNotEmpty } from 'class-validator';

export class DarCuponDto {
  @IsNotEmpty({ message: 'pedidoId es obligatorio' })
  pedidoId!: string | number;
}
