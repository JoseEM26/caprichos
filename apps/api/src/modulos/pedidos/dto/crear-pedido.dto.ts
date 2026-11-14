import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
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
  MinLength,
  ValidateIf,
  Min,
  ValidateNested,
} from 'class-validator';

/** Pedido del personal: a su crédito (por defecto) o «Pagar ahora» con medio y, en efectivo, con cuánto paga. */
export class PagoPersonalDto {
  @IsIn(['CREDITO', 'AHORA'])
  modo!: 'CREDITO' | 'AHORA';

  @IsOptional()
  @IsString()
  medio?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  pagaCon?: number;
}

export class ClienteDto {
  @IsString({ message: 'El nombre del cliente debe ser un texto' })
  @IsNotEmpty({ message: 'El nombre del cliente es requerido' })
  @MinLength(2, { message: 'El nombre del cliente debe tener al menos 2 letras' })
  nombre!: string;

  /** Opcional en la carta cuando se pide como invitado (el servicio exige el celular si el invitado está apagado). */
  @ValidateIf((o: ClienteDto) => !!o.telefono)
  @IsString({ message: 'El teléfono debe ser un texto' })
  @Matches(/^9\d{8}$/, { message: 'El teléfono debe tener 9 dígitos y empezar con 9' })
  @Matches(/^(?!999999999$)/, { message: 'El teléfono 999999999 no es un número real' })
  telefono?: string;

  /** Cumpleaños (YYYY-MM-DD o DD/MM). Solo lo guarda quien pide con su cuenta; el pedido sin cuenta lo ignora. */
  @IsOptional()
  @IsString({ message: 'La fecha de cumpleaños debe ser un texto' })
  cumpleanos?: string;
}

/** Consulta pública de la dirección anterior de un celular (la carta sin sesión). */
export class PistaDireccionDto {
  @IsString({ message: 'El celular debe ser un texto' })
  @Matches(/^9\d{8}$/, { message: 'El celular debe tener 9 dígitos y empezar con 9' })
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

  /** Sin sesión: usar la dirección del último pedido de delivery de ese celular. La resuelve el servidor. */
  @IsOptional()
  @IsBoolean({ message: 'reutilizarUltimaDireccion debe ser verdadero o falso' })
  reutilizarUltimaDireccion?: boolean;
}

export class LineaPedidoDto {
  @IsNotEmpty({ message: 'productoId es requerido' })
  productoId!: number | string;

  @IsOptional()
  tamanoId?: number | string;

  @IsOptional()
  ofertaId?: number | string | null;

  /** Combo: qué producto se eligió en cada parte (una entrada por unidad). Producto por sabor: el sabor de esa unidad. El servidor valida disponibilidad y saldo. */
  @IsOptional()
  @IsArray({ message: 'comboElecciones debe ser una lista' })
  comboElecciones?: { parteId: number | string; productoId: number | string; saborId?: number | string; cantidad?: number }[];

  @IsInt({ message: 'La cantidad debe ser un entero' })
  @Min(1, { message: 'La cantidad mínima es 1' })
  cantidad!: number;

  @IsOptional()
  @IsArray({ message: 'opciones debe ser una lista' })
  opciones?: (number | string)[];

  /** Producto por sabor: reparto de sus unidades (tamaño.unidades × cantidad) entre sabores. El servidor valida la suma. */
  @IsOptional()
  @IsArray({ message: 'sabores debe ser una lista' })
  sabores?: { saborId: number | string; cantidad: number }[];

  @IsOptional()
  @IsString()
  nota?: string;

  @IsOptional()
  @IsArray({ message: 'personas debe ser una lista de nombres' })
  personas?: string[];

  @IsOptional()
  precio?: any;

  /** Cortesía de esta línea (solo con permiso cortesias/dar): sale a S/ 0. El servidor valida motivo y nota. */
  @IsOptional()
  cortesia?: { motivo: string; nota?: string };
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
  @ArrayMaxSize(3, { message: 'Se puede pagar con hasta 3 medios' })
  @ValidateNested({ each: true })
  @Type(() => PlanPagoItemDto)
  plan?: PlanPagoItemDto[];
}

export class ComprobantePedidoDto {
  @IsIn(['SIMPLE', 'BOLETA', 'FACTURA'], { message: 'Elige comprobante simple, boleta o factura' })
  tipo!: 'SIMPLE' | 'BOLETA' | 'FACTURA';

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

/** Adelanto al programar un pedido (cualquier medio; la captura es opcional); entra a la caja de hoy. */
export class AdelantoPedidoDto {
  @IsIn(['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA'], { message: 'Medio de pago del adelanto no válido' })
  medio!: 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TARJETA' | 'TRANSFERENCIA';

  /** Captura ya subida del pago digital (opcional). */
  @IsOptional()
  voucherId?: string | number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  pagaCon?: number;
}

/** Pedido de mesa programado: reserva de mesa que se crea junto con él. */
export class ReservaPedidoDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Elige al menos una mesa' })
  mesas!: (number | string)[];

  @Type(() => Number)
  @IsInt()
  @Min(1)
  personas!: number;

  @IsOptional()
  @IsBoolean()
  confirmarCapacidad?: boolean;
}

export class CrearPedidoDto {
  @ValidateNested()
  @Type(() => ClienteDto)
  @IsNotEmpty({ message: 'Los datos del cliente son requeridos' })
  cliente!: ClienteDto;

  @IsIn(['DELIVERY', 'RECOGER', 'MESA', 'COMER_LOCAL'], { message: 'Modalidad debe ser DELIVERY, RECOGER, MESA o COMER_LOCAL' })
  modalidad!: 'DELIVERY' | 'RECOGER' | 'MESA' | 'COMER_LOCAL';

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

  /** Propina opcional en soles (va aparte de la venta). Solo carta y bot, con el interruptor encendido. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  propina?: number;

  @IsOptional()
  @IsBoolean()
  esPersonal?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PagoPersonalDto)
  pagoPersonal?: PagoPersonalDto;

  /** Solo carta con sesión de una cuenta vinculada a un usuario activo: CREDITO carga el pedido a su crédito del personal. El servidor decide todo por la sesión. */
  @IsOptional()
  @IsIn(['CONTADO', 'CREDITO'])
  pagoEquipo?: 'CONTADO' | 'CREDITO';

  @IsOptional()
  colaboradorPartyId?: number | string;

  @IsOptional()
  @IsString()
  canal?: 'MOZO' | 'CAJA';

  /** Celular (9 dígitos) de un cliente con cuenta (solo lo usa el mozo/caja; en carta y WhatsApp se ignora). Sin cuenta: invitado. */
  @IsOptional()
  @Matches(/^9\d{8}$/, { message: 'El celular debe tener 9 dígitos y empezar con 9' })
  @Matches(/^(?!999999999$)/, { message: 'El celular 999999999 no es un número real' })
  clienteTelefono?: string;

  /** Id del party de un cliente con cuenta (lo da el buscador de clientes). Solo MOZO/CAJA; con clienteTelefono gana el celular. */
  @IsOptional()
  @Matches(/^\d+$/, { message: 'clientePartyId debe ser un id numérico' })
  clientePartyId?: string;

  /** Programar para otra fecha (ISO). Solo lo atiende el panel de Caja y mozo; en carta y WhatsApp se ignora. */
  @IsOptional()
  @IsString()
  programadoPara?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AdelantoPedidoDto)
  adelanto?: AdelantoPedidoDto;

  /** Solo MESA programada: mesas y personas de la reserva que se crea con el pedido. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ReservaPedidoDto)
  reserva?: ReservaPedidoDto;
}
