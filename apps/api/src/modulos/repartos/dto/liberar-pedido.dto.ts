import { IsNotEmpty, IsString } from 'class-validator';

export class LiberarPedidoDto {
  @IsString({ message: 'El motivo debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  motivo!: string;
}
