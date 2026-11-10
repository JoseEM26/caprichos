import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  ValidateNested,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { TIPOS_MARCA, TipoMarca } from '../asistencia.calculo';

export class MarcarDto {
  /** Ya no hace falta: el servidor interpreta cada marca por orden y pares. Se acepta (y se ignora) por compatibilidad. */
  @IsOptional()
  @IsIn(TIPOS_MARCA as unknown as string[], { message: 'Tipo de marca no válido' })
  tipo?: TipoMarca;

  /** Texto del QR escaneado (o vacío si se usa el código corto). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  qr?: string;

  /** Código de 6 dígitos que muestra la pantalla, si la cámara no sirve. */
  @IsOptional()
  @IsString()
  @MaxLength(10)
  codigo?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  /** Precisión reportada por el GPS del celular, en metros. */
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100000)
  precision!: number;

  /** Selfie JPEG en base64 (con o sin prefijo data:). Opcional si la cámara no abrió (`sinSelfie`). */
  @IsOptional()
  @IsString()
  @MaxLength(400000)
  selfie?: string;

  /** La cámara del celular no abrió: se acepta la marca sin foto y queda A_REVISAR. */
  @IsOptional()
  @IsBoolean()
  sinSelfie?: boolean;

  /** Identificador aleatorio del navegador (se guarda como huella, nunca en claro). */
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  dispositivo!: string;

  @IsOptional()
  @IsBoolean()
  consentimiento?: boolean;
}

/** Marca manual (sin QR ni selfie): solo GPS. Queda A_REVISAR para el admin. */
export class MarcarManualDto {
  /** Opcional y se ignora: el servidor interpreta cada marca por orden y pares. */
  @IsOptional() @IsIn(TIPOS_MARCA as unknown as string[], { message: 'Tipo de marca no válido' })
  tipo?: TipoMarca;

  @Type(() => Number) @IsNumber() @Min(-90) @Max(90) lat!: number;
  @Type(() => Number) @IsNumber() @Min(-180) @Max(180) lng!: number;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100000) precision!: number;

  @IsOptional() @IsBoolean() consentimiento?: boolean;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class ConfigurarAsistenciaDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(3) @Max(100) radioM?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) toleranciaMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100) pagoTardanzaPct?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(5) multiplicadorExtra?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) @Max(1000) netflixSemanal?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) diasMesDefecto?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(1) @Max(24) horasDiaDefecto?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(7) @Max(3650) retencionDias?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(30) dobleMarcaMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(31) solicitudDiasMax?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(100) precisionMaxM?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-90) @Max(90) localLat?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(-180) @Max(180) localLng?: number;
}

export class CorregirMarcaDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  partyId!: number;

  @Matches(FECHA, { message: 'La jornada debe ser AAAA-MM-DD' })
  jornada!: string;

  @IsIn(TIPOS_MARCA as unknown as string[], { message: 'Tipo de marca no válido' })
  tipo!: TipoMarca;

  /** Fecha y hora real de la marca (ISO 8601). Debe caer en la jornada indicada. */
  @IsString()
  @MaxLength(40)
  momento!: string;

  @IsString()
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  @MaxLength(300)
  motivo!: string;
}

export class ReporteMesDto {
  @Type(() => Number) @IsInt() @Min(2020) @Max(2100) anio!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(12) mes!: number;
  @IsOptional() @IsIn(['json', 'csv']) formato?: 'json' | 'csv';
}

export class ListarMarcasDto {
  @IsOptional() @Matches(FECHA) desde?: string;
  @IsOptional() @Matches(FECHA) hasta?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) partyId?: number;
}

export class MiHistorialDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(62) dias?: number;
}

export class RevisarMarcaDto {
  @IsString()
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  @MaxLength(300)
  motivo!: string;
}

export class CronogramaDto {
  @Matches(FECHA, { message: 'La fecha inicial debe ser AAAA-MM-DD' }) desde!: string;
  @Matches(FECHA, { message: 'La fecha final debe ser AAAA-MM-DD' }) hasta!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) partyId?: number;
  @IsOptional() @IsString() @MaxLength(30) rol?: string;
}

export class ReasignarMarcaDto {
  @IsIn(TIPOS_MARCA as unknown as string[], { message: 'Tipo de marca no válido' })
  tipo!: TipoMarca;

  @IsString()
  @MinLength(10, { message: 'El motivo debe tener al menos 10 caracteres' })
  @MaxLength(300)
  motivo!: string;
}

export class ItemSolicitudDto {
  @IsIn(TIPOS_MARCA as unknown as string[], { message: 'Tipo de marca no válido' })
  tipo!: TipoMarca;

  /** Hora real de Lima «HH:MM». */
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'La hora debe ser HH:MM' })
  hora!: string;
}

export class CrearSolicitudDto {
  @Matches(FECHA, { message: 'La jornada debe ser AAAA-MM-DD' })
  jornada!: string;

  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => ItemSolicitudDto)
  items!: ItemSolicitudDto[];

  @IsString()
  @MinLength(5, { message: 'El motivo debe tener al menos 5 caracteres' })
  @MaxLength(300)
  motivo!: string;
}

export class ResolverSolicitudDto {
  @IsOptional() @IsString() @MaxLength(300) nota?: string;
}

export class RechazarSolicitudDto {
  @IsString()
  @MinLength(5, { message: 'Escribe el motivo del rechazo (mínimo 5 caracteres)' })
  @MaxLength(300)
  motivo!: string;
}

export class ItemLoteDto {
  @IsIn(['MARCA', 'SOLICITUD']) tipo!: 'MARCA' | 'SOLICITUD';
  @Type(() => Number) @IsInt() @Min(1) id!: number;
}

export class LoteDto {
  @IsIn(['APROBAR', 'RECHAZAR']) accion!: 'APROBAR' | 'RECHAZAR';
  /** Un solo motivo para todas (obligatorio al rechazar). */
  @IsOptional() @IsString() @MaxLength(300) motivo?: string;
  @IsOptional() @IsString() @MaxLength(300) nota?: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({ each: true }) @Type(() => ItemLoteDto)
  items!: ItemLoteDto[];
}

export class AprobarSimplesDto {
  @Type(() => Number) @IsInt() @Min(1) partyId!: number;
  @Matches(FECHA) desde!: string;
  @Matches(FECHA) hasta!: string;
}
