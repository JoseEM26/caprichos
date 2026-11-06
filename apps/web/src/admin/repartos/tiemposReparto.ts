import { clasificarEspera } from './calculoRuta';

export interface TiemposPedido {
  creado_en: string | null;
  pasa_cocina_en?: string | null;
  listo_en?: string | null;
  tomado_en?: string | null;
  salio_en?: string | null;
  llego_en?: string | null;
  entregado_en?: string | null;
  espera_max_min?: number | null;
}

export interface PasoTiempo {
  id: string;
  texto: string;
  /** ISO del paso, o null si todavía no ocurrió */
  en: string | null;
  /** Hora local de Lima (HH:MM) o null */
  hora: string | null;
  /** Minutos desde que el pedido llegó a la tienda hasta este paso */
  minDesdePedido: number | null;
}

const PASOS: Array<[string, string, keyof TiemposPedido]> = [
  ['creado', 'Pedido recibido en la tienda', 'creado_en'],
  ['cocina', 'Pasó a cocina', 'pasa_cocina_en'],
  ['listo', 'Listo', 'listo_en'],
  ['tomado', 'Tomado por el repartidor', 'tomado_en'],
  ['salio', 'Salió (en camino)', 'salio_en'],
  ['llego', 'Llegó a la puerta', 'llego_en'],
  ['entregado', 'Entregado', 'entregado_en'],
];

export function horaLimaCorta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Lima' });
}

const minutosEntre = (desde: string | null | undefined, hasta: number): number | null => {
  if (!desde) return null;
  const t = new Date(desde).getTime();
  return isNaN(t) ? null : Math.max(0, Math.floor((hasta - t) / 60000));
};

/** Línea de tiempo: cada paso con su hora y los minutos desde que el pedido llegó a la tienda. */
export function pasosDeTiempo(t: TiemposPedido): PasoTiempo[] {
  const base = t.creado_en ? new Date(t.creado_en).getTime() : NaN;
  return PASOS.map(([id, texto, campo]) => {
    const en = (t[campo] as string | null | undefined) ?? null;
    const ms = en ? new Date(en).getTime() : NaN;
    return {
      id,
      texto,
      en,
      hora: horaLimaCorta(en),
      minDesdePedido: en && !isNaN(base) && !isNaN(ms) ? Math.max(0, Math.round((ms - base) / 60000)) : null,
    };
  });
}

export interface ContadorVivo {
  id: 'total' | 'tomado' | 'salio' | 'puerta';
  titulo: string;
  minutos: number;
  /** Semáforo existente (clasificarEspera); la espera en puerta se pone roja al llegar a la espera máxima */
  colorHex: string;
  etiqueta: string;
  /** El contador ya se detuvo (pedido entregado) */
  detenido: boolean;
  /** Solo en puerta: espera máxima configurada */
  maximo?: number;
}

/** Contadores en vivo: desde que llegó a la tienda, desde que lo tomó, desde que salió y la espera en la puerta. */
export function contadoresVivos(t: TiemposPedido, ahora: number): ContadorVivo[] {
  const fin = t.entregado_en ? new Date(t.entregado_en).getTime() : ahora;
  const detenido = !!t.entregado_en;
  const lista: ContadorVivo[] = [];
  const nivel = (min: number) => {
    const n = clasificarEspera(min);
    return { colorHex: n.colorHex, label: n.nivel === 'normal' ? 'A tiempo' : n.label };
  };
  const total = minutosEntre(t.creado_en, fin);
  if (total != null) lista.push({ id: 'total', titulo: 'Desde que llegó a la tienda', minutos: total, colorHex: nivel(total).colorHex, etiqueta: nivel(total).label, detenido });
  const tomado = minutosEntre(t.tomado_en, fin);
  if (tomado != null) lista.push({ id: 'tomado', titulo: 'Desde que lo tomó', minutos: tomado, colorHex: nivel(tomado).colorHex, etiqueta: nivel(tomado).label, detenido });
  const salio = minutosEntre(t.salio_en, fin);
  if (salio != null) lista.push({ id: 'salio', titulo: 'Desde que salió', minutos: salio, colorHex: nivel(salio).colorHex, etiqueta: nivel(salio).label, detenido });
  const puerta = minutosEntre(t.llego_en, fin);
  if (puerta != null) {
    const max = t.espera_max_min ?? null;
    const agotada = max != null && puerta >= max;
    lista.push({
      id: 'puerta',
      titulo: 'Esperando en la puerta',
      minutos: puerta,
      colorHex: agotada ? '#C4412B' : '#2E8B57',
      etiqueta: agotada ? 'Espera agotada' : 'En espera',
      detenido,
      ...(max != null ? { maximo: max } : {}),
    });
  }
  return lista;
}
