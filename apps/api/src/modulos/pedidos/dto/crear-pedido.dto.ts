import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
  Min,
  ValidateNested,
} from 'class-validator';

export class ClienteDto {
  @IsString({ message: 'El nombre del cliente debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre del cliente es requerido' })
  nombre!: string;

  /** Opcional en la carta cuando se pide como invitado (el servicio exige el celular si el invitado está apagado). */
  @ValidateIf((o: ClienteDto) => !!o.telefono)
  @IsString({ message: 'El teléfono debe ser un texto' })
  @Matches(/^9\d{8}$/, { message: 'El teléfono debe tener 9 dígitos y empezar con 9' })
  telefono?: string;

  /** Cumpleaños (YYYY-MM-DD o DD/MM): obligatorio al darse de alta con el celular; lo valida el servicio. */
  @IsOptional()
  @IsString({ message: 'La fecha de cumpleaños debe ser un texto' })
  cumpleanos?: string;
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

  /** Combo con parte fija: qué producto se eligió (principal o reemplazo). El servidor valida que esté disponible. */
  @IsOptional()
  @IsArray({ message: 'comboElecciones debe ser una lista' })
  comboElecciones?: { parteId: number | string; productoId: number | string }[];

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

export class PlanPagoItemDto {
  @IsIn(['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'], {
    message: 'Medio de pago del plan no válido',
  })
  medio!: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA';

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'El monto del plan debe ser un número' })
  @Min(0.01, { message: 'Cada monto del plan debe ser mayor a 0' })
  monto!: number;
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

  /** Pago dividido: monto por medio. Si viene, manda sobre metodo (que queda como medio principal). */
  @IsOptional()
  @IsArray({ message: 'El plan de pago debe ser una lista' })
  @ArrayMinSize(1, { message: 'El plan de pago necesita al menos un medio' })
  @ValidateNested({ each: true })
  @Type(() => PlanPagoItemDto)
  plan?: PlanPagoItemDto[];
}

export class ComprobantePedidoDto {
  @IsIn(['BOLETA', 'FACTURA'], { message: 'Elige boleta o factura' })
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

  /** Dirección fiscal para la factura (opcional) */
  @IsOptional()
  @IsString()
  direccion?: string;
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

  /** Celular (9 dígitos) de un cliente con cuenta (solo lo usa el mozo/caja; en carta y WhatsApp se ignora). Sin cuenta: invitado. */
  @IsOptional()
  @Matches(/^9\d{8}$/, { message: 'El celular debe tener 9 dígitos y empezar con 9' })
  clienteTelefono?: string;

  /** Id del party de un cliente con cuenta (lo da el buscador de clientes). Solo MOZO/CAJA; con clienteTelefono gana el celular. */
  @IsOptional()
  @Matches(/^\d+$/, { message: 'clientePartyId debe ser un id numérico' })
  clientePartyId?: string;
}
