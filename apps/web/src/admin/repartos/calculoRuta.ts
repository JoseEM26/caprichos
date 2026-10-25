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
  urlAppleMapsPrimeraParada?: string;
  /** geo: abre el selector de apps de navegación en Android */
  urlGeoPrimeraParada?: string;
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
    urlAppleMapsPrimeraParada:
      coordenadasParadas.length > 0
        ? `https://maps.apple.com/?daddr=${coordenadasParadas[0].lat},${coordenadasParadas[0].lng}&dirflg=d`
        : undefined,
    urlGeoPrimeraParada:
      coordenadasParadas.length > 0
        ? `geo:${coordenadasParadas[0].lat},${coordenadasParadas[0].lng}?q=${coordenadasParadas[0].lat},${coordenadasParadas[0].lng}`
        : undefined,
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

// -------------------------------------------------------------
// RUTAS SUGERIDAS POR SECTOR Y DIRECCIÓN DESDE EL LOCAL
// -------------------------------------------------------------

export type SectorCardinal =
  | 'Norte'
  | 'Noreste'
  | 'Este'
  | 'Sureste'
  | 'Sur'
  | 'Suroeste'
  | 'Oeste'
  | 'Noroeste';

export const SECTORES_CARDINALES: SectorCardinal[] = [
  'Norte',
  'Noreste',
  'Este',
  'Sureste',
  'Sur',
  'Suroeste',
  'Oeste',
  'Noroeste',
];

/**
 * Paleta de colores accesibles con alto contraste para diferenciar rutas en el mapa.
 */
export const PALETA_RUTAS_SUGERIDAS = [
  { color: '#1E40AF', nombreColor: 'Azul zafiro' },
  { color: '#C2410C', nombreColor: 'Naranja óxido' },
  { color: '#15803D', nombreColor: 'Verde bosque' },
];

export interface RutaSugeridaSector {
  id: string;
  nombre: string;
  sector: string;
  color: string;
  pedidos: PedidoParaRuta[];
  totalPedidos: number;
  distanciaKm: number;
  tiempoMin: number;
  urgencia: number;
  coordenadasRuta: Array<[number, number]>;
}

export interface GrupoSector {
  sector: SectorCardinal;
  nombreRuta: string;
  pedidos: PedidoParaRuta[];
}

/**
 * Calcula el rumbo o ángulo geográfico en grados [0, 360) desde el local hacia el pedido.
 * 0° = Norte, 90° = Este, 180° = Sur, 270° = Oeste.
 */
