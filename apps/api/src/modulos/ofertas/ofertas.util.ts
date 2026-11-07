import { randomBytes } from 'crypto';

/**
 * Retorna la información de fecha, hora y día de la semana correspondiente a America/Lima (UTC-5).
 * Días de la semana según RN-CAP-132: 1 = Lunes .. 7 = Domingo.
 */
export function obtenerAhoraLima(fechaReferencia: Date = new Date()): {
  fechaIso: string;
  horaTexto: string;
  minutosDesdeMedianoche: number;
  diaSemana: number; // 1 = Lunes, 7 = Domingo
} {
  const formateadorFecha = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const fechaIso = formateadorFecha.format(fechaReferencia); // YYYY-MM-DD

  const formateadorHora = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Lima',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const horaTexto = formateadorHora.format(fechaReferencia); // HH:mm:ss

  const partes = horaTexto.split(':');
  const h = parseInt(partes[0] || '0', 10);
  const m = parseInt(partes[1] || '0', 10);
  const minutosDesdeMedianoche = h * 60 + m;

  // Para el día de la semana en Lima:
  const formateadorDia = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    weekday: 'short',
  });
  const diaSemanaTexto = formateadorDia.format(fechaReferencia); // Mon, Tue, Wed, Thu, Fri, Sat, Sun
  const mapaDias: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7,
  };
  const diaSemana = mapaDias[diaSemanaTexto] ?? 1;

  return {
    fechaIso,
    horaTexto,
    minutosDesdeMedianoche,
    diaSemana,
  };
}

/**
 * Convierte un campo de hora (@db.Time o string 'HH:mm') a minutos desde la medianoche.
 */
