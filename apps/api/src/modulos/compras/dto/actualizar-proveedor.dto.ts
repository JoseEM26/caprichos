import { IsBoolean, IsNumber, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class ActualizarProveedorDto {
  @IsOptional()
  @IsString({ message: 'La razón social debe ser texto' })
  @Length(2, 200, { message: 'La razón social debe tener entre 2 y 200 caracteres' })
  razonSocial?: string;

  @IsOptional()
  @IsString({ message: 'El nombre comercial debe ser texto' })
  nombreComercial?: string;

  @IsOptional()
  @IsString({ message: 'El RUC debe ser texto' })
  @Matches(/^\d{11}$/, { message: 'El RUC debe tener exactamente 11 dígitos numéricos' })
  ruc?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  telefono?: string;

  @IsOptional()
  @IsString({ message: 'El contacto debe ser texto' })
  contacto?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Los días de crédito deben ser un número' })
  @Min(0, { message: 'Los días de crédito no pueden ser negativos' })
  diasCredito?: number;

  @IsOptional()
  @IsString({ message: 'La cuenta de pago debe ser texto' })
  cuentaPago?: string;

  @IsOptional()
  @IsBoolean({ message: 'Activo debe ser booleano' })
  activo?: boolean;
}
