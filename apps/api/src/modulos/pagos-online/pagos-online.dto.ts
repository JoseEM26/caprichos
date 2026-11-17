import { Type } from 'class-transformer';
import { IsBoolean, IsObject, IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class IntentoDto {
  @IsNotEmpty({ message: 'El pedido es requerido' })
  pedidoId!: string | number;

  /** Token de seguimiento que la carta recibió al crear el pedido (invitado); con sesión de cliente no hace falta */
  @IsOptional()
  @IsString()
  seguimientoToken?: string;
}

/** Cambio de medio de un pedido que espera Culqi: el cliente (con su token) o Caja */
export class CambioMedioDto {
  @IsNotEmpty({ message: 'El pedido es requerido' })
  pedidoId!: string | number;

  @IsOptional()
  @IsString()
  seguimientoToken?: string;

  @IsString()
  @IsNotEmpty({ message: 'Elige el medio de pago' })
  @MaxLength(20)
  medio!: string;

  @IsOptional()
  @IsNumber({}, { message: 'El monto con el que paga no es válido' })
  pagaCon?: number;
}

export class CargoDto {
  @IsString()
  @IsNotEmpty({ message: 'El intento es requerido' })
  intentoId!: string;

  @IsString()
  @IsNotEmpty({ message: 'El token de pago es requerido' })
  @MaxLength(200)
  token!: string;

  @IsIn(['TARJETA', 'YAPE'], { message: 'Elige tarjeta o Yape' })
  medio!: 'TARJETA' | 'YAPE';

  @IsOptional()
  @IsEmail({}, { message: 'El correo no es válido' })
  email?: string;

  /** Huella del dispositivo de Culqi3DS.generateDevice() */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  deviceId?: string;

  /** Segundo cargo tras REQUIERE_3DS: lo que entregó Culqi3DS (parameters3DS) */
  @IsOptional()
  @IsObject()
  autenticacion3ds?: Record<string, unknown>;
}

export class DevolverDto {
  /** En soles; sin monto se devuelve todo lo que falta */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  monto?: number;

  @IsString()
  @IsNotEmpty({ message: 'El motivo es requerido' })
  @MaxLength(200)
  motivo!: string;

  /** CULQI (por la pasarela) o el medio con que se devolvió por fuera; por defecto CULQI */
  @IsOptional()
  @IsIn(['CULQI', 'EFECTIVO', 'YAPE', 'PLIN', 'TRANSFERENCIA'], { message: 'El medio de devolución no es válido' })
  medio?: 'CULQI' | 'EFECTIVO' | 'YAPE' | 'PLIN' | 'TRANSFERENCIA';

  /** Hace falta si el pedido no está anulado */
  @IsOptional()
  @IsBoolean()
  confirmar?: boolean;
}
