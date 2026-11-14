import { BadRequestException } from '@nestjs/common';
import {
  CLAVE_MEDIOS_PAGO_CANAL,
  NOMBRE_MEDIO_PAGO,
  canalMedioPago,
  medioActivo,
  normalizarMediosPagoCanal,
  type MediosPagoPorCanal,
  type MedioPagoCanal,
} from '@caprichos/compartido';

/** Cualquier cliente de Prisma (o transacción) que lea `parametro`. Sin parametro (mocks) = valores de fábrica. */
type DbParametro = { parametro?: { findUnique?: (a: any) => Promise<{ valor: unknown } | null | undefined> } };

/** Configuración por canal, completa (lo que falta toma el valor de fábrica). Única lectura del parámetro. */
export async function leerMediosPagoCanal(db: DbParametro): Promise<MediosPagoPorCanal> {
  const p = await db.parametro?.findUnique?.({ where: { clave: CLAVE_MEDIOS_PAGO_CANAL } });
  return normalizarMediosPagoCanal(p?.valor);
}

/**
 * «Apagado es apagado»: lanza 400 si algún medio está apagado en el canal (para nadie, ni ADMIN).
 * Canal sin interruptor (repartidor, etc.): no filtra. Sirve para un medio o para todos los del plan dividido.
 */
export async function exigirMediosActivos(db: DbParametro, medios: Array<string | null | undefined>, canal: string | null | undefined): Promise<void> {
  if (!canalMedioPago(canal)) return;
  const pedidos = medios.map((m) => String(m ?? '').trim().toUpperCase()).filter(Boolean);
  if (pedidos.length === 0) return;
  const config = await leerMediosPagoCanal(db);
  for (const m of pedidos) {
    if (!medioActivo(config, m, canal)) {
      const nombre = NOMBRE_MEDIO_PAGO[m as MedioPagoCanal] ?? m;
      throw new BadRequestException({ codigo: 'MEDIO_NO_DISPONIBLE', mensaje: `${nombre} no está disponible ahora` });
    }
  }
}
