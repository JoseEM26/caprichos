import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class ActualizarDatosLocalDto {
  @IsString({ message: 'nombre debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'nombre es requerido' })
  nombre!: string;

  @IsString({ message: 'direccion debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'direccion es requerida' })
  direccion!: string;

  @IsString({ message: 'telefono debe ser una cadena de texto' })
  @IsNotEmpty({ message: 'telefono es requerido' })
  telefono!: string;

  @IsOptional()
  @IsString({ message: 'whatsapp debe ser una cadena de texto' })
  whatsapp?: string;

  /** Enlaces de redes e instagramNombre (texto del enlace de Instagram en la carta). */
  @IsOptional()
  redes?: Record<string, string>;

  /** Frase bajo el nombre en la cabecera de la carta. Vacío: la carta usa «Cafetería artesanal». */
  @IsOptional()
  @IsString({ message: 'lema debe ser una cadena de texto' })
  @MaxLength(80, { message: 'lema no puede pasar de 80 caracteres' })
  lema?: string;

  @IsOptional()
  @IsString({ message: 'razon_social debe ser una cadena de texto' })
  @MaxLength(150, { message: 'razon_social no puede pasar de 150 caracteres' })
  razon_social?: string;

  /** RUC de 11 dígitos (10, 15, 17 o 20). Vacío lo quita. */
  @IsOptional()
  @Matches(/^$|^(10|15|17|20)\d{9}$/, { message: 'ruc debe tener 11 dígitos y comenzar con 10, 15, 17 o 20' })
  ruc?: string;

  /** Correo de contacto (aparece en Términos y Privacidad). Vacío lo quita. */
  @IsOptional()
  @Matches(/^$|^\S+@\S+\.\S+$/, { message: 'correo no es válido' })
  @MaxLength(120, { message: 'correo no puede pasar de 120 caracteres' })
  correo?: string;

  @IsOptional()
  @IsString({ message: 'direccion_fiscal debe ser una cadena de texto' })
  @MaxLength(200, { message: 'direccion_fiscal no puede pasar de 200 caracteres' })
  direccion_fiscal?: string;

  @IsOptional()
  @IsNumber({}, { message: 'lat debe ser un número' })
  @Min(-90, { message: 'lat debe estar entre -90 y 90' })
  @Max(90, { message: 'lat debe estar entre -90 y 90' })
  lat?: number;

  @IsOptional()
  @IsNumber({}, { message: 'lng debe ser un número' })
  @Min(-180, { message: 'lng debe estar entre -180 y 180' })
  @Max(180, { message: 'lng debe estar entre -180 y 180' })
  lng?: number;
}
