import { ArrayMaxSize, ArrayMinSize, IsArray } from 'class-validator';
import { MAX_MESAS_PEDIDO } from '../mesas-pedido.util';

export class AgregarMesasDto {
  @IsArray({ message: 'mesaIds debe ser una lista de IDs de mesas' })
  @ArrayMinSize(1, { message: 'Elige al menos una mesa para sumar' })
  @ArrayMaxSize(MAX_MESAS_PEDIDO, { message: `Un pedido puede ocupar hasta ${MAX_MESAS_PEDIDO} mesas juntas` })
  mesaIds!: (number | string)[];
}
