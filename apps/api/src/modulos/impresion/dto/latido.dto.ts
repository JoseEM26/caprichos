import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { EstadoImpresora } from '@caprichos/compartido';

export class LatidoDto {
  @IsNotEmpty({ message: 'La versión es obligatoria' })
  @IsString({ message: 'La versión debe ser una cadena' })
  version!: string;

  @IsNotEmpty({ message: 'El estado de la impresora es obligatorio' })
  @IsIn(['lista', 'sin_papel', 'desconectada', 'error'], {
    message: 'El estado de la impresora debe ser lista, sin_papel, desconectada o error',
  })
  impresora!: EstadoImpresora;

  @IsOptional()
  @IsString({ message: 'El detalle debe ser una cadena' })
  detalle?: string;
}
