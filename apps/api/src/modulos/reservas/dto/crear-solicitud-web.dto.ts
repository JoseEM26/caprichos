import { IsInt, IsOptional, IsString, Length, Matches, MaxLength, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

const recortar = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/** Solicitud de reserva que llega desde la carta virtual (público, sin sesión). */
export class CrearSolicitudWebDto {
  @Transform(recortar)
  @IsString({ message: 'El nombre es obligatorio' })
  @Length(2, 60, { message: 'El nombre debe tener entre 2 y 60 caracteres' })
  nombre!: string;

  @Transform(recortar)
  @IsString({ message: 'El celular es obligatorio' })
  telefono!: string;

  @Type(() => Number)
  @IsInt({ message: 'Indica cuántas personas son' })
  @Min(1, { message: 'La reserva es para al menos 1 persona' })
  personas!: number;

  @Transform(recortar)
  @IsString({ message: 'La fecha es obligatoria' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha no es válida' })
  fecha!: string;

  @Transform(recortar)
  @IsString({ message: 'La hora es obligatoria' })
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora no es válida' })
  hora!: string;

  @IsOptional()
  @Transform(recortar)
  @IsString()
  @MaxLength(200, { message: 'La nota no puede pasar de 200 caracteres' })
  nota?: string;

  /** Campo trampa oculto en la hoja: si un robot lo llena, la solicitud no se guarda. */
  @IsOptional()
  @IsString()
  empresa?: string;
}
