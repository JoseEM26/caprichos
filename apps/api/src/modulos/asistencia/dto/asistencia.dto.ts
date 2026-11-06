import { Type } from 'class-transformer';
import {
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
  @IsIn(TIPOS_MARCA as unknown as string[], { message: 'Tipo de marca no válido' })
  tipo!: TipoMarca;

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

  /** Selfie JPEG en base64 (con o sin prefijo data:). */
  @IsString()
  @MaxLength(400000)
  selfie!: string;

  /** Identificador aleatorio del navegador (se guarda como huella, nunca en claro). */
  @IsString()
  @MinLength(8)
  @MaxLength(80)
  dispositivo!: string;

  @IsOptional()
  @IsBoolean()
  consentimiento?: boolean;
}

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class ConfigurarAsistenciaDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(3) @Max(100) radioM?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(60) toleranciaMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(7) @Max(3650) retencionDias?: number;
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
