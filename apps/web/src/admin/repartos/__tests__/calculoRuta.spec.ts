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
