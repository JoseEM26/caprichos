/**
 * La ruta como unidad: una salida del repartidor con los pedidos que tomó. Se crea (o se suma) al tomar
 * y se cierra sola cuando todos sus pedidos llegan a un estado final. Los pedidos conservan
 * pedido.ruta_reparto_id al entregarse o fallar, así la ruta se sigue viendo completa hasta cerrarse.
 */
export type OrigenRuta = 'TOMAR_RUTA' | 'SUGERIDA' | 'INDIVIDUAL';
export type EstadoFinalPedido = 'ENTREGADO' | 'NO_ENTREGADO' | 'ANULADO';

/** Estados en que el pedido sigue pendiente dentro de la ruta de su repartidor. */
const PENDIENTES = ['LISTO', 'EN_CAMINO'];

/** Suma los pedidos a la ruta EN_CURSO del repartidor; si no tiene, crea una. `db` es prisma o una transacción. */
export async function sumarARuta(
  db: any,
  partyId: bigint,
  pedidoIds: bigint[],
  origen: OrigenRuta,
  ahora: Date,
): Promise<bigint | null> {
  if (pedidoIds.length === 0) return null;
  const actual = await db.rutaReparto.findFirst({
    where: { repartidor_party_id: partyId, estado: 'EN_CURSO' },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  const rutaId: bigint =
    actual?.id ??
    (
      await db.rutaReparto.create({
        data: { repartidor_party_id: partyId, iniciada_en: ahora, estado: 'EN_CURSO', origen },
        select: { id: true },
      })
    ).id;
  await db.pedido.updateMany({
    where: { id: { in: pedidoIds }, repartidor_party_id: partyId },
    data: { ruta_reparto_id: rutaId },
  });
  return rutaId;
}

/**
 * Cierra la ruta EN_CURSO del repartidor si ya no le quedan pedidos pendientes (TERMINADA, terminada_en).
 * Si la ruta quedó sin ningún pedido (se liberaron todos antes de salir) se borra: no hubo ruta.
 * Devuelve el id de la ruta que se cerró, o null si sigue en curso o no había.
 */
export async function sincronizarRuta(db: any, partyId: bigint, ahora: Date = new Date()): Promise<bigint | null> {
  const ruta = await db.rutaReparto.findFirst({
    where: { repartidor_party_id: partyId, estado: 'EN_CURSO' },
    orderBy: { id: 'desc' },
    select: { id: true },
  });
  if (!ruta) return null;
  const pendientes = await db.pedido.count({
    where: { ruta_reparto_id: ruta.id, repartidor_party_id: partyId, estado: { in: PENDIENTES } },
  });
  if (pendientes > 0) return null;
  const total = await db.pedido.count({ where: { ruta_reparto_id: ruta.id } });
  if (total === 0) {
    await db.rutaReparto.delete({ where: { id: ruta.id } });
    return null;
  }
  await db.rutaReparto.update({ where: { id: ruta.id }, data: { estado: 'TERMINADA', terminada_en: ahora } });
  return ruta.id;
}

/**
 * Tras anular un pedido que tenía repartidor: cierra la ruta si ya no quedan LISTO/EN_CAMINO y avisa a Repartos/Caja.
 * Nunca lanza: un fallo se registra y la anulación sigue (la ruta se corrige al recargar «Mis pedidos»).
 */
export async function cerrarRutaTrasAnular(
  db: any,
  repartidorPartyId: bigint | null | undefined,
  eventos?: { emitirAdmin(evento: string, datos: unknown): void },
  log?: { error(m: string): void },
): Promise<void> {
  if (repartidorPartyId == null) return;
  try {
    await sincronizarRuta(db, BigInt(repartidorPartyId));
    eventos?.emitirAdmin('reparto:rutas', {});
  } catch (e) {
    log?.error(`Anulado, pero no se pudo sincronizar la ruta del repartidor ${repartidorPartyId}: ${String(e)}`);
  }
}

/** Estado final de un pedido de la ruta, o null si todavía está pendiente con su repartidor. */
export function estadoFinalEnRuta(
  p: { estado: string; anulado_en?: Date | null; repartidor_party_id?: bigint | null },
  partyId: bigint,
): EstadoFinalPedido | null {
  if (p.estado === 'ENTREGADO') return 'ENTREGADO';
  if (p.estado === 'ANULADO' || p.anulado_en != null) return 'ANULADO';
  if (p.repartidor_party_id != null && BigInt(p.repartidor_party_id) === partyId && PENDIENTES.includes(p.estado)) {
    return null;
  }
  return 'NO_ENTREGADO';
}

/** Hora en que el pedido llegó a su estado final (el entregado, el anulado o el último incidente de falla). */
export function horaFinalPedido(p: any, estadoFinal: EstadoFinalPedido | null): Date | null {
  if (estadoFinal === 'ENTREGADO') return p.entregado_en ?? null;
  if (estadoFinal === 'ANULADO') return p.anulado_en ?? null;
  if (estadoFinal === 'NO_ENTREGADO') return p.incidentes?.[0]?.en ?? null;
  return null;
}

/** Límites del día (hora de Lima, UTC-5 sin horario de verano) de una fecha YYYY-MM-DD. */
export function limitesDiaLima(desde: string, hasta: string): { inicio: Date; fin: Date } {
  return { inicio: new Date(`${desde}T00:00:00-05:00`), fin: new Date(`${hasta}T23:59:59.999-05:00`) };
}

/** Fecha de hoy en Lima como YYYY-MM-DD. */
export function hoyLima(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(ahora);
}
