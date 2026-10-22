import { Injectable } from '@nestjs/common';

export interface Coordenadas {
  lat: number;
  lng: number;
}

export interface PedidoRutaInput {
  id: string | bigint;
  codigo?: string;
  lat: number;
  lng: number;
  minutosEspera: number;
  zona?: string | null;
}

export interface ResultadoRuta {
  orden: string[];
  paso: string[];
  ruta: [number, number][];
}

export interface ResumenSectoresYZonas {
  lados: {
    Norte: number;
    Sur: number;
    Este: number;
    Oeste: number;
  };
  zonas: Record<string, number>;
  total: number;
}

export const COORDENADAS_LOCAL_DEFAULT: Coordenadas = {
  lat: -12.0147,
  lng: -76.966,
};

@Injectable()
export class RutaService {
  /**
   * Distancia Haversine en kilómetros entre dos coordenadas esféricas.
   */
  haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
   * Proyecta coordenadas geográficas a un plano euclidiano en km relativo al local (DT-80 / Mockup).
   * x = Este (+), Oeste (-) en km
   * y = Norte (+), Sur (-) en km
   */
  proyectarKm(
    lat: number,
    lng: number,
    local: Coordenadas = COORDENADAS_LOCAL_DEFAULT,
  ): [number, number] {
    const x = (lng - local.lng) * 109;
    const y = (lat - local.lat) * 111;
    return [x, y];
  }

  /**
   * Distancia en km de un punto P a un segmento de recta A-B (en km proyectados).
   */
  distanciaPuntoSegmentoKm(
    p: [number, number],
    a: [number, number],
    b: [number, number],
  ): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const l2 = dx * dx + dy * dy;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  }

  /**
   * Factor de ponderación por minutos de espera (DT-80):
   * x1.0 hasta naranja (< 35 min)
   * x1.5 desde naranja hasta rojo (35 a 50 min)
   * x2.5 desde rojo (>= 50 min)
   */
  calcularFactorEspera(
    minutosEspera: number,
    naranjaMin = 35,
    rojoMin = 50,
  ): number {
    if (minutosEspera >= rojoMin) return 2.5;
    if (minutosEspera >= naranjaMin) return 1.5;
    return 1.0;
  }

  /**
   * Función de costo DT-80: km * 3 - tiempo_espera_ponderado.
   * Gana el de menor costo (más negativo = mayor prioridad).
   */
  calcularCosto(
    distanciaKm: number,
    minutosEspera: number,
    naranjaMin = 35,
    rojoMin = 50,
  ): number {
    const factor = this.calcularFactorEspera(minutosEspera, naranjaMin, rojoMin);
    return distanciaKm * 3 - minutosEspera * factor;
  }

  /**
   * Calcula la ruta sugerida greedy para los pedidos asignados al repartidor,
   * más los pedidos disponibles «al paso» (a <= 600m de los tramos de ida).
   */
  calcularRuta(
    pedidosPropios: PedidoRutaInput[],
    pedidosDisponibles: PedidoRutaInput[] = [],
    localCoords: Coordenadas = COORDENADAS_LOCAL_DEFAULT,
    umbrales: { naranjaMin: number; rojoMin: number } = { naranjaMin: 35, rojoMin: 50 },
    repMax = 3,
  ): ResultadoRuta {
    const orden: string[] = [];
    const ruta: [number, number][] = [[localCoords.lat, localCoords.lng]];

    // 1. Ruta greedy punto a punto para los pedidos propios
    const restantes = [...pedidosPropios];
    let posActual: Coordenadas = { ...localCoords };

    while (restantes.length > 0) {
      restantes.sort((a, b) => {
        const distA = this.haversineKm(posActual.lat, posActual.lng, a.lat, a.lng);
        const distB = this.haversineKm(posActual.lat, posActual.lng, b.lat, b.lng);
        const costoA = this.calcularCosto(distA, a.minutosEspera, umbrales.naranjaMin, umbrales.rojoMin);
        const costoB = this.calcularCosto(distB, b.minutosEspera, umbrales.naranjaMin, umbrales.rojoMin);
        return costoA - costoB;
      });

      const siguiente = restantes.shift()!;
      orden.push(String(siguiente.id));
      ruta.push([siguiente.lat, siguiente.lng]);
      posActual = { lat: siguiente.lat, lng: siguiente.lng };
    }

    // 2. Pedidos «Al paso»: disponibles a <= 600m (0.6 km) de los tramos de la ruta sugerida
    const paso: string[] = [];
    const cuposDisponibles = repMax - pedidosPropios.length;

    if (pedidosPropios.length > 0 && cuposDisponibles > 0 && pedidosDisponibles.length > 0) {
      // Proyectamos los puntos de la ruta a coordenadas km relativas al local
      const rutaKm: [number, number][] = ruta.map(([lat, lng]) =>
        this.proyectarKm(lat, lng, localCoords),
      );

      for (const disp of pedidosDisponibles) {
        // Ignorar si ya está en los propios
        if (orden.includes(String(disp.id))) continue;

        const pKm = this.proyectarKm(disp.lat, disp.lng, localCoords);

        // Comprobar distancia a cualquiera de los tramos de la ruta (a partir del local a cada punto)
        let estaAlPaso = false;
        for (let i = 0; i < rutaKm.length - 1; i++) {
          const segDist = this.distanciaPuntoSegmentoKm(pKm, rutaKm[i], rutaKm[i + 1]);
          if (segDist <= 0.6) {
            estaAlPaso = true;
            break;
          }
        }

        if (estaAlPaso) {
          paso.push(String(disp.id));
          if (paso.length >= cuposDisponibles) {
            break;
          }
        }
      }
    }

    return { orden, paso, ruta };
  }

  /**
   * Calcula el conteo de pedidos por sector cardinal (Norte, Sur, Este, Oeste respecto al local)
   * y por zona de reparto para los chips UI «Dónde hay más» (DT-80).
   */
  calcularLadosYZonas(
    pedidos: Array<{ lat: number; lng: number; zona?: string | null }>,
    localCoords: Coordenadas = COORDENADAS_LOCAL_DEFAULT,
  ): ResumenSectoresYZonas {
    const lados = { Norte: 0, Sur: 0, Este: 0, Oeste: 0 };
    const zonas: Record<string, number> = {};

    for (const p of pedidos) {
      const pKm = this.proyectarKm(p.lat, p.lng, localCoords);
      const x = pKm[0]; // Este (+), Oeste (-)
      const y = pKm[1]; // Norte (+), Sur (-)

      // Regla de decisión de cuadrante (DT-80 / Mockup line 5050)
      if (Math.abs(y) >= Math.abs(x)) {
        if (y >= 0) lados.Norte++;
        else lados.Sur++;
      } else {
        if (x >= 0) lados.Este++;
        else lados.Oeste++;
      }

      // Zona
      const z = p.zona ? String(p.zona).toUpperCase() : 'SIN_ZONA';
      zonas[z] = (zonas[z] || 0) + 1;
    }

    return {
      lados,
      zonas,
      total: pedidos.length,
    };
  }
}