export function calcularRumbo(origen: Coordenadas, destino: Coordenadas): number {
  if (origen.lat === destino.lat && origen.lng === destino.lng) {
    return 0;
  }
  const dLon = ((destino.lng - origen.lng) * Math.PI) / 180;
  const lat1 = (origen.lat * Math.PI) / 180;
  const lat2 = (destino.lat * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const anguloRad = Math.atan2(y, x);
  const anguloDeg = (anguloRad * 180) / Math.PI;

  return (anguloDeg + 360) % 360;
}

/**
 * Asigna el sector cardinal según el ángulo de rumbo (8 sectores de 45°).
 * Caso borde: pedido exactamente en 22.5° entra a Noreste.
 */
export function obtenerSectorCardinal(rumbo: number): SectorCardinal {
  const r = ((rumbo % 360) + 360) % 360;
  if (r >= 337.5 || r < 22.5) return 'Norte';
  if (r >= 22.5 && r < 67.5) return 'Noreste';
  if (r >= 67.5 && r < 112.5) return 'Este';
  if (r >= 112.5 && r < 157.5) return 'Sureste';
  if (r >= 157.5 && r < 202.5) return 'Sur';
  if (r >= 202.5 && r < 247.5) return 'Suroeste';
  if (r >= 247.5 && r < 292.5) return 'Oeste';
  return 'Noroeste';
}

/**
 * Calcula la distancia total del recorrido saliendo desde el origen y visitando las paradas en secuencia.
 */
export function calcularDistanciaRecorrido(
  paradas: PedidoParaRuta[],
  origen: Coordenadas = COORDENADAS_TIENDA_DEFECTO,
): number {
  if (paradas.length === 0) return 0;
  let dist = distanciaHaversineKm(origen.lat, origen.lng, paradas[0].lat, paradas[0].lng);
  for (let i = 0; i < paradas.length - 1; i++) {
    dist += distanciaHaversineKm(
      paradas[i].lat,
      paradas[i].lng,
      paradas[i + 1].lat,
      paradas[i + 1].lng,
    );
  }
  return dist;
}

/**
 * Ordena las paradas de un sector desde la más cercana hacia la más lejana siguiendo el avance,
 * optimizado con el algoritmo 2-opt para asegurar que no haya zigzags ni cruces innecesarios.
 */
export function optimizarOrdenSector(
  pedidos: PedidoParaRuta[],
  origen: Coordenadas = COORDENADAS_TIENDA_DEFECTO,
): PedidoParaRuta[] {
  const disponibles = pedidos.filter(
    (p) => p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng),
  );
  if (disponibles.length <= 1) return [...disponibles];

  // 1. Avance hacia afuera (Greedy Nearest Neighbor partiendo del local)
  const restantes = [...disponibles];
  const ruta: PedidoParaRuta[] = [];
  let posActual = { ...origen };

  while (restantes.length > 0) {
    let mejorIdx = 0;
    let mejorDist = Infinity;
    for (let i = 0; i < restantes.length; i++) {
      const d = distanciaHaversineKm(
        posActual.lat,
        posActual.lng,
        restantes[i].lat,
        restantes[i].lng,
      );
      if (d < mejorDist) {
        mejorDist = d;
        mejorIdx = i;
      }
    }
    const [siguiente] = restantes.splice(mejorIdx, 1);
    ruta.push(siguiente);
    posActual = { lat: siguiente.lat, lng: siguiente.lng };
  }

  // 2. Algoritmo 2-opt para eliminar cruces y zigzags
  if (ruta.length >= 3) {
    let mejoro = true;
    let iter = 0;
    const maxIter = 50;

    while (mejoro && iter < maxIter) {
      mejoro = false;
      iter++;
      const distActual = calcularDistanciaRecorrido(ruta, origen);

      for (let i = 0; i < ruta.length - 1; i++) {
        for (let j = i + 1; j < ruta.length; j++) {
          const candidata = [
            ...ruta.slice(0, i),
            ...ruta.slice(i, j + 1).reverse(),
            ...ruta.slice(j + 1),
          ];
          const distCandidata = calcularDistanciaRecorrido(candidata, origen);

          if (distCandidata < distActual - 1e-6) {
            ruta.splice(0, ruta.length, ...candidata);
            mejoro = true;
            break;
          }
        }
        if (mejoro) break;
      }
    }
  }

  return ruta;
}

/**
 * Agrupa los pedidos en sectores cardinales y fusiona sectores con 1 pedido con un vecino
 * para no sugerir rutas de un único pedido innecesariamente.
 */
