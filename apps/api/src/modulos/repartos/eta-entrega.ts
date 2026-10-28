import { Coordenadas, PedidoRutaInput, RutaService } from './ruta.service';

/** Parámetros del tiempo estimado (tabla parametro). Valores por defecto si faltan. */
export interface ConfigEta {
  local: Coordenadas;
  velocidadKmh: number;
  factorUrbano: number;
  productosDesde: number;
  extraPorProductoMin: number;
  paradaMin: number;
  margenMin: number;
  pasoMin: number;
  baseSinZonaMin: number;
  /** Respaldo cuando no se puede calcular: tiempo_prometido_min. */
  respaldoMin: number;
}

export interface EntradaEta {
  /** Minutos de la zona del pedido (zona_reparto.minutos_min/max). Null si no tiene zona o no los tiene. */
  zonaMin?: number | null;
  zonaMax?: number | null;
  lat?: number | null;
  lng?: number | null;
  /** Unidades totales del pedido (suma de cantidades). */
  unidades?: number;
  /** Ruta del repartidor: todos sus pedidos en camino, incluido este (ids únicos). */
  ruta?: Array<{ id: string; lat: number; lng: number }>;
  id?: string;
}

export interface RangoEta {
  min: number;
  max: number;
}

export const CONFIG_ETA_DEFECTO: Omit<ConfigEta, 'respaldoMin'> = {
  // Mismo local que usan la carta y los polígonos de zona (no el de RutaService, que es otro punto)
  local: { lat: -12.0196436, lng: -76.963255 },
  velocidadKmh: 25,
  factorUrbano: 1.3,
  productosDesde: 3,
  extraPorProductoMin: 1,
  paradaMin: 3,
  margenMin: 5,
  pasoMin: 5,
  baseSinZonaMin: 5,
};

const ruta = new RutaService();

const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Redondea al múltiplo de `paso` más cercano (10 -> 10, 13 -> 15). */
function redondear(valor: number, paso: number): number {
  return Math.max(paso, Math.round(valor / paso) * paso);
}

/**
 * Minutos del aviso «Tiempo estimado» para un pedido. Devuelve un rango {min, max} redondeado a `pasoMin`.
 * Composición: base de la zona (o recorrido en línea recta si no hay zona) + desvío de la ruta del repartidor
 * y una parada por cada pedido anterior + empaque por unidades. El max es min + margen (mínimo).
 * Sin zona ni coordenadas devuelve null: el llamador usa el respaldo tiempo_prometido_min.
 */
export function calcularEtaEntrega(entrada: EntradaEta, cfg: ConfigEta): RangoEta | null {
  const tieneZona = esNumero(entrada.zonaMin) && esNumero(entrada.zonaMax);
  const tieneCoords = esNumero(entrada.lat) && esNumero(entrada.lng);
  if (!tieneZona && !tieneCoords) return null;

  const kmDirecto =
    tieneCoords
      ? ruta.haversineKm(cfg.local.lat, cfg.local.lng, entrada.lat as number, entrada.lng as number)
      : 0;
  const minPorKm = (60 / cfg.velocidadKmh) * cfg.factorUrbano;

  // Ruta del repartidor: orden greedy (el mismo de RutaService) y km acumulados hasta este pedido
  let paradasAntes = 0;
  let kmHastaEste = kmDirecto;
  if (entrada.id && entrada.ruta && entrada.ruta.length > 0) {
    const pedidos: PedidoRutaInput[] = entrada.ruta.map((r) => ({ id: r.id, lat: r.lat, lng: r.lng, minutosEspera: 0 }));
    const plan = ruta.calcularRuta(pedidos, [], cfg.local, {}, pedidos.length, cfg.velocidadKmh);
    const pos = plan.orden.indexOf(entrada.id);
    if (pos >= 0) {
      paradasAntes = pos;
      kmHastaEste = 0;
      // ruta[0] es el local y ruta[k+1] la parada k: sumar los tramos hasta la parada de este pedido
      for (let i = 0; i <= pos && i + 1 < plan.ruta.length; i++) {
        kmHastaEste += ruta.haversineKm(plan.ruta[i][0], plan.ruta[i][1], plan.ruta[i + 1][0], plan.ruta[i + 1][1]);
      }
    }
  }
  const desvioKm = Math.max(0, kmHastaEste - kmDirecto);

  const baseMin = tieneZona ? (entrada.zonaMin as number) : kmDirecto * minPorKm + cfg.baseSinZonaMin;
  const baseMax = tieneZona ? (entrada.zonaMax as number) : baseMin;

  const unidades = entrada.unidades ?? 0;
  const empaque = unidades >= cfg.productosDesde ? (unidades - cfg.productosDesde + 1) * cfg.extraPorProductoMin : 0;
  const extraRuta = desvioKm * minPorKm + paradasAntes * cfg.paradaMin;

  const min = redondear(baseMin + extraRuta + empaque, cfg.pasoMin);
  const max = Math.max(min + cfg.margenMin, redondear(baseMax + extraRuta + empaque, cfg.pasoMin));
  return { min, max };
}

/** Texto del aviso: «25 a 30» con rango, o «30» si cae al respaldo. */
export function formatearEta(rango: RangoEta | null, respaldoMin: number): string {
  if (!rango) return String(Math.round(respaldoMin));
  return rango.min === rango.max ? String(rango.min) : `${rango.min} a ${rango.max}`;
}

/** Lee la configuración del tiempo estimado desde la tabla parametro (con valores por defecto). */
export async function leerConfigEta(db: {
  parametro: { findMany(args: any): Promise<Array<{ clave: string; valor: unknown }>> };
}): Promise<ConfigEta> {
  const claves = [
    'local_lat',
    'local_lng',
    'reparto_velocidad_kmh',
    'eta_factor_urbano',
    'eta_productos_desde',
    'eta_extra_por_producto_min',
    'eta_parada_min',
    'eta_margen_min',
    'eta_paso_min',
    'eta_base_sin_zona_min',
    'tiempo_prometido_min',
  ];
  const filas = await db.parametro.findMany({ where: { clave: { in: claves } } });
  const mapa = new Map(filas.map((f) => [f.clave, Number(f.valor)]));
  const num = (clave: string, defecto: number) => {
    const v = mapa.get(clave);
    return v !== undefined && Number.isFinite(v) && v > 0 ? v : defecto;
  };
  return {
    local: {
      lat: num('local_lat', CONFIG_ETA_DEFECTO.local.lat),
      lng: num('local_lng', CONFIG_ETA_DEFECTO.local.lng),
    },
    velocidadKmh: num('reparto_velocidad_kmh', CONFIG_ETA_DEFECTO.velocidadKmh),
    factorUrbano: num('eta_factor_urbano', CONFIG_ETA_DEFECTO.factorUrbano),
    productosDesde: num('eta_productos_desde', CONFIG_ETA_DEFECTO.productosDesde),
    extraPorProductoMin: num('eta_extra_por_producto_min', CONFIG_ETA_DEFECTO.extraPorProductoMin),
    paradaMin: num('eta_parada_min', CONFIG_ETA_DEFECTO.paradaMin),
    margenMin: num('eta_margen_min', CONFIG_ETA_DEFECTO.margenMin),
    pasoMin: num('eta_paso_min', CONFIG_ETA_DEFECTO.pasoMin),
    baseSinZonaMin: num('eta_base_sin_zona_min', CONFIG_ETA_DEFECTO.baseSinZonaMin),
    respaldoMin: num('tiempo_prometido_min', 30),
  };
}
