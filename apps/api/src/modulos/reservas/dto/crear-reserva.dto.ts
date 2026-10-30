import { ArrayNotEmpty, IsArray, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CrearReservaDto {
  @IsString({ message: 'El nombre es obligatorio' })
  @IsNotEmpty({ message: 'El nombre no puede estar vacío' })
  nombre!: string;

  @IsString({ message: 'El teléfono es obligatorio' })
  @IsNotEmpty({ message: 'El teléfono no puede estar vacío' })
  telefono!: string;

  @Type(() => Number)
  @IsInt({ message: 'El número de personas debe ser un entero' })
  @Min(1, { message: 'El número de personas debe ser al menos 1' })
  personas!: number;

  @IsNotEmpty({ message: 'La hora es obligatoria' })
  hora!: string;

  @IsArray({ message: 'mesas debe ser un arreglo de identificadores' })
  @ArrayNotEmpty({ message: 'Debe seleccionar al menos una mesa' })
  mesas!: (number | string)[];
}