export function agruparPorSectorYFusionar(
  pedidos: PedidoParaRuta[],
  origen: Coordenadas = COORDENADAS_TIENDA_DEFECTO,
  maxPorRuta = 3,
): GrupoSector[] {
  const disponibles = pedidos.filter(
    (p) => p.lat != null && p.lng != null && !isNaN(p.lat) && !isNaN(p.lng),
  );
  if (disponibles.length === 0) return [];

  const mapaSectores = new Map<SectorCardinal, PedidoParaRuta[]>();
  for (const s of SECTORES_CARDINALES) {
    mapaSectores.set(s, []);
  }

  for (const p of disponibles) {
    const rumbo = calcularRumbo(origen, { lat: p.lat, lng: p.lng });
    const sector = obtenerSectorCardinal(rumbo);
    mapaSectores.get(sector)!.push(p);
  }

  const grupos: GrupoSector[] = SECTORES_CARDINALES
    .filter((s) => mapaSectores.get(s)!.length > 0)
    .map((s) => ({
      sector: s,
      nombreRuta: `Ruta ${s}`,
      pedidos: [...mapaSectores.get(s)!],
    }));

  if (grupos.length <= 1) {
    return grupos;
  }

  // Fusión de sectores con 1 pedido con vecinos que tengan pocos pedidos
  for (let gIdx = grupos.length - 1; gIdx >= 0; gIdx--) {
    const grupo = grupos[gIdx];
    if (grupo && grupo.pedidos.length === 1 && grupos.length > 1) {
      const idxSector = SECTORES_CARDINALES.indexOf(grupo.sector);
      const prevSector = SECTORES_CARDINALES[(idxSector + 7) % 8];
      const nextSector = SECTORES_CARDINALES[(idxSector + 1) % 8];

      const prevGrupo = grupos.find((g) => g.sector === prevSector && g !== grupo);
      const nextGrupo = grupos.find((g) => g.sector === nextSector && g !== grupo);

      let vecinoElegido: GrupoSector | undefined;

      if (prevGrupo && nextGrupo) {
        if (prevGrupo.pedidos.length <= nextGrupo.pedidos.length) {
          vecinoElegido = prevGrupo;
        } else {
          vecinoElegido = nextGrupo;
        }
      } else if (prevGrupo) {
        vecinoElegido = prevGrupo;
      } else if (nextGrupo) {
        vecinoElegido = nextGrupo;
      }

      if (vecinoElegido && vecinoElegido.pedidos.length <= maxPorRuta + 1) {
        vecinoElegido.pedidos.push(...grupo.pedidos);
        vecinoElegido.nombreRuta = `${vecinoElegido.nombreRuta} - ${grupo.sector}`;
        grupos.splice(gIdx, 1);
      }
    }
  }

  return grupos;
}

/**
 * Sugiere hasta 3 rutas de mayor urgencia organizadas por sector geográfico.
 */
export function sugerirRutasPorSector(
  pedidos: PedidoParaRuta[],
  origen: Coordenadas = COORDENADAS_TIENDA_DEFECTO,
  config: Partial<ConfigReparto> = {},
  limiteRutas = 3,
): RutaSugeridaSector[] {
  const maxPorRepartidor =
    config.maxPedidosPorRepartidor ?? CONFIG_REPARTO_DEFECTO.maxPedidosPorRepartidor;
  const grupos = agruparPorSectorYFusionar(pedidos, origen, maxPorRepartidor);

  const rutas: RutaSugeridaSector[] = grupos.map((g, idx) => {
    const pedidosOrdenados = optimizarOrdenSector(g.pedidos, origen);
    const metricas = calcularMetricasRuta(
      pedidosOrdenados,
      origen,
      config.velocidadMediaKmH ?? CONFIG_REPARTO_DEFECTO.velocidadMediaKmH,
    );

    const maxEspera = Math.max(0, ...pedidosOrdenados.map((p) => p.minutosEspera || 0));
    let sumaPonderada = 0;
    for (const p of pedidosOrdenados) {
      const factor = calcularFactorUrgencia(p.minutosEspera, config);
      sumaPonderada += (p.minutosEspera || 0) * factor;
    }
    const urgencia = maxEspera * 2 + sumaPonderada + pedidosOrdenados.length * 10;

    const coordenadasRuta: Array<[number, number]> = [
      [origen.lat, origen.lng],
      ...pedidosOrdenados.map((p): [number, number] => [p.lat, p.lng]),
    ];

    return {
      id: `ruta-sector-${g.sector.toLowerCase()}-${idx}`,
      nombre: g.nombreRuta,
      sector: g.sector,
      color: PALETA_RUTAS_SUGERIDAS[idx % PALETA_RUTAS_SUGERIDAS.length].color,
      pedidos: pedidosOrdenados,
      totalPedidos: pedidosOrdenados.length,
      distanciaKm: metricas.distanciaAproxKm,
      tiempoMin: metricas.tiempoAproxMin,
      urgencia,
      coordenadasRuta,
    };
  });

  rutas.sort((a, b) => b.urgencia - a.urgencia);
  const seleccionadas = rutas.slice(0, limiteRutas);

  return seleccionadas.map((r, i) => ({
    ...r,
    color: PALETA_RUTAS_SUGERIDAS[i % PALETA_RUTAS_SUGERIDAS.length].color,
  }));
}
