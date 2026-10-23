import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import {
  ClienteDto,
  ComprobantePedidoDto,
  LineaPedidoDto,
  PagoPedidoDto,
} from '../../pedidos/dto/crear-pedido.dto';

export class AbrirPedidoMesaDto {
  @IsArray({ message: 'mesas debe ser una lista de IDs de mesas' })
  @ArrayMinSize(1, { message: 'Debe seleccionar al menos una mesa' })
  mesas!: (number | string)[];

  @IsArray({ message: 'Las líneas del pedido son requeridas' })
  @ValidateNested({ each: true })
  @Type(() => LineaPedidoDto)
  lineas!: LineaPedidoDto[];

  @IsOptional()
  @IsString()
  nota?: string;

  @IsOptional()
  @IsString()
  cuponCodigo?: string;

  @IsOptional()
  @IsString()
  canal?: 'MOZO' | 'CAJA';

  @IsOptional()
  @IsBoolean()
  esPersonal?: boolean;

  @IsOptional()
  colaboradorPartyId?: number | string;

  // reserva que se sienta con este pedido (viene de POST /admin/reservas/:id/sentar)
  @IsOptional()
  reservaId?: number | string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClienteDto)
  cliente?: ClienteDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PagoPedidoDto)
  pago?: PagoPedidoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ComprobantePedidoDto)
  comprobante?: ComprobantePedidoDto;
}
