/**
 * Medios de pago activables por canal. UNA sola fuente para carta, Caja, mozo, bot y servidor.
 * Parámetro `medios_pago_canal` = { CARTA: { EFECTIVO: true, ... }, CAJA: {...}, MOZO: {...}, BOT: {...} }.
 * Lo que falta en el parámetro toma el valor de fábrica: todo lo que ya existía queda encendido y
 * PAGO_EN_LINEA (pasarela) apagado.
 */
export const MEDIOS_PAGO_CANAL = ['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA', 'PAGO_EN_LINEA'] as const;
export const CANALES_MEDIO_PAGO = ['CARTA', 'CAJA', 'MOZO', 'BOT'] as const;
export type MedioPagoCanal = (typeof MEDIOS_PAGO_CANAL)[number];
export type CanalMedioPago = (typeof CANALES_MEDIO_PAGO)[number];
export type MediosPagoPorCanal = Record<CanalMedioPago, Record<MedioPagoCanal, boolean>>;

export const NOMBRE_MEDIO_PAGO: Record<MedioPagoCanal, string> = {
  EFECTIVO: 'Efectivo',
  YAPE: 'Yape',
  PLIN: 'Plin',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  PAGO_EN_LINEA: 'Pago en línea',
};

export const CLAVE_MEDIOS_PAGO_CANAL = 'medios_pago_canal';

export function mediosPagoPorDefecto(): MediosPagoPorCanal {
  const r = {} as MediosPagoPorCanal;
  for (const c of CANALES_MEDIO_PAGO) {
    r[c] = {} as Record<MedioPagoCanal, boolean>;
    for (const m of MEDIOS_PAGO_CANAL) r[c][m] = m !== 'PAGO_EN_LINEA';
  }
  return r;
}

/** Canal del pedido (WHATSAPP cuenta como BOT). null = canal sin interruptor (p. ej. repartidor): no se filtra. */
export function canalMedioPago(canal: string | null | undefined): CanalMedioPago | null {
  const c = String(canal ?? '').toUpperCase();
  if (c === 'WHATSAPP') return 'BOT';
  return (CANALES_MEDIO_PAGO as readonly string[]).includes(c) ? (c as CanalMedioPago) : null;
}

/** Completa lo que falte con los valores de fábrica; solo un booleano explícito cambia el valor. */
export function normalizarMediosPagoCanal(valor: unknown): MediosPagoPorCanal {
  const r = mediosPagoPorDefecto();
  if (!valor || typeof valor !== 'object') return r;
  for (const c of CANALES_MEDIO_PAGO) {
    const fila = (valor as Record<string, unknown>)[c];
    if (!fila || typeof fila !== 'object') continue;
    for (const m of MEDIOS_PAGO_CANAL) {
      const v = (fila as Record<string, unknown>)[m];
      if (typeof v === 'boolean') r[c][m] = v;
    }
  }
  return r;
}

/** ¿El medio está encendido en el canal? Canal sin interruptor: sí. Medio desconocido: no. */
export function medioActivo(config: unknown, medio: string | null | undefined, canal: string | null | undefined): boolean {
  const m = String(medio ?? '').trim().toUpperCase() as MedioPagoCanal;
  if (!(MEDIOS_PAGO_CANAL as readonly string[]).includes(m)) return false;
  const c = canalMedioPago(canal);
  if (!c) return true;
  return normalizarMediosPagoCanal(config)[c][m];
}

/** Medios encendidos del canal, en el orden de MEDIOS_PAGO_CANAL. */
export function mediosActivos(config: unknown, canal: string | null | undefined): MedioPagoCanal[] {
  const c = canalMedioPago(canal);
  if (!c) return [...MEDIOS_PAGO_CANAL];
  const n = normalizarMediosPagoCanal(config)[c];
  return MEDIOS_PAGO_CANAL.filter((m) => n[m]);
}

/** «pagando con Yape» / «pagando con Yape o Plin» / «pagando con Efectivo, Yape o Plin»; '' si la promo vale con cualquier medio. */
export function textoCondicionMedios(medios: ReadonlyArray<string> | null | undefined): string {
  const n = (medios ?? []).map((m) => NOMBRE_MEDIO_PAGO[String(m).toUpperCase() as MedioPagoCanal] ?? m);
  if (n.length === 0) return '';
  const lista = n.length === 1 ? n[0] : `${n.slice(0, -1).join(', ')} o ${n[n.length - 1]}`;
  return `pagando con ${lista}`;
}
