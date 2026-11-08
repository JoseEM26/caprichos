import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ComprobantePedidoDto, LineaPedidoDto, PagoPedidoDto } from '../../pedidos/dto/crear-pedido.dto';

/** «Agregar extra»: solo productos, pago y comprobante propios; cliente, modalidad, mesa y dirección salen del pedido original. */
export class ExtraPedidoDto {
  @IsArray({ message: 'Las líneas del extra son requeridas' })
  @ArrayMinSize(1, { message: 'El extra debe tener al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => LineaPedidoDto)
  lineas!: LineaPedidoDto[];

  @ValidateNested()
  @Type(() => PagoPedidoDto)
  @IsNotEmpty({ message: 'Los datos de pago son requeridos' })
  pago!: PagoPedidoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ComprobantePedidoDto)
  comprobante?: ComprobantePedidoDto;

  @IsOptional()
  @IsString()
  nota?: string;
}
