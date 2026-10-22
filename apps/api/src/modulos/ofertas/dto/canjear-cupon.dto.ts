import { IsNotEmpty, IsString } from 'class-validator';

export class CanjearCuponDto {
  @IsString({ message: 'El código de cupón es obligatorio' })
  @IsNotEmpty({ message: 'El código no puede estar vacío' })
  codigo!: string;

  @IsNotEmpty({ message: 'pedidoId es obligatorio' })
  pedidoId!: string | number;
}
