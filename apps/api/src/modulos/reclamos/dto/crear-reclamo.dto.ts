import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

export class CrearReclamoDto {
  @IsIn(['RECLAMO', 'QUEJA'], {
    message: 'El tipo debe ser RECLAMO o QUEJA',
  })
  tipo!: 'RECLAMO' | 'QUEJA';

  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  nombre!: string;

  @IsString()
  @Matches(/^[0-9]{8}$|^[A-Za-z0-9]{8,12}$/, {
    message: 'El documento debe ser un DNI de 8 dígitos o Carnet de Extranjería válido',
  })
  documento!: string;

  @IsString()
  @IsNotEmpty({ message: 'El domicilio es obligatorio' })
  domicilio!: string;

  @IsString()
  @Matches(/^[0-9]{9}$/, {
    message: 'El teléfono debe tener 9 dígitos',
  })
  telefono!: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido' })
  correo?: string;

  @IsOptional()
  @IsString()
  pedidoCodigo?: string;

  @IsString()
  @MinLength(20, {
    message: 'El detalle debe tener al menos 20 caracteres',
  })
  detalle!: string;

  @IsOptional()
  @IsNumber({}, { message: 'El monto reclamado debe ser un número válido' })
  @Min(0, { message: 'El monto reclamado no puede ser negativo' })
  montoReclamado?: number;

  @IsBoolean({ message: 'aceptaPrivacidad debe ser un booleano' })
  aceptaPrivacidad!: boolean;
}
