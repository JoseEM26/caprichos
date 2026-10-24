export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface ConfigReparto {
  umbralRetrasadoMin: number;
  umbralTardeMin: number;
  umbralMuyTardeMin: number;
  velocidadMediaKmH: number;
  maxPedidosPorRepartidor: number;
}

export const CONFIG_REPARTO_DEFECTO: ConfigReparto = {
  umbralRetrasadoMin: 20,
  umbralTardeMin: 30,
  umbralMuyTardeMin: 45,
  velocidadMediaKmH: 20,
  maxPedidosPorRepartidor: 3,
};

export const COORDENADAS_TIENDA_DEFECTO: Coordenadas = {
  lat: -12.0196436,
  lng: -76.963255,
};

export type NivelEspera = 'normal' | 'retrasado' | 'tarde' | 'muy_tarde';
export type ColorEspera = 'verde' | 'amarillo' | 'naranja' | 'rojo';

export interface InfoNivelEspera {
  nivel: NivelEspera;
  color: ColorEspera;
  colorHex: string;
  label: string;
  palpitando: boolean;
}

/**
 * Clasifica los minutos de espera de un pedido según los 3 umbrales configurables
 * (Decisión 3 del dueño: verde < 20 min, amarillo «Retrasado» desde 20, naranja «Tarde» desde 30, rojo «Muy tarde» desde 45).
 */
export function clasificarEspera(
  minutosEspera: number,
  config: Partial<ConfigReparto> = {},
): InfoNivelEspera {
  const umbralRetrasado = config.umbralRetrasadoMin ?? CONFIG_REPARTO_DEFECTO.umbralRetrasadoMin;
  const umbralTarde = config.umbralTardeMin ?? CONFIG_REPARTO_DEFECTO.umbralTardeMin;
  const umbralMuyTarde = config.umbralMuyTardeMin ?? CONFIG_REPARTO_DEFECTO.umbralMuyTardeMin;

  const espera = Math.max(0, Number(minutosEspera) || 0);

  if (espera >= umbralMuyTarde) {
    return {
      nivel: 'muy_tarde',
      color: 'rojo',
      colorHex: '#C4412B',
      label: 'Muy tarde',
      palpitando: true,
    };
  }

  if (espera >= umbralTarde) {
    return {
      nivel: 'tarde',
      color: 'naranja',
      colorHex: '#E67929',
      label: 'Tarde',
      palpitando: false,
    };
  }

  if (espera >= umbralRetrasado) {
    return {
      nivel: 'retrasado',
      color: 'amarillo',
      colorHex: '#D99E39',
      label: 'Retrasado',
      palpitando: false,
    };
  }

  return {
    nivel: 'normal',
    color: 'verde',
    colorHex: '#2E8B57',
    label: `${espera} min`,
    palpitando: false,
  };
}

/**
 * Distancia Haversine en kilómetros entre dos coordenadas geográficas.
 */
export function distanciaHaversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Radio de la Tierra en km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Tiempo estimado de viaje en minutos según distancia y velocidad media.
 */
export function tiempoEstimadoMin(
  distanciaKm: number,
  velocidadMediaKmH = CONFIG_REPARTO_DEFECTO.velocidadMediaKmH,
): number {
  if (distanciaKm <= 0) return 0;
  const vel = velocidadMediaKmH > 0 ? velocidadMediaKmH : 20;
  return Math.max(1, Math.round((distanciaKm / vel) * 60));
}

export interface PedidoParaRuta {
  id: string;
  codigo: string;
  cliente_nombre: string;
  direccion?: string | null;
  lat: number;
  lng: number;
  minutosEspera: number;
  zona?: string | null;
  estado?: string;
  total?: number;
  pago_metodo?: string;
  pago_estado?: string;
  paga_con?: number | null;
}

export interface ParadaRuta extends PedidoParaRuta {
  orden: number;
  distanciaTramoKm: number;
  tiempoTramoMin: number;
  distanciaAcumuladaKm: number;
  tiempoAcumuladoMin: number;
}

export interface RutaCalculada {
  paradas: ParadaRuta[];
  totalParadas: number;
  distanciaAproxKm: number;
  tiempoAproxMin: number;
  urlGoogleMaps: string;
  urlWazePrimeraParada?: string;
}

/**
 * Calcula el factor de urgencia por minutos de espera para priorizar la ruta.
 */
function calcularFactorUrgencia(
  minutosEspera: number,
  config: Partial<ConfigReparto> = {},
): number {
  const info = clasificarEspera(minutosEspera, config);
  switch (info.nivel) {
    case 'muy_tarde':
      return 3.0;
    case 'tarde':
      return 2.0;
    case 'retrasado':
      return 1.5;
    default:
      return 1.0;
  }
}

/**
 * Sugiere el orden de paradas para los pedidos según:
 * 1) Tiempo de espera (primero los que más esperan, con mayor factor de urgencia)
 * 2) Distancia y tiempo estimado de viaje (greedy step-by-step)
 * Hasta un máximo configurable (por defecto 3).
 */
