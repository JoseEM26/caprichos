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

/**
 * Completa lo que falte con los valores de fábrica; solo un booleano explícito cambia el valor.
 * PAGO_EN_LINEA (Culqi) vive solo en CARTA: en CAJA, MOZO y BOT se fuerza a false aunque venga true.
 */
export function normalizarMediosPagoCanal(valor: unknown): MediosPagoPorCanal {
  const r = mediosPagoPorDefecto();
  if (!valor || typeof valor !== 'object') return r;
  for (const c of CANALES_MEDIO_PAGO) {
    const fila = (valor as Record<string, unknown>)[c];
    if (!fila || typeof fila !== 'object') continue;
    for (const m of MEDIOS_PAGO_CANAL) {
      const v = (fila as Record<string, unknown>)[m];
      if (typeof v !== 'boolean') continue;
      r[c][m] = m === 'PAGO_EN_LINEA' && c !== 'CARTA' ? false : v;
    }
  }
  return r;
}

/**
 * ¿El medio está encendido en el canal? Canal sin interruptor: sí (salvo PAGO_EN_LINEA). Medio desconocido: no.
 * PAGO_EN_LINEA solo mira CARTA: es el único canal donde existe.
 */
export function medioActivo(config: unknown, medio: string | null | undefined, canal: string | null | undefined): boolean {
  const m = String(medio ?? '').trim().toUpperCase() as MedioPagoCanal;
  if (!(MEDIOS_PAGO_CANAL as readonly string[]).includes(m)) return false;
  const c = canalMedioPago(canal);
  if (m === 'PAGO_EN_LINEA') return c === 'CARTA' && normalizarMediosPagoCanal(config).CARTA.PAGO_EN_LINEA;
  if (!c) return true;
  return normalizarMediosPagoCanal(config)[c][m];
}

/** Medios encendidos del canal, en el orden de MEDIOS_PAGO_CANAL. */
export function mediosActivos(config: unknown, canal: string | null | undefined): MedioPagoCanal[] {
  const c = canalMedioPago(canal);
  if (!c) return MEDIOS_PAGO_CANAL.filter((m) => m !== 'PAGO_EN_LINEA');
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

/**
 * Presentación de los medios de pago (cómo se ven y en qué orden): parámetro `medios_pago_presentacion`.
 * Misma función para carta, Caja y mozo. Sin parámetro: Yape, Plin, Efectivo, Tarjeta, Transferencia y Culqi al final,
 * todo normal y sin insignia. CULQI solo se muestra en la carta (y solo si el pago en línea está encendido).
 */
export const MEDIOS_PRESENTACION = ['YAPE', 'PLIN', 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'CULQI'] as const;
export type MedioPresentacion = (typeof MEDIOS_PRESENTACION)[number];
export type TamanoMedio = 'normal' | 'grande';
export interface PresentacionMedio {
  orden: number;
  tamano: TamanoMedio;
  insignia: string | null;
}
export type PresentacionMedios = Record<MedioPresentacion, PresentacionMedio>;

export const CLAVE_MEDIOS_PAGO_PRESENTACION = 'medios_pago_presentacion';
export const INSIGNIA_MAX = 14;
export const INSIGNIAS_SUGERIDAS = ['Nuevo', 'Recomendado', 'Al toque'] as const;

export const NOMBRE_MEDIO_PRESENTACION: Record<MedioPresentacion, string> = {
  YAPE: 'Yape',
  PLIN: 'Plin',
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  CULQI: 'Tarjeta / Yape en línea',
};

export function presentacionPorDefecto(): PresentacionMedios {
  const r = {} as PresentacionMedios;
  MEDIOS_PRESENTACION.forEach((m, i) => {
    r[m] = { orden: i + 1, tamano: 'normal', insignia: null };
  });
  return r;
}

/** Texto de insignia sin HTML ni espacios de más y de hasta 14 caracteres; null si queda vacío. */
export function sanearInsignia(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, INSIGNIA_MAX).trim();
  return t || null;
}

/** Completa con los valores de fábrica; lo inválido de un medio vuelve a su valor de fábrica. Nunca lanza. */
export function normalizarPresentacionMedios(valor: unknown): PresentacionMedios {
  const r = presentacionPorDefecto();
  if (!valor || typeof valor !== 'object') return r;
  for (const m of MEDIOS_PRESENTACION) {
    const f = (valor as Record<string, unknown>)[m];
    if (!f || typeof f !== 'object') continue;
    const { orden, tamano, insignia } = f as Record<string, unknown>;
    if (typeof orden === 'number' && Number.isInteger(orden) && orden >= 0 && orden <= 999) r[m].orden = orden;
    if (tamano === 'normal' || tamano === 'grande') r[m].tamano = tamano;
    r[m].insignia = sanearInsignia(insignia);
  }
  return r;
}

/** Mensaje de error si el valor a guardar no es válido (para el servidor); null si está bien. */
export function errorPresentacionMedios(valor: unknown): string | null {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor)) return 'La presentación debe ser un objeto por medio de pago';
  for (const [m, f] of Object.entries(valor as Record<string, unknown>)) {
    if (!(MEDIOS_PRESENTACION as readonly string[]).includes(m)) return `Medio de pago desconocido: ${m}`;
    if (!f || typeof f !== 'object' || Array.isArray(f)) return `${m}: debe llevar orden, tamaño e insignia`;
    const { orden, tamano, insignia } = f as Record<string, unknown>;
    if (typeof orden !== 'number' || !Number.isInteger(orden) || orden < 0 || orden > 999) return `${m}: el orden es un número entero de 0 a 999`;
    if (tamano !== 'normal' && tamano !== 'grande') return `${m}: el tamaño es normal o grande`;
    if (insignia !== null && insignia !== undefined) {
      if (typeof insignia !== 'string' || insignia.length > INSIGNIA_MAX || /[<>]/.test(insignia)) return `${m}: la insignia es texto corto (máx ${INSIGNIA_MAX} letras) sin símbolos < >`;
    }
  }
  return null;
}

/** Ordena ids de medios según la presentación (empates y desconocidos: orden de fábrica, desconocidos al final). */
export function ordenarMediosPresentacion<T extends string>(ids: ReadonlyArray<T>, presentacion: unknown): T[] {
  const p = normalizarPresentacionMedios(presentacion);
  const pos = (id: string) => {
    const i = (MEDIOS_PRESENTACION as readonly string[]).indexOf(id.toUpperCase());
    return i < 0 ? { o: 1e6, i: 0 } : { o: p[MEDIOS_PRESENTACION[i]].orden, i };
  };
  return [...ids].sort((a, b) => pos(a).o - pos(b).o || pos(a).i - pos(b).i);
}

/** Presentación de un medio (el desconocido toma un medio normal sin insignia). */
export function presentacionDeMedio(presentacion: unknown, medio: string): PresentacionMedio {
  const m = String(medio).toUpperCase();
  return (MEDIOS_PRESENTACION as readonly string[]).includes(m)
    ? normalizarPresentacionMedios(presentacion)[m as MedioPresentacion]
    : { orden: 999, tamano: 'normal', insignia: null };
}
