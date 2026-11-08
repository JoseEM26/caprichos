import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { EstadoImpresora, RolImpresora } from '@caprichos/compartido';

export class ImpresoraLatidoDto {
  @IsIn(['ETIQUETERA', 'TICKETERA'])
  rol!: RolImpresora;

  @IsIn(['lista', 'sin_papel', 'desconectada', 'sin_permiso', 'error'])
  estado!: EstadoImpresora;

  @IsOptional()
  @IsString()
  detalle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  id?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  nombre?: string;
}

export class CandidataLatidoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  id!: string;

  @IsString()
  @MaxLength(300)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  detalle?: string;

  @IsOptional()
  @IsIn(['ETIQUETERA', 'TICKETERA'])
  sugerido?: RolImpresora;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  puerto?: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  driver?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  estado?: string;

  @IsOptional()
  @IsBoolean()
  usb?: boolean;
}

export class InfoEquipoLatidoDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  hostname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sistema?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  ipLocal?: string[];

  /** Identificador estable de la PC (hash): la reconoce al volver a vincularse. Aditivo: los programas viejos no lo mandan. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  equipoUid?: string;
}

/** Canje del código de vinculación; `equipo` es aditivo (programas viejos solo mandan el código). */
export class VincularAgenteDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  codigo?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => InfoEquipoLatidoDto)
  equipo?: InfoEquipoLatidoDto;
}

export class LatidoDto {
  @IsNotEmpty({ message: 'La versión es obligatoria' })
  @IsString({ message: 'La versión debe ser una cadena' })
  version!: string;

  @IsNotEmpty({ message: 'El estado de la impresora es obligatorio' })
  @IsIn(['lista', 'sin_papel', 'desconectada', 'sin_permiso', 'error'], {
    message: 'El estado de la impresora debe ser lista, sin_papel, desconectada, sin_permiso o error',
  })
  impresora!: EstadoImpresora;

  @IsOptional()
  @IsString({ message: 'El detalle debe ser una cadena' })
  detalle?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImpresoraLatidoDto)
  impresoras?: ImpresoraLatidoDto[];

  /** Impresoras que ve el equipo del local (aditivo: los programas viejos no la mandan). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CandidataLatidoDto)
  candidatas?: CandidataLatidoDto[];

  /** Nombre, sistema y red de la computadora (aditivo). */
  @IsOptional()
  @ValidateNested()
  @Type(() => InfoEquipoLatidoDto)
  equipo?: InfoEquipoLatidoDto;
}
