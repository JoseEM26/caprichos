import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class ClienteDto {
  @IsString({ message: 'El nombre del cliente debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre del cliente es requerido' })
  nombre!: string;

  @IsString({ message: 'El teléfono debe ser un texto' })
  @Matches(/^9\d{8}$/, { message: 'El teléfono debe tener 9 dígitos y empezar con 9' })
  telefono!: string;
}

export class EntregaDto {
  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsNumber({}, { message: 'lat debe ser un número' })
  lat?: number;

  @IsOptional()
  @IsNumber({}, { message: 'lng debe ser un número' })
  lng?: number;

  @IsOptional()
  @IsIn(['GPS', 'ESCRITA', 'MAPA', 'WHATSAPP', 'ENLACE'], {
    message: 'Origen de entrega no válido',
  })
  origen?: 'GPS' | 'ESCRITA' | 'MAPA' | 'WHATSAPP' | 'ENLACE';
}

export class LineaPedidoDto {
  @IsNotEmpty({ message: 'productoId es requerido' })
  productoId!: number | string;

  @IsOptional()
  tamanoId?: number | string;

  @IsOptional()
  ofertaId?: number | string | null;

  @IsInt({ message: 'La cantidad debe ser un entero' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  cantidad!: number;

  @IsOptional()
  @IsArray({ message: 'opciones debe ser una lista' })
  opciones?: (number | string)[];

  @IsOptional()
  @IsString()
  nota?: string;

  @IsOptional()
  @IsArray({ message: 'personas debe ser una lista de nombres' })
  personas?: string[];

  @IsOptional()
  precio?: any;
}

export class PagoPedidoDto {
  @IsIn(['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'], {
    message: 'Método de pago no válido',
  })
  metodo!: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA';

  @IsOptional()
  @IsNumber({}, { message: 'pagaCon debe ser un número' })
  @Min(0)
  pagaCon?: number;
}

export class ComprobantePedidoDto {
  @IsIn(['BOLETA', 'FACTURA'], { message: 'Tipo de comprobante debe ser BOLETA o FACTURA' })
  tipo!: 'BOLETA' | 'FACTURA';

  @IsOptional()
  @IsString()
  dni?: string;

  @IsOptional()
  @IsString()
  ruc?: string;

  @IsOptional()
  @IsString()
  razonSocial?: string;
}

export class CrearPedidoDto {
  @ValidateNested()
  @Type(() => ClienteDto)
  @IsNotEmpty({ message: 'Los datos del cliente son requeridos' })
  cliente!: ClienteDto;

  @IsIn(['DELIVERY', 'RECOGER', 'MESA'], { message: 'Modalidad debe ser DELIVERY, RECOGER o MESA' })
  modalidad!: 'DELIVERY' | 'RECOGER' | 'MESA';

  @IsOptional()
  @ValidateNested()
  @Type(() => EntregaDto)
  entrega?: EntregaDto;

  @IsOptional()
  @IsString()
  mesa?: string;

  @IsArray({ message: 'Las líneas del pedido son requeridas' })
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

  @IsOptional()
  @IsString()
  cuponCodigo?: string;

  /** Puntos de la cuenta que se canjean como descuento; solo con sesión de cliente */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  puntosCanje?: number;

  @IsOptional()
  @IsBoolean()
  esPersonal?: boolean;

  @IsOptional()
  colaboradorPartyId?: number | string;

  @IsOptional()
  @IsString()
  canal?: 'MOZO' | 'CAJA';
}
