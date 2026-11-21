import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsIn, IsInt, IsObject, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';
import { COLORES, FRECUENCIAS, PLANTILLAS, PUBLICOS, TIPOS_EVENTO } from '../anuncios.regla';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
// Enlace interno: empieza con una sola «/» (carta o panel). Nada de http ni «//».
const INTERNO = /^\/(?!\/)[^\s]*$/;
// Imagen: la que devuelve /admin/archivos (ruta propia) o una dirección https.
const IMAGEN = /^(\/|https:\/\/)[^\s]+$/;

export class GuardarAnuncioDto {
  @IsIn(PUBLICOS as unknown as string[]) publico!: string;
  @IsOptional() @IsArray() @IsString({ each: true }) @MaxLength(30, { each: true }) roles?: string[];
  @IsIn(PLANTILLAS as unknown as string[]) plantilla!: string;
  @IsString() @MinLength(1) @MaxLength(120) titulo!: string;
  @IsOptional() @IsString() @MaxLength(1500) texto?: string | null;
  @IsOptional() @IsString() @MaxLength(500) @Matches(IMAGEN, { message: 'La imagen debe ser una ruta del sistema o una dirección https' }) imagen_url?: string | null;
  @IsOptional() @IsString() @MaxLength(40) boton_texto?: string | null;
  @IsOptional() @IsString() @MaxLength(300) @Matches(INTERNO, { message: 'El enlace del botón debe ser interno (empieza con /)' }) boton_enlace?: string | null;
  @IsOptional() @IsObject() detalle?: Record<string, unknown> | null;
  @IsOptional() @IsIn(COLORES as unknown as string[]) color?: string;
  @IsOptional() @IsString() desde?: string | null;
  @IsOptional() @IsString() hasta?: string | null;
  @IsOptional() @IsString() @Matches(HHMM) franja_desde?: string | null;
  @IsOptional() @IsString() @Matches(HHMM) franja_hasta?: string | null;
  @IsOptional() @IsArray() @IsInt({ each: true }) @Min(0, { each: true }) @Max(6, { each: true }) dias_semana?: number[];
  @IsOptional() @IsIn(FRECUENCIAS as unknown as string[]) frecuencia?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(10) veces_por_dia?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(720) cada_horas?: number | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(120) cierre_segundos?: number;
  @IsOptional() @IsBoolean() puede_cerrar?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000) prioridad?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class ActivoAnuncioDto {
  @IsBoolean() activo!: boolean;
}

export class EventoAnuncioDto {
  @IsIn(TIPOS_EVENTO as unknown as string[]) tipo!: string;
}
