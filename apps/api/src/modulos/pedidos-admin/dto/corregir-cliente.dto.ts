import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Corrección de los datos de contacto de un pedido (PATCH /admin/pedidos/:id/cliente). */
export class CorregirClienteDto {
  @Transform(recortar)
  @IsString({ message: 'El nombre es requerido' })
  @MinLength(2, { message: 'El nombre debe tener al menos 2 letras' })
  @MaxLength(120, { message: 'El nombre es demasiado largo' })
  nombre!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/\s+/g, '') : value))
  @Matches(/^9\d{8}$/, { message: 'El celular debe tener 9 dígitos y empezar con 9' })
  telefono!: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200, { message: 'La dirección es demasiado larga' })
  direccion?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200, { message: 'La referencia es demasiado larga' })
  referencia?: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200, { message: 'El motivo es demasiado largo' })
  motivo?: string;
}
