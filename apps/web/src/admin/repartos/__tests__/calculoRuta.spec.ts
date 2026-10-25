import { describe, it, expect } from 'vitest';
import {
  clasificarEspera,
  distanciaHaversineKm,
  tiempoEstimadoMin,
  sugerirOrdenRuta,
  calcularMetricasRuta,
  generarUrlGoogleMaps,
  generarUrlWaze,
  COORDENADAS_TIENDA_DEFECTO,
  PedidoParaRuta,
  calcularRumbo,
  obtenerSectorCardinal,
  agruparPorSectorYFusionar,
  optimizarOrdenSector,
  sugerirRutasPorSector,
  calcularDistanciaRecorrido,
} from '../calculoRuta';

describe('Módulo de Cálculo de Ruta y Tiempos de Espera (calculoRuta.ts)', () => {
  describe('clasificarEspera (Decisión 3 del dueño: 20/30/45)', () => {
    it('clasifica < 20 min como verde (normal)', () => {
      const res0 = clasificarEspera(0);
      expect(res0.color).toBe('verde');
      expect(res0.nivel).toBe('normal');
      expect(res0.colorHex).toBe('#2E8B57');
      expect(res0.palpitando).toBe(false);

      const res19 = clasificarEspera(19);
      expect(res19.color).toBe('verde');
      expect(res19.nivel).toBe('normal');
      expect(res19.palpitando).toBe(false);
    });

    it('clasifica >= 20 y < 30 min como amarillo «Retrasado»', () => {
      const res20 = clasificarEspera(20);
      expect(res20.color).toBe('amarillo');
      expect(res20.nivel).toBe('retrasado');
      expect(res20.colorHex).toBe('#D99E39');
      expect(res20.label).toBe('Retrasado');
      expect(res20.palpitando).toBe(false);

      const res29 = clasificarEspera(29);
      expect(res29.color).toBe('amarillo');
      expect(res29.nivel).toBe('retrasado');
      expect(res29.palpitando).toBe(false);
    });

    it('clasifica >= 30 y < 45 min como naranja «Tarde»', () => {
      const res30 = clasificarEspera(30);
      expect(res30.color).toBe('naranja');
      expect(res30.nivel).toBe('tarde');
      expect(res30.colorHex).toBe('#E67929');
      expect(res30.label).toBe('Tarde');
      expect(res30.palpitando).toBe(false);

      const res44 = clasificarEspera(44);
      expect(res44.color).toBe('naranja');
      expect(res44.nivel).toBe('tarde');
      expect(res44.palpitando).toBe(false);
    });

    it('clasifica >= 45 min como rojo palpitando «Muy tarde»', () => {
      const res45 = clasificarEspera(45);
      expect(res45.color).toBe('rojo');
      expect(res45.nivel).toBe('muy_tarde');
      expect(res45.colorHex).toBe('#C4412B');
      expect(res45.label).toBe('Muy tarde');
      expect(res45.palpitando).toBe(true);

      const res60 = clasificarEspera(60);
      expect(res60.color).toBe('rojo');
      expect(res60.nivel).toBe('muy_tarde');
      expect(res60.palpitando).toBe(true);
    });

    it('respeta umbrales configurables personalizados', () => {
      const custom = { umbralRetrasadoMin: 15, umbralTardeMin: 25, umbralMuyTardeMin: 40 };
      expect(clasificarEspera(14, custom).nivel).toBe('normal');
      expect(clasificarEspera(15, custom).nivel).toBe('retrasado');
      expect(clasificarEspera(25, custom).nivel).toBe('tarde');
      expect(clasificarEspera(40, custom).nivel).toBe('muy_tarde');
    });
  });

  describe('distanciaHaversineKm y tiempoEstimadoMin', () => {
    it('calcula distancia 0 para el mismo punto', () => {
      const d = distanciaHaversineKm(-12.0196, -76.9632, -12.0196, -76.9632);
      expect(d).toBe(0);
    });

    it('calcula distancias coherentes en Lima', () => {
      // Entre Campoy (-12.0196, -76.9632) y Zárate (-12.0150, -76.9850) ~ 2.4 km
      const d = distanciaHaversineKm(-12.0196, -76.9632, -12.015, -76.985);
      expect(d).toBeGreaterThan(2);
      expect(d).toBeLessThan(3);
    });

    it('calcula tiempo estimado con velocidad media configurable (20 km/h por defecto)', () => {
      // 10 km a 20 km/h = 30 min
      expect(tiempoEstimadoMin(10, 20)).toBe(30);
      // 5 km a 20 km/h = 15 min
      expect(tiempoEstimadoMin(5, 20)).toBe(15);
      // 1 km a 20 km/h = 3 min
      expect(tiempoEstimadoMin(1, 20)).toBe(3);
      // 0 km = 0 min
      expect(tiempoEstimadoMin(0, 20)).toBe(0);
    });
  });

  describe('sugerirOrdenRuta (Decisión 4 del dueño)', () => {
    const pedidosPrueba: PedidoParaRuta[] = [
      {
        id: '1',
        codigo: 'CP-001',
        cliente_nombre: 'Rosa Díaz',
        lat: -12.02,
        lng: -76.964,
        minutosEspera: 10,
      },
      {
        id: '2',
        codigo: 'CP-002',
        cliente_nombre: 'Diego Ramos',
        lat: -12.025,
        lng: -76.968,
        minutosEspera: 50, // Muy tarde (prioridad alta)
      },
      {
        id: '3',
        codigo: 'CP-003',
        cliente_nombre: 'Carlos Soto',
        lat: -12.022,
        lng: -76.965,
        minutosEspera: 32, // Tarde
      },
      {
        id: '4',
        codigo: 'CP-004',
        cliente_nombre: 'Ana Perez',
        lat: -12.03,
        lng: -76.97,
        minutosEspera: 15,
      },
    ];

    it('limita el número de paradas sugeridas al máximo (3 por defecto)', () => {
      const sugeridas = sugerirOrdenRuta(pedidosPrueba, COORDENADAS_TIENDA_DEFECTO);
      expect(sugeridas.length).toBe(3);
    });

    it('prioriza pedidos con mayor tiempo de espera', () => {
      const sugeridas = sugerirOrdenRuta(pedidosPrueba, COORDENADAS_TIENDA_DEFECTO);
      // CP-002 (Diego Ramos, 50 min) debe ser elegido en la ruta prioritaria
      expect(sugeridas.some((p) => p.codigo === 'CP-002')).toBe(true);
      expect(sugeridas[0].codigo).toBe('CP-002');
    });

    it('respeta límite configurable de paradas', () => {
      const sugeridas2 = sugerirOrdenRuta(pedidosPrueba, COORDENADAS_TIENDA_DEFECTO, {}, 2);
      expect(sugeridas2.length).toBe(2);

      const sugeridas4 = sugerirOrdenRuta(pedidosPrueba, COORDENADAS_TIENDA_DEFECTO, {}, 4);
      expect(sugeridas4.length).toBe(4);
    });
  });

  describe('calcularMetricasRuta y generación de URLs', () => {
    const paradas: PedidoParaRuta[] = [
      {
        id: 'p1',
        codigo: 'CP-001',
        cliente_nombre: 'Rosa Díaz',
        lat: -12.021,
        lng: -76.964,
        minutosEspera: 25,
      },
      {
        id: 'p2',
        codigo: 'CP-002',
        cliente_nombre: 'Diego Ramos',
        lat: -12.026,
        lng: -76.969,
        minutosEspera: 40,
      },
      {
        id: 'p3',
        codigo: 'CP-003',
        cliente_nombre: 'Carlos Soto',
        lat: -12.03,
        lng: -76.972,
        minutosEspera: 12,
      },
    ];

    it('calcula métricas de distancia, tiempo y orden correlativo', () => {
      const resultado = calcularMetricasRuta(paradas, COORDENADAS_TIENDA_DEFECTO, 20);
      expect(resultado.totalParadas).toBe(3);
      expect(resultado.distanciaAproxKm).toBeGreaterThan(0);
      expect(resultado.tiempoAproxMin).toBeGreaterThan(0);

      expect(resultado.paradas[0].orden).toBe(1);
      expect(resultado.paradas[1].orden).toBe(2);
      expect(resultado.paradas[2].orden).toBe(3);
    });

    it('genera URL de Google Maps para 1 parada', () => {
      const url = generarUrlGoogleMaps(COORDENADAS_TIENDA_DEFECTO, [
        { lat: -12.021, lng: -76.964 },
      ]);
      expect(url).toContain('https://www.google.com/maps/dir/?api=1');
      expect(url).toContain(`origin=${COORDENADAS_TIENDA_DEFECTO.lat},${COORDENADAS_TIENDA_DEFECTO.lng}`);
      expect(url).toContain('destination=-12.021,-76.964');
      expect(url).toContain('travelmode=driving');
      expect(url).not.toContain('waypoints');
    });

    it('genera URL de Google Maps para múltiples paradas con waypoints', () => {
      const coords = [
        { lat: -12.021, lng: -76.964 },
        { lat: -12.026, lng: -76.969 },
        { lat: -12.03, lng: -76.972 },
      ];
      const url = generarUrlGoogleMaps(COORDENADAS_TIENDA_DEFECTO, coords);
      expect(url).toContain('https://www.google.com/maps/dir/?api=1');
      expect(url).toContain(`origin=${COORDENADAS_TIENDA_DEFECTO.lat},${COORDENADAS_TIENDA_DEFECTO.lng}`);
      expect(url).toContain('destination=-12.03,-76.972');
      expect(url).toContain('travelmode=driving');
      expect(url).toContain('waypoints=');
      // Debe contener las paradas intermedias codificadas
      expect(decodeURIComponent(url)).toContain('-12.021,-76.964|-12.026,-76.969');
    });

    it('genera URL de Waze para una parada', () => {
      const url = generarUrlWaze({ lat: -12.021, lng: -76.964 });
      expect(url).toBe('https://waze.com/ul?ll=-12.021,-76.964&navigate=yes');
    });
  });
});

