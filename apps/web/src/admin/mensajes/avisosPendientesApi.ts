import { api } from '../../comun/api';

/** Aviso del pedido que el sistema no mandó solo y una persona puede enviar desde Mensajes (mensaje ya escrito). */
export interface AvisoPendiente {
  id: string;
  etapa: string;
  telefono: string;
  texto: string;
  motivo: string;
}

type Mapa = Record<string, AvisoPendiente[]>;

const VIGENCIA_MS = 20_000;
const cache = new Map<string, { en: number; avisos: AvisoPendiente[] }>();
let cola = new Map<string, Array<(a: AvisoPendiente[]) => void>>();
let programado = false;

/** Vacía la memoria (tras enviar o refrescar la lista). */
export const olvidarAvisosPendientes = () => cache.clear();

async function vaciar() {
  programado = false;
  const lote = cola;
  cola = new Map();
  let mapa: Mapa = {};
  try {
    mapa = await api.get<Mapa>(`/admin/whatsapp/avisos-pedido-pendientes?ids=${[...lote.keys()].join(',')}`);
  } catch {
    mapa = {};
  }
  const ahora = Date.now();
  for (const [id, esperando] of lote) {
    const avisos = mapa?.[id] ?? [];
    cache.set(id, { en: ahora, avisos });
    esperando.forEach((f) => f(avisos));
  }
}

/** Avisos pendientes de un pedido. Los pedidos que piden en el mismo instante (una lista de tarjetas) viajan en UNA sola consulta. */
export function avisosPendientesDe(pedidoId: string): Promise<AvisoPendiente[]> {
  const hit = cache.get(pedidoId);
  if (hit && Date.now() - hit.en < VIGENCIA_MS) return Promise.resolve(hit.avisos);
  return new Promise((resolver) => {
    cola.set(pedidoId, [...(cola.get(pedidoId) ?? []), resolver]);
    if (!programado) {
      programado = true;
      setTimeout(() => void vaciar(), 30);
    }
  });
}