export function horaAMinutos(val: Date | string | null | undefined): number | null {
  if (!val) return null;
  if (val instanceof Date) {
    const h = val.getUTCHours();
    const m = val.getUTCMinutes();
    return h * 60 + m;
  }
  const str = String(val).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

/**
 * Formatea un valor Date o string a 'HH:mm' para respuestas y comparaciones.
 */
export function formatearHora(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    const h = String(val.getUTCHours()).padStart(2, '0');
    const m = String(val.getUTCMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
  const str = String(val).trim();
  const m = str.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return str;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
}

/**
 * Formatea una fecha @db.Date o string a 'YYYY-MM-DD'.
 */
export function formatearFecha(val: Date | string | null | undefined): string | null {
  if (!val) return null;
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  const m = str.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : str;
}

/** Canal de oferta que le toca a un pedido o consulta: carta web, local (caja, mozo, personal) o bot de WhatsApp. */
export type CanalOferta = 'CARTA' | 'ADMIN' | 'BOT';

export function canalOferta(canal: string): CanalOferta {
  const c = (canal ?? '').toUpperCase();
  if (c === 'CARTA' || c === 'WEB') return 'CARTA';
  if (c === 'WHATSAPP' || c === 'BOT') return 'BOT';
  return 'ADMIN';
}

/**
 * ¿Los canales guardados de una oferta (o cupón) incluyen este canal? Acepta los valores históricos:
 * CAJA/MOZO/LOCAL = ADMIN, WEB = CARTA, WHATSAPP = BOT. Vacío vale en carta y local, nunca en el bot.
 */
export function ofertaIncluyeCanal(canales: string[] | null | undefined, canal: CanalOferta): boolean {
  const norm = (canales ?? []).map((c) => c.toUpperCase());
  if (norm.length === 0) return canal !== 'BOT';
  if (canal === 'BOT') return norm.includes('BOT') || norm.includes('WHATSAPP');
  if (norm.includes('TODOS')) return true;
  const alias = canal === 'CARTA' ? ['CARTA', 'WEB'] : ['ADMIN', 'CAJA', 'MOZO', 'LOCAL'];
  return norm.some((c) => alias.includes(c));
}

/** Alta de oferta nueva: carta y local siempre; WhatsApp en los tipos que el bot aplica o arma (combos incluidos; cupones no). */
export const TIPOS_OFERTA_BOT_APLICA = ['DESCUENTO', 'LLEVA_PAGA', 'ENVIO_GRATIS', 'COMBO'] as const;
export function canalesPorDefecto(tipo: string): string[] {
  return (TIPOS_OFERTA_BOT_APLICA as readonly string[]).includes(tipo) ? ['CARTA', 'ADMIN', 'BOT'] : ['CARTA', 'ADMIN'];
}

/**
 * Evalúa si una oferta o descuento está vigente en este momento según:
 * - dias (1..7, RN-CAP-132)
 * - hora_desde (inclusiva) y hora_hasta (exclusiva)
 * - fecha_desde (inclusiva) y fecha_hasta (inclusiva)
 * - canales
 * - limite_usos
 */
export function estaVigente(
  oferta: {
    activo: boolean;
    dias?: number[] | null;
    hora_desde?: Date | string | null;
    hora_hasta?: Date | string | null;
    fecha_desde?: Date | string | null;
    fecha_hasta?: Date | string | null;
    canales?: string[] | null;
    limite_usos?: number | null;
    usos_actuales?: number | null;
  },
  canal?: string,
  ahora?: Date,
): boolean {
  if (!oferta.activo) return false;

  if (
    oferta.limite_usos !== null &&
    oferta.limite_usos !== undefined &&
    (oferta.usos_actuales ?? 0) >= oferta.limite_usos
  ) {
    return false;
  }

  const { fechaIso, minutosDesdeMedianoche, diaSemana } = obtenerAhoraLima(ahora);

  // Canal: UNA sola regla para carta, local (caja/mozo) y bot. «TODOS» no incluye WhatsApp: solo cuenta BOT explícito.
  if (canal && !ofertaIncluyeCanal(oferta.canales, canalOferta(canal))) return false;

  // Validar días de la semana
  if (oferta.dias && oferta.dias.length > 0 && oferta.dias.length < 7) {
    if (!oferta.dias.includes(diaSemana)) {
      return false;
    }
  }

  // Validar fechas (ambas inclusivas)
  const fDesde = formatearFecha(oferta.fecha_desde);
  if (fDesde && fechaIso < fDesde) {
    return false;
  }
  const fHasta = formatearFecha(oferta.fecha_hasta);
  if (fHasta && fechaIso > fHasta) {
    return false;
  }

  // Validar horas (desde inclusiva, hasta exclusiva)
  const hDesdeMin = horaAMinutos(oferta.hora_desde);
  const hHastaMin = horaAMinutos(oferta.hora_hasta);

  if (hDesdeMin !== null && hHastaMin !== null) {
    if (minutosDesdeMedianoche < hDesdeMin || minutosDesdeMedianoche >= hHastaMin) {
      return false;
    }
  } else if (hDesdeMin !== null) {
    if (minutosDesdeMedianoche < hDesdeMin) {
      return false;
    }
  } else if (hHastaMin !== null) {
    if (minutosDesdeMedianoche >= hHastaMin) {
      return false;
    }
  }

  return true;
}

/**
 * Genera un código aleatorio para cupón emitido no correlativo e impredecible (RN-CAP-133).
 * Ejemplo: base 'VUELVE15' -> 'V15-K7M2QX' o 'VUELVE15-K7M2QX'.
 */
export function generarCodigoCuponUnico(codigoBase: string): string {
  const caracteres = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // Excluye 0, 1, I, O para evitar confusión al leerlo impreso
  let sufijo = '';
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    sufijo += caracteres[bytes[i] % caracteres.length];
  }
  const baseLimpia = codigoBase.trim().toUpperCase();
  return `${baseLimpia}-${sufijo}`;
}

/** Categorías a las que alcanza una oferta: la lista nueva o, en filas antiguas, la categoría única. */
export function categoriasAlcance(o: {
  alcance_categoria_ids?: bigint[] | null;
  alcance_categoria_id?: bigint | null;
}): bigint[] {
  if (o.alcance_categoria_ids?.length) return o.alcance_categoria_ids;
  return o.alcance_categoria_id ? [o.alcance_categoria_id] : [];
}

/** Ids de categoría que manda el admin (lista o id único), sin repetidos ni vacíos. */
export function idsCategoriaDto(dto: { alcanceCategoriaIds?: (string | number)[] | null; alcanceCategoriaId?: string | number | null }): bigint[] {
  const crudos = dto.alcanceCategoriaIds ?? (dto.alcanceCategoriaId ? [dto.alcanceCategoriaId] : []);
  return [...new Set(crudos.filter((x) => x !== '' && x !== null && x !== undefined).map((x) => String(x)))].map((x) => BigInt(x));
}