export function sugerirOrdenRuta(
  candidatos: PedidoParaRuta[],
  origen: Coordenadas = COORDENADAS_TIENDA_DEFECTO,
  config: Partial<ConfigReparto> = {},
  maxParadas?: number,
): PedidoParaRuta[] {
  const limite = maxParadas ?? config.maxPedidosPorRepartidor ?? CONFIG_REPARTO_DEFECTO.maxPedidosPorRepartidor;
  const disponibles = candidatos.filter((p) => p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng));

  if (disponibles.length <= 1) {
    return disponibles.slice(0, limite);
  }

  const restantes = [...disponibles];
  const seleccionados: PedidoParaRuta[] = [];
  let posActual: Coordenadas = { ...origen };

  while (restantes.length > 0 && seleccionados.length < limite) {
    restantes.sort((a, b) => {
      const distA = distanciaHaversineKm(posActual.lat, posActual.lng, a.lat, a.lng);
      const distB = distanciaHaversineKm(posActual.lat, posActual.lng, b.lat, b.lng);

      const urgenciaA = calcularFactorUrgencia(a.minutosEspera, config);
      const urgenciaB = calcularFactorUrgencia(b.minutosEspera, config);

      // Función de costo: distancia * 3 - tiempoEspera * factorUrgencia
      // Menor costo (más negativo) gana mayor prioridad de entrega
      const costoA = distA * 3 - a.minutosEspera * urgenciaA;
      const costoB = distB * 3 - b.minutosEspera * urgenciaB;

      return costoA - costoB;
    });

    const siguiente = restantes.shift()!;
    seleccionados.push(siguiente);
    posActual = { lat: siguiente.lat, lng: siguiente.lng };
  }

  return seleccionados;
}

/**
 * Calcula los tramos, totales acumulados y URLs de navegación para una lista de paradas en el orden dado.
 */
export function calcularMetricasRuta(
  paradasOrdenadas: PedidoParaRuta[],
  origen: Coordenadas = COORDENADAS_TIENDA_DEFECTO,
  velocidadMediaKmH = CONFIG_REPARTO_DEFECTO.velocidadMediaKmH,
): RutaCalculada {
  let distanciaAcumulada = 0;
  let tiempoAcumulado = 0;
  let puntoAnterior: Coordenadas = { ...origen };

  const paradasConMetricas: ParadaRuta[] = paradasOrdenadas.map((p, idx) => {
    const distTramo = distanciaHaversineKm(puntoAnterior.lat, puntoAnterior.lng, p.lat, p.lng);
    const tiempoTramo = tiempoEstimadoMin(distTramo, velocidadMediaKmH);

    distanciaAcumulada += distTramo;
    tiempoAcumulado += tiempoTramo;

    puntoAnterior = { lat: p.lat, lng: p.lng };

    return {
      ...p,
      orden: idx + 1,
      distanciaTramoKm: Number(distTramo.toFixed(2)),
      tiempoTramoMin: tiempoTramo,
      distanciaAcumuladaKm: Number(distanciaAcumulada.toFixed(2)),
      tiempoAcumuladoMin: tiempoAcumulado,
    };
  });

  const coordenadasParadas = paradasOrdenadas.map((p) => ({ lat: p.lat, lng: p.lng }));
  const urlGoogleMaps = generarUrlGoogleMaps(origen, coordenadasParadas);
  const urlWazePrimeraParada =
    coordenadasParadas.length > 0 ? generarUrlWaze(coordenadasParadas[0]) : undefined;

  return {
    paradas: paradasConMetricas,
    totalParadas: paradasConMetricas.length,
    distanciaAproxKm: Number(distanciaAcumulada.toFixed(1)),
    tiempoAproxMin: tiempoAcumulado,
    urlGoogleMaps,
    urlWazePrimeraParada,
  };
}

/**
 * Genera la URL de Google Maps para iniciar la ruta con todas las paradas ordenadas por coordenadas:
 * https://www.google.com/maps/dir/?api=1&origin=...&destination=...&waypoints=...&travelmode=driving
 */
export function generarUrlGoogleMaps(
  origen: Coordenadas,
  paradas: Coordenadas[],
): string {
  if (paradas.length === 0) return '';

  const origenStr = `${origen.lat},${origen.lng}`;

  if (paradas.length === 1) {
    const destStr = `${paradas[0].lat},${paradas[0].lng}`;
    return `https://www.google.com/maps/dir/?api=1&origin=${origenStr}&destination=${destStr}&travelmode=driving`;
  }

  const destinoFinal = paradas[paradas.length - 1];
  const destStr = `${destinoFinal.lat},${destinoFinal.lng}`;
  const intermedias = paradas.slice(0, -1);
  const waypointsStr = intermedias.map((p) => `${p.lat},${p.lng}`).join('|');

  return `https://www.google.com/maps/dir/?api=1&origin=${origenStr}&destination=${destStr}&waypoints=${encodeURIComponent(
    waypointsStr,
  )}&travelmode=driving`;
}

/**
 * Genera la URL de Waze para navegar a una parada por coordenadas.
 */
export function generarUrlWaze(parada: Coordenadas): string {
  return `https://waze.com/ul?ll=${parada.lat},${parada.lng}&navigate=yes`;
}
