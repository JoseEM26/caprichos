import { BadRequestException } from '@nestjs/common';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { finDiaLimaIso, hoyLimaIso, inicioDiaLimaIso } from '../../../comun/fechas-lima';

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Valores reales de los CHECK ck_pedido_canal y ck_pedido_modalidad. */
export const CANALES_INDICADORES: string[] = ['CARTA', 'BOT', 'TELEFONO', 'MOSTRADOR', 'MOZO', 'CAJA', 'WHATSAPP'];
export const MODALIDADES_INDICADORES: string[] = ['MESA', 'RECOGER', 'LLEVAR', 'COMER_LOCAL', 'DELIVERY'];
export const MAX_DIAS_INDICADORES = 366;

/** Filtros generales de Indicadores y Encuestas. Todos opcionales: sin ellos el cálculo es el de siempre. */
export class FiltroIndicadoresDto {
  @IsOptional()
  @Matches(FECHA_ISO, { message: 'desde debe ser YYYY-MM-DD' })
  desde?: string;

  @IsOptional()
  @Matches(FECHA_ISO, { message: 'hasta debe ser YYYY-MM-DD' })
  hasta?: string;

  @IsOptional()
  @IsIn(CANALES_INDICADORES)
  canal?: string;

  @IsOptional()
  @IsIn(MODALIDADES_INDICADORES)
  modalidad?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  categoria?: string;
}

/** Rango [inicio, fin] en hora de Lima, o null si no se pidió ninguna fecha. Valida orden y máximo de 366 días. */
export function rangoIndicadores(f: { desde?: string; hasta?: string }): { desde: string; hasta: string; inicio: Date; fin: Date } | null {
  if (!f.desde && !f.hasta) return null;
  const desde = f.desde || f.hasta!;
  const hasta = f.hasta || hoyLimaIso();
  const inicio = inicioDiaLimaIso(desde);
  const fin = finDiaLimaIso(hasta);
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) {
    throw new BadRequestException({ codigo: 'FECHA_INVALIDA', mensaje: 'Fecha no válida' });
  }
  if (desde > hasta) throw new BadRequestException({ codigo: 'RANGO_INVALIDO', mensaje: '«Desde» es posterior a «Hasta»' });
  if ((fin.getTime() - inicio.getTime()) / 86_400_000 > MAX_DIAS_INDICADORES) {
    throw new BadRequestException({ codigo: 'RANGO_MUY_GRANDE', mensaje: 'El rango máximo es de 366 días' });
  }
  return { desde, hasta, inicio, fin };
}
