import {
  COORDENADAS_LOCAL_DEFAULT,
  PedidoRutaInput,
  RutaService,
} from './ruta.service';

describe('RutaService (DT-80)', () => {
  let service: RutaService;

  beforeEach(() => {
    service = new RutaService();
  });

  describe('Cálculo de costo y orden voraz (DT-80)', () => {
    it('el que más espera va primero aunque esté lejos', () => {
      // Local en el origen por defecto
      const local = COORDENADAS_LOCAL_DEFAULT;

      // Pedido A: muy cerca del local (0.005 grados ~ 0.5 km), pero espera solo 5 minutos (factor 1.0)
      // costoA = distA * 3 - 5 * 1.0 = ~1.5 - 5 = -3.5
      const pedidoA: PedidoRutaInput = {
        id: 'A',
        lat: local.lat + 0.005,
        lng: local.lng,
        minutosEspera: 5,
        zona: 'Z2',
      };

      // Pedido B: lejos del local (0.08 grados ~ 9 km), pero espera 60 minutos (zona roja >= 50 min, factor 2.5)
      // costoB = distB * 3 - 60 * 2.5 = ~27 - 150 = -123
      const pedidoB: PedidoRutaInput = {
        id: 'B',
        lat: local.lat + 0.08,
        lng: local.lng,
        minutosEspera: 60,
        zona: 'Z4',
      };

      const resultado = service.calcularRuta(
        [pedidoA, pedidoB],
        [],
        local,
        { naranjaMin: 35, rojoMin: 50 },
        3,
      );

      // B debe ir primero porque su costo ponderado es más prioritario (más negativo)
      expect(resultado.orden[0]).toBe('B');
      expect(resultado.orden[1]).toBe('A');
    });

    it('pondera esperas: x1 hasta naranja, x1.5 desde naranja, x2.5 desde rojo', () => {
      expect(service.calcularFactorEspera(20, 35, 50)).toBe(1.0);
      expect(service.calcularFactorEspera(35, 35, 50)).toBe(1.5);
      expect(service.calcularFactorEspera(45, 35, 50)).toBe(1.5);
      expect(service.calcularFactorEspera(50, 35, 50)).toBe(2.5);
      expect(service.calcularFactorEspera(60, 35, 50)).toBe(2.5);
    });
  });

  describe('Detección «al paso» (DT-80)', () => {
    it('«al paso» detecta uno a 400 m y no uno a 2 km', () => {
      const local = COORDENADAS_LOCAL_DEFAULT;

      // El repartidor lleva 1 pedido propio ubicado a ~5 km al Norte
      // y = (lat - local.lat) * 111 => para 5 km, dLat = 5 / 111 ~ 0.045
      const pedidoPropio: PedidoRutaInput = {
        id: 'PROPIO_1',
        lat: local.lat + 0.045,
        lng: local.lng,
        minutosEspera: 20,
      };

      // Pedido libre C: a medio camino (y ~ 2.5 km al norte) y 400m al Este (x = 0.4 km)
      // x = (lng - local.lng) * 109 => dLng = 0.4 / 109 ~ 0.00367
      const pedidoAlPaso400m: PedidoRutaInput = {
        id: 'DISP_400M',
        lat: local.lat + 0.0225,
        lng: local.lng + 0.4 / 109,
        minutosEspera: 10,
      };

      // Pedido libre D: a medio camino pero a 2 km al Este (x = 2.0 km)
      const pedidoLejos2km: PedidoRutaInput = {
        id: 'DISP_2KM',
        lat: local.lat + 0.0225,
        lng: local.lng + 2.0 / 109,
        minutosEspera: 10,
      };

      const resultado = service.calcularRuta(
        [pedidoPropio],
        [pedidoAlPaso400m, pedidoLejos2km],
        local,
        { naranjaMin: 35, rojoMin: 50 },
        3,
      );

      expect(resultado.orden).toEqual(['PROPIO_1']);
      // Detecta el de 400m (<= 600m) y descarta el de 2km (> 600m)
      expect(resultado.paso).toContain('DISP_400M');
      expect(resultado.paso).not.toContain('DISP_2KM');
    });

    it('no sugiere pedidos al paso si el repartidor ya alcanzó el límite rep_max_pedidos', () => {
      const local = COORDENADAS_LOCAL_DEFAULT;
      const p1: PedidoRutaInput = { id: '1', lat: local.lat + 0.01, lng: local.lng, minutosEspera: 10 };
      const p2: PedidoRutaInput = { id: '2', lat: local.lat + 0.02, lng: local.lng, minutosEspera: 10 };
      const p3: PedidoRutaInput = { id: '3', lat: local.lat + 0.03, lng: local.lng, minutosEspera: 10 };

      const disp: PedidoRutaInput = { id: 'DISP', lat: local.lat + 0.015, lng: local.lng, minutosEspera: 5 };

      const resultado = service.calcularRuta([p1, p2, p3], [disp], local, { naranjaMin: 35, rojoMin: 50 }, 3);

      expect(resultado.paso).toHaveLength(0);
    });
  });

  describe('Resumen por lado y por zona (DT-80)', () => {
    it('clasifica correctamente los pedidos en Norte, Sur, Este, Oeste y zonas', () => {
      const local = COORDENADAS_LOCAL_DEFAULT;

      const pedidos = [
        // Norte: lat mayor
        { lat: local.lat + 0.02, lng: local.lng, zona: 'Z3' },
        { lat: local.lat + 0.03, lng: local.lng + 0.005, zona: 'Z3' },
        // Sur: lat menor
        { lat: local.lat - 0.02, lng: local.lng, zona: 'Z1' },
        // Este: lng mayor, dominante sobre lat
        { lat: local.lat + 0.001, lng: local.lng + 0.04, zona: 'Z5' },
        // Oeste: lng menor, dominante sobre lat
        { lat: local.lat, lng: local.lng - 0.04, zona: 'Z2' },
      ];

      const resumen = service.calcularLadosYZonas(pedidos, local);

      expect(resumen.total).toBe(5);
      expect(resumen.lados.Norte).toBe(2);
      expect(resumen.lados.Sur).toBe(1);
      expect(resumen.lados.Este).toBe(1);
      expect(resumen.lados.Oeste).toBe(1);

      expect(resumen.zonas['Z3']).toBe(2);
      expect(resumen.zonas['Z1']).toBe(1);
      expect(resumen.zonas['Z5']).toBe(1);
      expect(resumen.zonas['Z2']).toBe(1);
    });
  });
});
