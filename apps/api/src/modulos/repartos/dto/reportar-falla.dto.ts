import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class ContactoIntentoDto {
  @IsNotEmpty({ message: 'El tipo de contacto es obligatorio' })
  @IsEnum(['LLAMADA', 'WHATSAPP'], {
    message: 'El tipo de contacto debe ser LLAMADA o WHATSAPP',
  })
  tipo!: 'LLAMADA' | 'WHATSAPP';

  @IsOptional()
  en?: string;
}

export class ReportarFallaDto {
  @IsNotEmpty({ message: 'El motivo es obligatorio' })
  @IsEnum(['NO_CONTESTA', 'DIRECCION_NO_ENCONTRADA'], {
    message: 'El motivo debe ser NO_CONTESTA o DIRECCION_NO_ENCONTRADA',
  })
  motivo!: 'NO_CONTESTA' | 'DIRECCION_NO_ENCONTRADA';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactoIntentoDto)
  contactos!: ContactoIntentoDto[];

  @IsOptional()
  fotoArchivoId?: number | string;

  /** Fotos del lugar (prueba de entrega): obligatorias de 1 a 3 para NO_CONTESTA. */
  @IsOptional()
  @IsArray({ message: 'Las fotos deben enviarse como lista' })
  @ArrayMaxSize(3, { message: 'Se admiten como máximo 3 fotos' })
  fotoArchivoIds?: (number | string)[];
}
