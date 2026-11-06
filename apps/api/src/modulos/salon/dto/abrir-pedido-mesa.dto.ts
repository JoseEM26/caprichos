import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ComprobantePedidoDto,
  LineaPedidoDto,
  PagoPedidoDto,
} from '../../pedidos/dto/crear-pedido.dto';

/**
 * Cliente de un pedido de mesa: el nombre es obligatorio (sin cuenta) y el teléfono es opcional.
 * La regla «nombre o cuenta» la valida SalonService.abrirPedido.
 */
export class ClienteMesaDto {
  /** Mínimo 2 caracteres: lo valida SalonService.abrirPedido (CLIENTE_NOMBRE_REQUERIDO). */
  @IsOptional()
  @IsString({ message: 'El nombre del cliente debe ser un texto' })
  nombre?: string;

  /** Opcional. SalonService lo normaliza a dígitos y exige 9 dígitos que empiezan en 9 si viene. */
  @IsOptional()
  @IsString({ message: 'El teléfono debe ser un texto' })
  telefono?: string;
}

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

  /** Personas de la mesa: si viene, la capacidad de las mesas se valida como en reservas (confirmarCapacidad la permite). */
  @IsOptional()
  @IsInt({ message: 'personas debe ser un número entero' })
  @Min(1, { message: 'personas debe ser al menos 1' })
  personas?: number;

  @IsOptional()
  @IsBoolean({ message: 'confirmarCapacidad debe ser verdadero o falso' })
  confirmarCapacidad?: boolean;

  @IsOptional()
  colaboradorPartyId?: number | string;

  /** Celular (9 dígitos) de un cliente con cuenta: el pedido queda a su nombre y suma puntos al cobrar. Sin él: invitado. */
  @IsOptional()
  @Matches(/^9\d{8}$/, { message: 'El celular debe tener 9 dígitos y empezar con 9' })
  clienteTelefono?: string;

  /** Id del party de un cliente con cuenta (buscador de clientes). Con clienteTelefono gana el celular. */
  @IsOptional()
  @Matches(/^\d+$/, { message: 'clientePartyId debe ser un id numérico' })
  clientePartyId?: string;

  // reserva que se sienta con este pedido (viene de POST /admin/reservas/:id/sentar)
  @IsOptional()
  reservaId?: number | string;

  @IsOptional()
  @ValidateNested()
  @Type(() => ClienteMesaDto)
  cliente?: ClienteMesaDto;

  /** Nombre corto opcional para reconocer la mesa en el plano. Solo se usa si no viene cliente.nombre y el pedido no es de cuenta. */
  @IsOptional()
  @IsString({ message: 'El nombre del cliente debe ser un texto' })
  @MaxLength(40, { message: 'El nombre del cliente no puede pasar de 40 caracteres' })
  clienteNombre?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PagoPedidoDto)
  pago?: PagoPedidoDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ComprobantePedidoDto)
  comprobante?: ComprobantePedidoDto;
}
