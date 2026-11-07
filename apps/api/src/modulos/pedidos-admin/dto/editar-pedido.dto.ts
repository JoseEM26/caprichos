import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Min, ValidateIf, ValidateNested } from 'class-validator';
import { EntregaDto, LineaPedidoDto } from '../../pedidos/dto/crear-pedido.dto';

/** Línea del editor: igual que la del pedido nuevo, más el id de la línea que ya existía (si la hay). */
export class LineaEdicionDto extends LineaPedidoDto {
  @IsOptional()
  lineaId?: number | string;
}

export class ClienteEdicionDto {
  @IsOptional()
  @IsString({ message: 'El nombre del cliente debe ser un texto' })
  nombre?: string;

  /** Vacío = sin celular. */
  @ValidateIf((o: ClienteEdicionDto) => !!o.telefono)
  @IsString({ message: 'El teléfono debe ser un texto' })
  @Matches(/^9\d{8}$/, { message: 'El teléfono debe tener 9 dígitos y empezar con 9' })
  telefono?: string;
}

export class EditarPedidoDto {
  /** Versión del pedido que vio quien edita; si cambió mientras tanto, se responde 409 PEDIDO_MODIFICADO. */
  @IsInt({ message: 'La versión del pedido debe ser un número entero' })
  @Min(0)
  version!: number;

  @IsArray({ message: 'Las líneas del pedido son requeridas' })
  @ArrayMinSize(1, { message: 'El pedido debe tener al menos un producto' })
  @ValidateNested({ each: true })
  @Type(() => LineaEdicionDto)
  lineas!: LineaEdicionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => ClienteEdicionDto)
  cliente?: ClienteEdicionDto;

  @IsOptional()
  @IsIn(['DELIVERY', 'RECOGER', 'MESA'], { message: 'Modalidad debe ser DELIVERY, RECOGER o MESA' })
  modalidad?: 'DELIVERY' | 'RECOGER' | 'MESA';

  @IsOptional()
  @ValidateNested()
  @Type(() => EntregaDto)
  entrega?: EntregaDto;
}

export class EditandoPedidoDto {
  /** true = abrió el editor; false = lo cerró. */
  @IsBoolean({ message: 'activo debe ser verdadero o falso' })
  activo!: boolean;
}