describe('enlaces para otras aplicaciones de navegación', () => {
  it('la ruta trae enlaces de Waze, Apple Maps y geo: a la primera parada', () => {
    const ruta = calcularMetricasRuta(
      [{ id: '1', codigo: 'CP-1', cliente_nombre: 'Ana', lat: -12.02, lng: -76.96, minutosEspera: 30 } as never],
      { lat: -12.0196436, lng: -76.963255 },
    );
    expect(ruta.urlWazePrimeraParada).toContain('waze.com');
    expect(ruta.urlAppleMapsPrimeraParada).toContain('maps.apple.com');
    expect(ruta.urlGeoPrimeraParada).toBe('geo:-12.02,-76.96?q=-12.02,-76.96');
  });
});

describe('Rutas sugeridas por sector geográfico (decisión firmada por dirección desde el local)', () => {
  const local = COORDENADAS_TIENDA_DEFECTO; // lat: -12.0196436, lng: -76.963255

  describe('Cálculo de rumbo (ángulo geográfico) y sectores cardinales', () => {
    it('calcula rumbos cardinales exactos', () => {
      // Norte: latitud mayor, misma longitud
      const rumboNorte = calcularRumbo(local, { lat: local.lat + 0.01, lng: local.lng });
      expect(rumboNorte).toBeCloseTo(0, 1);
      expect(obtenerSectorCardinal(rumboNorte)).toBe('Norte');

      // Este: misma latitud, longitud mayor
      const rumboEste = calcularRumbo(local, { lat: local.lat, lng: local.lng + 0.01 });
      expect(rumboEste).toBeCloseTo(90, 1);
      expect(obtenerSectorCardinal(rumboEste)).toBe('Este');

      // Sur: latitud menor, misma longitud
      const rumboSur = calcularRumbo(local, { lat: local.lat - 0.01, lng: local.lng });
      expect(rumboSur).toBeCloseTo(180, 1);
      expect(obtenerSectorCardinal(rumboSur)).toBe('Sur');

      // Oeste: misma latitud, longitud menor
      const rumboOeste = calcularRumbo(local, { lat: local.lat, lng: local.lng - 0.01 });
      expect(rumboOeste).toBeCloseTo(270, 1);
      expect(obtenerSectorCardinal(rumboOeste)).toBe('Oeste');
    });

    it('casos borde: pedido exactamente en el mismo punto del local devuelve rumbo 0 y sector Norte', () => {
      const rumbo = calcularRumbo(local, { lat: local.lat, lng: local.lng });
      expect(rumbo).toBe(0);
      expect(obtenerSectorCardinal(rumbo)).toBe('Norte');
    });

    it('casos borde: límite exacto entre dos sectores (22.5°)', () => {
      // 22.49° es Norte (< 22.5°)
      expect(obtenerSectorCardinal(22.49)).toBe('Norte');
      // 22.5° entra a Noreste (>= 22.5°)
      expect(obtenerSectorCardinal(22.5)).toBe('Noreste');
      // 67.5° entra a Este (>= 67.5°)
      expect(obtenerSectorCardinal(67.5)).toBe('Este');
    });
  });

  describe('Agrupación por sector y fusión de sectores vecinos', () => {
    it('un solo pedido en todo el sistema se mantiene en su sector sin fallar', () => {
      const pedidos: PedidoParaRuta[] = [
        {
          id: '1',
          codigo: 'CP-001',
          cliente_nombre: 'Rosa',
          lat: local.lat + 0.01,
          lng: local.lng,
          minutosEspera: 10,
        },
      ];
      const grupos = agruparPorSectorYFusionar(pedidos, local, 3);
      expect(grupos).toHaveLength(1);
      expect(grupos[0].sector).toBe('Norte');
      expect(grupos[0].pedidos).toHaveLength(1);
    });

    it('fusiona un sector con 1 pedido con su vecino que tiene pocos pedidos para no sugerir ruta de 1 pedido', () => {
      const pedidos: PedidoParaRuta[] = [
        // 1 pedido al Norte
        {
          id: 'p-norte',
          codigo: 'CP-N1',
          cliente_nombre: 'Ana Norte',
          lat: local.lat + 0.01,
          lng: local.lng,
          minutosEspera: 15,
        },
        // 2 pedidos al Noreste
        {
          id: 'p-ne1',
          codigo: 'CP-NE1',
          cliente_nombre: 'Beto Noreste 1',
          lat: local.lat + 0.008,
          lng: local.lng + 0.008,
          minutosEspera: 20,
        },
        {
          id: 'p-ne2',
          codigo: 'CP-NE2',
          cliente_nombre: 'Carlos Noreste 2',
          lat: local.lat + 0.012,
          lng: local.lng + 0.012,
          minutosEspera: 25,
        },
      ];

      const grupos = agruparPorSectorYFusionar(pedidos, local, 3);
      // El sector Norte con 1 pedido se fusiona con Noreste
      expect(grupos).toHaveLength(1);
      expect(grupos[0].pedidos).toHaveLength(3);
      expect(grupos[0].nombreRuta).toContain('Noreste');
      expect(grupos[0].nombreRuta).toContain('Norte');
    });
  });

  describe('Ordenación de paradas dentro del sector sin zigzag (2-opt)', () => {
    it('ordena de la más cercana hacia la más lejana siguiendo el avance hacia afuera', () => {
      const pedidos: PedidoParaRuta[] = [
        {
          id: 'lejos',
          codigo: 'CP-LEJOS',
          cliente_nombre: 'Lejano',
          lat: local.lat + 0.03,
          lng: local.lng,
          minutosEspera: 5,
        },
        {
          id: 'cerca',
          codigo: 'CP-CERCA',
          cliente_nombre: 'Cercano',
          lat: local.lat + 0.005,
          lng: local.lng,
          minutosEspera: 50,
        },
        {
          id: 'medio',
          codigo: 'CP-MEDIO',
          cliente_nombre: 'Medio',
          lat: local.lat + 0.015,
          lng: local.lng,
          minutosEspera: 20,
        },
      ];

      const ordenados = optimizarOrdenSector(pedidos, local);
      expect(ordenados.map((p) => p.id)).toEqual(['cerca', 'medio', 'lejos']);
    });

    it('recorrido total con 2-opt es menor o igual al orden original y elimina cruces/zigzag', () => {
      // 4 puntos dispuestos en cruz/cuadrilátero donde el orden por llegada cruza caminos (zigzag)
      const p1: PedidoParaRuta = { id: 'p1', codigo: 'CP-1', cliente_nombre: 'A', lat: local.lat + 0.01, lng: local.lng + 0.01, minutosEspera: 40 };
      const p2: PedidoParaRuta = { id: 'p2', codigo: 'CP-2', cliente_nombre: 'B', lat: local.lat + 0.02, lng: local.lng - 0.01, minutosEspera: 30 };
      const p3: PedidoParaRuta = { id: 'p3', codigo: 'CP-3', cliente_nombre: 'C', lat: local.lat + 0.02, lng: local.lng + 0.01, minutosEspera: 20 };
      const p4: PedidoParaRuta = { id: 'p4', codigo: 'CP-4', cliente_nombre: 'D', lat: local.lat + 0.01, lng: local.lng - 0.01, minutosEspera: 10 };

      // Orden por antigüedad (p1 -> p2 -> p3 -> p4) genera cruces diagonales
      const ordenAntiguedad = [p1, p2, p3, p4];
      const distAntiguedad = calcularDistanciaRecorrido(ordenAntiguedad, local);

      const optimizados = optimizarOrdenSector(ordenAntiguedad, local);
      const distOptimizada = calcularDistanciaRecorrido(optimizados, local);

      // La distancia optimizada con 2-opt DEBE ser menor o igual que el orden por antigüedad
      expect(distOptimizada).toBeLessThanOrEqual(distAntiguedad);
    });
  });

  describe('Sugerencia de hasta 3 rutas de mayor urgencia', () => {
    it('sugiere hasta 3 rutas con colores accesibles distintos y ordenadas por urgencia de espera', () => {
      // Pedidos en 4 sectores distintos
      const pedidos: PedidoParaRuta[] = [
        // Sector Norte: 2 pedidos con espera alta (50 min -> MUY_TARDE)
        { id: 'n1', codigo: 'CP-N1', cliente_nombre: 'N1', lat: local.lat + 0.02, lng: local.lng, minutosEspera: 50 },
        { id: 'n2', codigo: 'CP-N2', cliente_nombre: 'N2', lat: local.lat + 0.03, lng: local.lng, minutosEspera: 45 },

        // Sector Este: 2 pedidos con espera media (32 min -> TARDE)
        { id: 'e1', codigo: 'CP-E1', cliente_nombre: 'E1', lat: local.lat, lng: local.lng + 0.02, minutosEspera: 32 },
        { id: 'e2', codigo: 'CP-E2', cliente_nombre: 'E2', lat: local.lat, lng: local.lng + 0.03, minutosEspera: 30 },

        // Sector Sur: 2 pedidos con espera leve (22 min -> RETRASADO)
        { id: 's1', codigo: 'CP-S1', cliente_nombre: 'S1', lat: local.lat - 0.02, lng: local.lng, minutosEspera: 22 },
        { id: 's2', codigo: 'CP-S2', cliente_nombre: 'S2', lat: local.lat - 0.03, lng: local.lng, minutosEspera: 21 },

        // Sector Oeste: 2 pedidos recién salidos (5 min -> NORMAL)
        { id: 'o1', codigo: 'CP-O1', cliente_nombre: 'O1', lat: local.lat, lng: local.lng - 0.02, minutosEspera: 5 },
        { id: 'o2', codigo: 'CP-O2', cliente_nombre: 'O2', lat: local.lat, lng: local.lng - 0.03, minutosEspera: 4 },
      ];

      const sugerencias = sugerirRutasPorSector(pedidos, local, {
        umbralRetrasadoMin: 20,
        umbralTardeMin: 30,
        umbralMuyTardeMin: 45,
      });

      // Máximo 3 rutas sugeridas
      expect(sugerencias).toHaveLength(3);

      // La primera debe ser la de mayor urgencia (Norte, con pedidos en 50 min)
      expect(sugerencias[0].nombre).toContain('Norte');
      expect(sugerencias[1].nombre).toContain('Este');
      expect(sugerencias[2].nombre).toContain('Sur');

      // Colores de buen contraste distintos
      const colores = sugerencias.map((r) => r.color);
      expect(new Set(colores).size).toBe(3);
      expect(colores[0]).toBe('#1E40AF'); // Azul
      expect(colores[1]).toBe('#C2410C'); // Naranja óxido
      expect(colores[2]).toBe('#15803D'); // Verde bosque
    });
  });
});
