import { BadRequestException } from '@nestjs/common';
import {
  CLAVE_MEDIOS_PAGO_CANAL,
  NOMBRE_MEDIO_PAGO,
  canalMedioPago,
  medioActivo,
  normalizarMediosPagoCanal,
  normalizarPresentacionMedios,
  CLAVE_MEDIOS_PAGO_PRESENTACION,
  type PresentacionMedios,
  type MediosPagoPorCanal,
  type MedioPagoCanal,
} from '@caprichos/compartido';

/** Cualquier cliente de Prisma (o transacción) que lea `parametro`. Sin parametro (mocks) = valores de fábrica. */
type DbParametro = {
  parametro?: { findUnique?: (a: any) => Promise<{ valor: unknown } | null | undefined> };
  voucherPago?: { findMany?: (a: any) => Promise<Array<{ medio: string | null }>> };
};

/** Medios con comprobante (foto) posible: un voucher sin medio cubre a cualquiera de estos. */
const MEDIOS_CON_VOUCHER = ['YAPE', 'PLIN', 'TRANSFERENCIA', 'TARJETA'];

/** Configuración por canal, completa (lo que falta toma el valor de fábrica). Única lectura del parámetro. */
export async function leerMediosPagoCanal(db: DbParametro): Promise<MediosPagoPorCanal> {
  const p = await db.parametro?.findUnique?.({ where: { clave: CLAVE_MEDIOS_PAGO_CANAL } });
  return normalizarMediosPagoCanal(p?.valor);
}

/** Orden, tamaño e insignia de los medios (completo; sin parámetro, valores de fábrica). */
export async function leerPresentacionMedios(db: DbParametro): Promise<PresentacionMedios> {
  const p = await db.parametro?.findUnique?.({ where: { clave: CLAVE_MEDIOS_PAGO_PRESENTACION } });
  return normalizarPresentacionMedios(p?.valor);
}

/**
 * «Apagado es apagado»: lanza 400 si algún medio está apagado en el canal (para nadie, ni ADMIN).
 * Canal sin interruptor (repartidor, etc.): no filtra. Sirve para un medio o para todos los del plan dividido.
 * Con `pedidoId`, lo YA PAGADO se confirma aunque el medio se haya apagado: si el pedido tiene un comprobante (voucher vigente y legible: un ILEGIBLE o retirado no cuenta)
 * de ese medio, ese medio no se rechaza. El interruptor frena solo pagos NUEVOS, sin evidencia previa.
 */
export async function exigirMediosActivos(
  db: DbParametro,
  medios: Array<string | null | undefined>,
  canal: string | null | undefined,
  pedidoId?: bigint | null,
): Promise<void> {
  if (!canalMedioPago(canal)) return;
  const pedidos = medios.map((m) => String(m ?? '').trim().toUpperCase()).filter(Boolean);
  if (pedidos.length === 0) return;
  const config = await leerMediosPagoCanal(db);
  let conEvidencia: Set<string> | null = null;
  for (const m of pedidos) {
    if (!medioActivo(config, m, canal)) {
      if (pedidoId != null && MEDIOS_CON_VOUCHER.includes(m)) {
        if (!conEvidencia) {
          const v = (await db.voucherPago?.findMany?.({ where: { pedido_id: pedidoId, reemplazado_en: null, retirado: false, semaforo: { not: 'ILEGIBLE' } }, select: { medio: true } })) ?? [];
          conEvidencia = new Set(v.flatMap((x) => (x.medio ? [String(x.medio).toUpperCase()] : MEDIOS_CON_VOUCHER)));
        }
        if (conEvidencia.has(m)) continue;
      }
      const nombre = NOMBRE_MEDIO_PAGO[m as MedioPagoCanal] ?? m;
      throw new BadRequestException({ codigo: 'MEDIO_NO_DISPONIBLE', mensaje: `${nombre} no está disponible ahora` });
    }
  }
}
