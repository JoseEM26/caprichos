import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

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

  @IsOptional()
  redes?: Record<string, string>;
}
