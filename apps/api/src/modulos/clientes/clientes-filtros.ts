import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';
import { diaCalendarioLima, finDiaLimaIso, inicioDiaLimaIso, sumarDiasIso } from '../../comun/fechas-lima';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Filtros de Admin › Clientes. Los usan el listado, la exportación a Excel y los participantes del sorteo:
 * los tres reciben exactamente los mismos parámetros. Todo es opcional y se combina.
 */
export class FiltrosClientesDto {
  @IsOptional() @IsString() q?: string;
  @IsOptional() @IsString() tipo?: string;
  @IsOptional() @IsString() estado?: string;
  @IsOptional() @IsString() creditoPersonal?: string;
  @IsOptional() @IsIn(['verificados', 'sin_verificar', 'todos']) verificacion?: 'verificados' | 'sin_verificar' | 'todos';
  @IsOptional() @IsIn(['si', 'no']) gastaPuntos?: 'si' | 'no';

  /** Rango de fechas de los pedidos que se cuentan: hoy, semana (lunes a hoy), mes (1 al hoy) o siempre. */
  @IsOptional() @IsIn(['hoy', 'semana', 'mes', 'siempre']) periodo?: 'hoy' | 'semana' | 'mes' | 'siempre';
  /** Rango propio (AAAA-MM-DD, día de Lima). Si viene, manda sobre «periodo». */
  @IsOptional() @Matches(FECHA) desde?: string;
  @IsOptional() @Matches(FECHA) hasta?: string;

  /** Pedidos cobrados dentro del rango */
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) pedidosMin?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) pedidosMax?: number;
  /** Consumo en soles (suma del total de esos pedidos) */
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) consumoMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) consumoMax?: number;
  /** Saldo de puntos de hoy */
  @IsOptional() @Type(() => Number) @IsNumber() puntosMin?: number;
  @IsOptional() @Type(() => Number) @IsNumber() puntosMax?: number;
  @IsOptional() @IsIn(['si', 'no']) conPuntos?: 'si' | 'no';
  /** Clientes dormidos: compraron alguna vez, pero su última compra fue hace más de N días */
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) sinCompraDias?: number;
  /** Cumpleaños en el mes actual (Lima) */
  @IsOptional() @IsIn(['si']) cumpleMes?: 'si';
  /** Solo cuentan los pedidos de ese canal */
  @IsOptional() @IsIn(['CARTA', 'WHATSAPP', 'CAJA', 'MOZO']) canal?: 'CARTA' | 'WHATSAPP' | 'CAJA' | 'MOZO';

  @IsOptional() @IsIn(['reciente', 'pedidos', 'consumo', 'puntos', 'ultima', 'nombre']) orden?: 'reciente' | 'pedidos' | 'consumo' | 'puntos' | 'ultima' | 'nombre';

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) pagina?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) limite?: number;
}

export type FiltrosClientes = FiltrosClientesDto;

/** Rango [desde, hasta] de instantes según el periodo o las fechas propias. Sin rango = desde siempre. */
export function rangoPedidos(f: Pick<FiltrosClientes, 'periodo' | 'desde' | 'hasta'>, ahora: Date = new Date()): { desde?: Date; hasta?: Date } {
  if (f.desde || f.hasta) {
    return { desde: f.desde ? inicioDiaLimaIso(f.desde) : undefined, hasta: f.hasta ? finDiaLimaIso(f.hasta) : undefined };
  }
  const hoy = diaCalendarioLima(ahora);
  if (f.periodo === 'hoy') return { desde: inicioDiaLimaIso(hoy) };
  if (f.periodo === 'semana') {
    const diaSemana = new Date(`${hoy}T12:00:00-05:00`).getUTCDay(); // 0 = domingo
    const atras = (diaSemana + 6) % 7; // lunes = 0
    return { desde: inicioDiaLimaIso(sumarDiasIso(hoy, -atras)) };
  }
  if (f.periodo === 'mes') return { desde: inicioDiaLimaIso(`${hoy.slice(0, 7)}-01`) };
  return {};
}

/** Mes actual en Lima (1 a 12) */
export const mesLima = (ahora: Date = new Date()): number => Number(diaCalendarioLima(ahora).slice(5, 7));

/** «María García López» → «María G.» (nombre y la inicial del primer apellido; nunca el nombre completo). */
export function nombreParaSorteo(nombres: string, apellidos?: string | null): string {
  const partes = String(nombres ?? '').trim().split(/\s+/).filter(Boolean);
  const primero = partes[0] ?? 'Cliente';
  const ap = String(apellidos ?? '').trim().split(/\s+/).filter(Boolean)[0] ?? partes[1];
  return ap ? `${primero} ${ap[0].toUpperCase()}.` : primero;
}

/** Últimos 3 dígitos del celular: «···123». Sin celular válido, «···». */
export function detalleCelularSorteo(telefono: string): string {
  const d = String(telefono ?? '').replace(/\D/g, '');
  return d.length >= 3 ? `···${d.slice(-3)}` : '···';
}
