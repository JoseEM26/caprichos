import { calcularMetricasRuta, COORDENADAS_TIENDA_DEFECTO, type RutaCalculada } from './calculoRuta';
import type { PedidoSeguimiento } from './repartosApi';

/** Fase visible del pedido para quien despacha: define el color del pin y de la tarjeta. */
export type FaseDespacho = 'cocina' | 'porSalir' | 'enCamino' | 'llego';

export const FASES: Record<FaseDespacho, { texto: string; color: string }> = {
  cocina: { texto: 'En cocina', color: '#6B7C86' },
  porSalir: { texto: 'Por salir', color: '#E67929' },
  enCamino: { texto: 'En camino', color: '#2563EB' },
  llego: { texto: 'Llegó', color: '#2E8B57' },
};

export interface PedidoDespacho {
  pedido: PedidoSeguimiento;
  /** Número 1, 2, 3… igual en el pin y en la tarjeta (orden de urgencia). */
  numero: number;
  fase: FaseDespacho;
}

export function faseDe(p: PedidoSeguimiento): FaseDespacho {
  if (p.seccion === 'PREPARACION') return 'cocina';
  if (p.etapa === 'LLEGADO') return 'llego';
  if (p.etapa === 'EN_CAMINO') return 'enCamino';
  return 'porSalir';
}

const esVivo = (p: PedidoSeguimiento) => p.seccion === 'PREPARACION' || p.seccion === 'ESPERANDO' || p.seccion === 'EN_CAMINO';

/** Pedidos vivos de delivery, del que más espera al que menos, numerados. */
export function pedidosDespacho(pedidos: PedidoSeguimiento[]): PedidoDespacho[] {
  return pedidos
    .filter(esVivo)
    .sort((a, b) => b.minutosEspera - a.minutosEspera || a.codigo.localeCompare(b.codigo))
    .map((pedido, i) => ({ pedido, numero: i + 1, fase: faseDe(pedido) }));
}

export interface ResumenDespacho {
  enCocina: number;
  porSalir: number;
  enCamino: number;
  llegaron: number;
  sinRepartidor: number;
}

export function contarDespacho(lista: PedidoDespacho[]): ResumenDespacho {
  const n = (f: FaseDespacho) => lista.filter((d) => d.fase === f).length;
  return {
    enCocina: n('cocina'),
    porSalir: n('porSalir'),
    enCamino: n('enCamino'),
    llegaron: n('llego'),
    sinRepartidor: lista.filter((d) => d.fase !== 'cocina' && !d.pedido.repartidor_party_id).length,
  };
}

/** Ruta de varias paradas en el orden numerado: distancia, tiempo y enlace a Google Maps. Null si ninguna parada tiene ubicación. */
export function rutaDespacho(lista: PedidoDespacho[], velocidadKmH?: number): (RutaCalculada & { numeros: number[] }) | null {
  // ponytail: Google Maps admite 9 paradas intermedias + destino; más de 10 se recorta
  const conUbicacion = lista.filter((d) => d.pedido.lat != null && d.pedido.lng != null).slice(0, 10);
  if (conUbicacion.length === 0) return null;
  const r = calcularMetricasRuta(
    conUbicacion.map((d) => ({
      id: d.pedido.id,
      codigo: d.pedido.codigo,
      cliente_nombre: d.pedido.cliente_nombre,
      lat: d.pedido.lat!,
      lng: d.pedido.lng!,
      minutosEspera: d.pedido.minutosEspera,
    })),
    COORDENADAS_TIENDA_DEFECTO,
    velocidadKmH,
  );
  return { ...r, numeros: conUbicacion.map((d) => d.numero) };
}
