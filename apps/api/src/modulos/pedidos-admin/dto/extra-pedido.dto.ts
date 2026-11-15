import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';
import { CargoLibreDto, ComprobantePedidoDto, LineaPedidoDto, PagoPedidoDto } from '../../pedidos/dto/crear-pedido.dto';

/** «Agregar extra»: solo productos, pago y comprobante propios; cliente, modalidad, mesa y dirección salen del pedido original. */
export class ExtraPedidoDto {
  /** Puede ir vacía si el extra es solo un servicio o producto libre (cargosLibres). */
  @IsArray({ message: 'Las líneas del extra son requeridas' })
  @ValidateNested({ each: true })
  @Type(() => LineaPedidoDto)
  lineas!: LineaPedidoDto[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CargoLibreDto)
  cargosLibres?: CargoLibreDto[];

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
