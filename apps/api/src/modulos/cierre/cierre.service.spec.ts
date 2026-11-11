import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { CierreService } from './cierre.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { CobrosService } from '../caja/cobros.service';
import { ArqueoDto } from './dto/arqueo.dto';
import { CerrarCajaDto } from './dto/cerrar-caja.dto';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

describe('CierreService', () => {
  let service: CierreService;
  let prismaMock: any;
  let redisMock: any;
  let redisServiceMock: any;
  let auditoriaMock: any;
  let eventosGatewayMock: any;

  const mockUsuarioCajero: UsuarioAutenticado = {
    partyId: 101n,
    rol: 'CAJERO',
    debeCambiar: false,
  };

  const mockUsuarioAdmin: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  const mockUsuarioSupervisor: UsuarioAutenticado = {
    partyId: 102n,
    rol: 'SUPERVISOR',
    debeCambiar: false,
  };

  const mockCajaAbierta = {
    id: 10n,
    fecha: new Date('2026-10-21'),
    apertura: 50.0,
    estado: 'ABIERTA',
    abierta_por: 101n,
    cerrada_por: null,
    cerrada_en: null,
  };

  // 1 cobro en efectivo: recibido 100, vuelto 10 -> neto 90; + 210 neto = 300 en efectivo
  // Yape: 200, Plin: 0, Transferencia: 50, Tarjeta: 100
  const mockCobros = [
    {
      id: 1n,
      caja_id: 10n,
      total: 90.0,
      anulado_en: null,
      pagos: [
        {
          id: 11n,
          medio: 'EFECTIVO',
          monto: 90.0,
          recibido: 100.0,
          vuelto: 10.0,
        },
      ],
    },
    {
      id: 2n,
      caja_id: 10n,
      total: 210.0,
      anulado_en: null,
      pagos: [
        {
          id: 12n,
          medio: 'EFECTIVO',
          monto: 210.0,
          recibido: null,
          vuelto: null,
        },
      ],
    },
    {
      id: 3n,
      caja_id: 10n,
      total: 200.0,
      anulado_en: null,
      pagos: [
        {
          id: 13n,
          medio: 'YAPE',
          monto: 200.0,
          recibido: null,
          vuelto: null,
        },
      ],
    },
    {
      id: 4n,
      caja_id: 10n,
      total: 150.0,
      anulado_en: null,
      pagos: [
        {
          id: 14n,
          medio: 'TRANSFERENCIA',
          monto: 50.0,
          recibido: null,
          vuelto: null,
        },
        {
          id: 15n,
          medio: 'TARJETA',
          monto: 100.0,
          recibido: null,
          vuelto: null,
        },
      ],
    },
  ];

  // Movimientos: ingreso 20, egreso 15
  const mockMovimientos = [
    {
      id: 1n,
      caja_id: 10n,
      tipo: 'INGRESO',
      monto: 20.0,
      motivo: 'Sencillo inicial extra',
      anulado_en: null,
    },
    {
      id: 2n,
      caja_id: 10n,
      tipo: 'EGRESO',
      monto: 15.0,
      motivo: 'Compra de hielo',
      anulado_en: null,
    },
  ];

  beforeEach(async () => {
    redisMock = {
      get: jest.fn().mockResolvedValue(null),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(1),
      del: jest.fn().mockResolvedValue(1),
    };

    redisServiceMock = {
      obtenerCliente: jest.fn().mockReturnValue(redisMock),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    eventosGatewayMock = {
      emitirAdmin: jest.fn(),
    };

    prismaMock = {
      caja: {
        findFirst: jest.fn().mockResolvedValue(mockCajaAbierta),
        findUnique: jest.fn().mockResolvedValue(mockCajaAbierta),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(1),
        update: jest.fn().mockResolvedValue({ ...mockCajaAbierta, estado: 'CERRADA' }),
      },
      cobro: {
        // Con el include de pedido que pide obtenerEsperado para la lista de cobros del turno
        findMany: jest.fn().mockResolvedValue(
          mockCobros.map((c) => ({
            ...c,
            pedido_id: c.id,
            en: new Date('2026-10-21T15:00:00Z'),
            pedido: { codigo: `PED-${c.id}`, cliente_nombre: 'Ana' },
          })),
        ),
      },
      movimientoCaja: {
        findMany: jest.fn().mockResolvedValue(mockMovimientos),
      },
      conteoCierre: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1n, ...data })),
      },
      cierreCaja: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockRejectedValue(new Error('El cierre de caja no se edita ni se borra')),
        delete: jest.fn().mockRejectedValue(new Error('El cierre de caja no se edita ni se borra')),
      },
      cierreMedio: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
      cierreAjusteMedio: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 1n, creado_en: new Date('2026-10-21T16:00:00Z'), ...data })),
      },
      pedido: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      devolucionPedido: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      pedidoCambioUbicacion: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      party: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 55n,
          tipo: 'PERSONA',
          persona: { nombres: 'Carlos', apellidos: 'Repartidor' },
        }),
      },
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      liquidacion: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 100n, ...data })),
      },
      userAccount: {
        findMany: jest.fn().mockResolvedValue([]),
        // Por defecto nadie es ADMIN/SUPERVISOR activo: solo el cajero
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaMock)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CierreService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
        { provide: CobrosService, useValue: { cobrarEnCierre: jest.fn(), descontarInsumosSinCobro: jest.fn() } },
      ],
    }).compile();

    service = module.get<CierreService>(CierreService);
  });

  // -------------------------------------------------------------------------
  // 1. Arqueo que cuadra
  // -------------------------------------------------------------------------
  describe('1. arqueo que cuadra', () => {
    it('debe calcular montos a ciegas y retornar resultado CUADRA en intento 1 sin exponer el esperado', async () => {
      // Efectivo esperado: 50 (apertura) + 300 (cobros netos) + 20 (ingreso) - 15 (egreso) = 355.00
      // Conteo: 1x200 + 1x100 + 1x50 + 1x5 = 355.00
      const dto: ArqueoDto = {
        conteo: {
          '200': 1,
          '100': 1,
          '50': 1,
          '5': 1,
        },
        medios: {
          yape: 200.0,
          plin: 0.0,
          transferencia: 50.0,
          tarjeta: 100.0,
        },
      };

      const resultado = await service.arqueo(dto, mockUsuarioCajero);

      expect(resultado).toEqual({
        resultado: 'CUADRA',
        intento: 1,
      });

      // Asegurar que la respuesta es 100% ciega (no filtra esperado ni diferencia)
      expect((resultado as any).esperado).toBeUndefined();
      expect((resultado as any).diferencia).toBeUndefined();
      expect((resultado as any).sistema).toBeUndefined();

      expect(prismaMock.conteoCierre.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          caja_id: 10n,
          intento: 1,
          resultado: 'CUADRA',
          por: mockUsuarioCajero.partyId,
        }),
      });

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'cierre',
          accion: 'ARQUEO',
          resultado: 'OK',
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. Arqueo que no cuadra y no muestra el esperado
  // -------------------------------------------------------------------------
  describe('2. que no cuadra y no muestra el esperado', () => {
    it('debe registrar NO_CUADRA y la respuesta no debe revelar monto esperado ni diferencia (DT-61)', async () => {
      // Conteo con 5 soles de menos: 350 en lugar de 355
      const dto: ArqueoDto = {
        conteo: {
          '200': 1,
          '100': 1,
          '50': 1,
        },
        medios: {
          yape: 200.0,
          plin: 0.0,
          transferencia: 50.0,
          tarjeta: 100.0,
        },
      };

      const resultado = await service.arqueo(dto, mockUsuarioCajero);

      expect(resultado).toEqual({
        resultado: 'NO_CUADRA',
        intento: 1,
      });

      // Blind check: no debe revelar cuánto falta ni qué medio descuadra
      expect(Object.keys(resultado)).toEqual(['resultado', 'intento']);
      expect((resultado as any).esperado).toBeUndefined();
      expect((resultado as any).diferencias).toBeUndefined();

      expect(prismaMock.conteoCierre.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          resultado: 'NO_CUADRA',
          intento: 1,
        }),
      });
    });
  });

  // -------------------------------------------------------------------------
  // 3. Cierre descuadrado: sin código de supervisor, con nota y auditado
  // -------------------------------------------------------------------------
  describe('3. cierre descuadrado sin código de supervisor', () => {
    it('cierra caja descuadrada con nota, sin ningún código, y queda auditado a nombre de quien cierra', async () => {
      const dtoCerrar: CerrarCajaDto = {
        conteo: { '200': 1 }, // 200 vs 355 esperado
        medios: { yape: 200, plin: 0, transferencia: 50, tarjeta: 100 },
        nota: 'Faltante de turno tarde',
      };

      const res = await service.cerrar(dtoCerrar, mockUsuarioCajero);

      expect(res.resultado).toBe('NO_CUADRA');
      expect(res.nota).toBe('Faltante de turno tarde');
      expect(prismaMock.cierreCaja.create).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ modulo: 'cierre', accion: 'CERRAR_CAJA', partyId: mockUsuarioCajero.partyId }),
      );
    });

    it('tras 3 arqueos que no cuadraron, el cuarto arqueo ya no pide PIN', async () => {
      prismaMock.conteoCierre.count.mockResolvedValue(3);

      const resultado = await service.arqueo({ conteo: { '200': 1 }, medios: { yape: 200 } }, mockUsuarioCajero);

      expect(resultado).toEqual({ resultado: 'NO_CUADRA', intento: 4 });
    });

    it('un arqueo que cuadra no suma: con 3 intentos previos y solo 1 que no cuadró, el cuarto no pide PIN', async () => {
      prismaMock.conteoCierre.count.mockImplementation(async ({ where }: any) =>
        where.resultado === 'NO_CUADRA' ? 1 : 3,
      );

      // mismo conteo que el arqueo que cuadra del bloque 1
      const dtoCuadra: ArqueoDto = {
        conteo: { '200': 1, '100': 1, '50': 1, '5': 1 },
        medios: { yape: 200.0, plin: 0.0, transferencia: 50.0, tarjeta: 100.0 },
      };

      const resultado = await service.arqueo(dtoCuadra, mockUsuarioCajero);

      expect(resultado).toEqual({ resultado: 'CUADRA', intento: 4 });
    });

    it('en el cierre tampoco cuentan los arqueos que cuadraron: con 3 que cuadraron y 1 que no, no pide PIN', async () => {
      const cuadra = { conteo: { '200': 1, '100': 1, '50': 1, '5': 1 }, medios: { yape: 200, plin: 0, transferencia: 50, tarjeta: 100 } };
      prismaMock.conteoCierre.findMany.mockResolvedValue([
        { intento: 4, resultado: 'CUADRA', ...cuadra },
        { intento: 3, resultado: 'CUADRA', ...cuadra },
        { intento: 2, resultado: 'CUADRA', ...cuadra },
        { intento: 1, resultado: 'NO_CUADRA', conteo: { '200': 1 }, medios: { yape: 200 } },
      ]);

      const dtoCerrar: CerrarCajaDto = {
        conteo: { '200': 1, '100': 1, '50': 1, '5': 1 },
        medios: { yape: 200, plin: 0, transferencia: 50, tarjeta: 100 },
      };

      // Cuadra con el sistema: el cierre no exige PIN de supervisor (puede fallar por otra causa del mock)
      const error = await service.cerrar(dtoCerrar, mockUsuarioCajero, undefined).catch((e) => e);
      expect(error?.getResponse?.()?.codigo).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // 4. Cierre inmutable
  // -------------------------------------------------------------------------
  describe('4. cierre inmutable', () => {
    it('garantiza inmutabilidad bloqueando cualquier modificación o borrado de cierre_caja (RN-CAP-080)', async () => {
      await expect(
        prismaMock.cierreCaja.update({ where: { caja_id: 10n }, data: { nota: 'cambio' } }),
      ).rejects.toThrow('El cierre de caja no se edita ni se borra');

      await expect(
        prismaMock.cierreCaja.delete({ where: { caja_id: 10n } }),
      ).rejects.toThrow('El cierre de caja no se edita ni se borra');
    });
  });

  // -------------------------------------------------------------------------
  // 5. Diferencias por medio
  // -------------------------------------------------------------------------
  describe('5. diferencias por medio', () => {
    it('guarda y muestra diferencias individuales por medio (efectivo, yape, plin, transferencia, tarjeta) en el detalle', async () => {
      // Esperado:
      // Efectivo = 355 -> Visto = 350 -> Dif = -5.00
      // Yape = 200 -> Visto = 210 -> Dif = +10.00
      // Plin = 0 -> Visto = 0 -> Dif = 0.00
      // Transferencia = 50 -> Visto = 50 -> Dif = 0.00
      // Tarjeta = 100 -> Visto = 90 -> Dif = -10.00
      const dtoCerrar: CerrarCajaDto = {
        conteo: { '200': 1, '100': 1, '50': 1 }, // 350
        medios: {
          yape: 210.0,
          plin: 0.0,
          transferencia: 50.0,
          tarjeta: 90.0,
        },
        nota: 'Sobrante en Yape y faltante en terminal de tarjeta',
      };

      // Yape y tarjeta se corrigieron antes con motivo: el cierre guarda esos valores como vistos
      prismaMock.cierreAjusteMedio.findMany.mockResolvedValue([
        { id: 1n, caja_id: 10n, medio: 'YAPE', monto_sistema: 200, monto_anterior: 200, monto_nuevo: 210, motivo: 'Voucher leído con 210', por_party_id: 101n, autorizado_por_party_id: 2n, creado_en: new Date() },
        { id: 2n, caja_id: 10n, medio: 'TARJETA', monto_sistema: 100, monto_anterior: 100, monto_nuevo: 90, motivo: 'Terminal cobró 90 real', por_party_id: 101n, autorizado_por_party_id: 2n, creado_en: new Date() },
      ]);

      const resCerrar = await service.cerrar(dtoCerrar, mockUsuarioCajero);

      // Quien cierra ve el esperado y la diferencia (el conteo a ciegas ya no se usa)
      expect(resCerrar.medios).toBeDefined();
      expect(resCerrar.diferenciaTotal).toBe(-5);
      const medioYape = prismaMock.cierreMedio.create.mock.calls.map((c: any) => c[0].data).find((d: any) => d.medio === 'YAPE');
      expect(medioYape).toMatchObject({ sistema: 200, visto: 210 });

      // Verificación de consulta GET por ID
      prismaMock.cierreCaja.findUnique.mockResolvedValue({
        caja_id: 10n,
        resultado: 'NO_CUADRA',
        aprobado_por: 2n,
        nota: dtoCerrar.nota,
        conteo: dtoCerrar.conteo,
        caja: mockCajaAbierta,
        medios: [
          { medio: 'EFECTIVO', sistema: 355.0, visto: 350.0, diferencia: -5.0 },
          { medio: 'YAPE', sistema: 200.0, visto: 210.0, diferencia: 10.0 },
          { medio: 'PLIN', sistema: 0.0, visto: 0.0, diferencia: 0.0 },
          { medio: 'TRANSFERENCIA', sistema: 50.0, visto: 50.0, diferencia: 0.0 },
          { medio: 'TARJETA', sistema: 100.0, visto: 90.0, diferencia: -10.0 },
        ],
      });

      const detalle = await service.obtenerCierrePorId(10n, mockUsuarioAdmin);
      expect(detalle.resultado).toBe('NO_CUADRA');
      expect(detalle.medios).toHaveLength(5);
      expect(detalle.medios.find((m) => m.medio === 'YAPE')?.diferencia).toBe(10.0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Liquidación de repartidores
  // -------------------------------------------------------------------------
  describe('6. liquidación de repartidores', () => {
    it('lista solo el contra entrega en efectivo (lo cobrado en caja no es del repartidor) y calcula saldo por liquidar', async () => {
      // 2 pedidos delivery entregados para el repartidor 55
      prismaMock.pedido.findMany.mockResolvedValue([
        {
          id: 501n,
          codigo: 'CP-W101',
          modalidad: 'DELIVERY',
          estado: 'ENTREGADO',
          repartidor_party_id: 55n,
          total: 40.0,
          pago_metodo: 'EFECTIVO',
          entregado_en: new Date(),
          repartidor: {
            persona: { nombres: 'Marcos', apellidos: 'Ruta' },
          },
          cobros: [{
            anulado_en: null,
            pagos: [{ medio: 'EFECTIVO', monto: 40.0 }],
          }],
        },
        {
          id: 502n,
          codigo: 'CP-W102',
          modalidad: 'DELIVERY',
          estado: 'ENTREGADO',
          repartidor_party_id: 55n,
          total: 60.0,
          pago_metodo: 'EFECTIVO',
          entregado_en: new Date(),
          repartidor: {
            persona: { nombres: 'Marcos', apellidos: 'Ruta' },
          },
          cobros: [],
        },
      ]);

      // Ya liquidó 30 anteriormente
      prismaMock.liquidacion.findMany.mockResolvedValue([
        {
          id: 1n,
          caja_id: 10n,
          repartidor_party_id: 55n,
          esperado: 30.0,
          entregado: 30.0,
        },
      ]);

      const lista = await service.listarRepartidoresPorLiquidar();

      expect(lista).toHaveLength(1);
      expect(lista[0]).toEqual({
        repartidorPartyId: 55,
        nombre: 'Marcos Ruta',
        pedidos: expect.any(Array),
        totalCobrado: 60.0,
        totalLiquidado: 30.0,
        pendiente: 30.0,
      });
    });

    it('al liquidar, suma los puntos de los pedidos contra entrega del repartidor', async () => {
      const acumular = jest.fn().mockResolvedValue({ puntos: 1, sumados: true });
      (service as any).puntosService = { acumularPorPedido: acumular };
      jest.spyOn(service as any, 'repartidoresConEfectivo').mockResolvedValue([
        {
          repartidorPartyId: '55',
          nombre: 'Marcos Ruta',
          pedidos: [{ id: 901 }, { id: 902 }],
          cobradoCentimos: 7000,
          liquidadoCentimos: 0,
          pendienteCentimos: 7000,
        },
      ]);

      await service.liquidarRepartidor({ repartidorPartyId: 55, entregado: 70.0 }, mockUsuarioCajero);

      expect(acumular).toHaveBeenCalledTimes(2);
      expect(acumular).toHaveBeenCalledWith(901n);
      expect(acumular).toHaveBeenCalledWith(902n);
    });

    it('registra entrega de efectivo, calcula diferencia y audita liquidación', async () => {
      // Mock de listado con saldo pendiente de 70.00
      jest.spyOn(service as any, 'repartidoresConEfectivo').mockResolvedValue([
        {
          repartidorPartyId: '55',
          nombre: 'Marcos Ruta',
          pedidos: [],
          cobradoCentimos: 10000,
          liquidadoCentimos: 3000,
          pendienteCentimos: 7000,
        },
      ]);

      const res = await service.liquidarRepartidor(
        { repartidorPartyId: 55, entregado: 70.0 },
        mockUsuarioCajero,
        '127.0.0.1',
      );

      expect(res).toEqual({
        id: 100,
        cajaId: 10,
        repartidorPartyId: 55,
        esperado: 70.0,
        entregado: 70.0,
        diferencia: 0.0,
      });

      expect(prismaMock.liquidacion.create).toHaveBeenCalledWith({
        data: {
          caja_id: 10n,
          repartidor_party_id: 55n,
          esperado: 70.0,
          entregado: 70.0,
        },
      });

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'cierre',
          accion: 'LIQUIDAR_REPARTIDOR',
          entidad: 'liquidacion',
          resultado: 'OK',
        }),
      );
    });

    it('al liquidar, sus pedidos contra entrega dejan de estar pendientes de cobro (no bloquean el cierre)', async () => {
      jest.spyOn(service as any, 'repartidoresConEfectivo').mockResolvedValue([
        {
          repartidorPartyId: '55',
          nombre: 'Marcos Ruta',
          pedidos: [{ id: 502, codigo: 'CP-W102', total: 60, entregadoEn: new Date() }],
          cobradoCentimos: 6000,
          liquidadoCentimos: 0,
          pendienteCentimos: 6000,
        },
      ]);

      await service.liquidarRepartidor({ repartidorPartyId: 55, entregado: 60 }, mockUsuarioCajero);

      expect(prismaMock.pedido.updateMany).toHaveBeenCalledWith({
        where: { id: { in: [502n] }, pago_estado: { in: ['PENDIENTE', 'COORDINADO'] } },
        data: { pago_estado: 'PAGADO' },
      });
    });
  });

  describe('H2: plan dividido en delivery asienta la parte digital como Cobro al liquidar', () => {
    const repartidor = [
      {
        repartidorPartyId: '55',
        nombre: 'Marcos Ruta',
        pedidos: [{ id: 510, codigo: 'CP-W110', total: 2, entregadoEn: new Date() }],
        cobradoCentimos: 200,
        liquidadoCentimos: 0,
        pendienteCentimos: 200,
      },
    ];

    it('Yape 38 + efectivo 2: crea el Cobro digital (38) en la caja abierta y el efectivo entra por la liquidación', async () => {
      jest.spyOn(service as any, 'repartidoresConEfectivo').mockResolvedValue(repartidor);
      prismaMock.cobro.create = jest.fn().mockResolvedValue({ id: 1n });
      prismaMock.pedido.findMany.mockResolvedValue([
        { id: 510n, planPago: [{ medio: 'YAPE', monto: 38 }, { medio: 'EFECTIVO', monto: 2 }] },
      ]);

      await service.liquidarRepartidor({ repartidorPartyId: 55, entregado: 2 }, mockUsuarioCajero);

      expect(prismaMock.cobro.create).toHaveBeenCalledTimes(1);
      const data = prismaMock.cobro.create.mock.calls[0][0].data;
      expect(data.pedido_id).toBe(510n);
      expect(data.caja_id).toBe(10n);
      expect(data.total).toBe(38);
      expect(data.pagos.create).toEqual([{ medio: 'YAPE', monto: 38, propina: 0 }]);
      // el efectivo (2) sigue entrando por la liquidación, no por el cobro
      expect(prismaMock.liquidacion.create.mock.calls[0][0].data.entregado).toBe(2);
      expect(prismaMock.pedido.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { pago_estado: 'PAGADO' } }));
    });

    it('un pedido solo en efectivo no crea ningún cobro', async () => {
      jest.spyOn(service as any, 'repartidoresConEfectivo').mockResolvedValue(repartidor);
      prismaMock.cobro.create = jest.fn();
      prismaMock.pedido.findMany.mockResolvedValue([{ id: 510n, planPago: [] }]);
      await service.liquidarRepartidor({ repartidorPartyId: 55, entregado: 2 }, mockUsuarioCajero);
      expect(prismaMock.cobro.create).not.toHaveBeenCalled();
    });
  });

  describe('H1: el cierre no se hace a ciegas con pagos sin cobro', () => {
    const dto: any = { conteo: { '200': 1, '100': 1, '50': 1, '5': 1 }, medios: { yape: 200, plin: 0, transferencia: 50, tarjeta: 100 } };
    const sinCobro = { codigo: 'CP-9', total: 45.5, pago_metodo: 'YAPE', planPago: [] };
    // la consulta de pagados sin cobro se reconoce por su filtro; el resto (reparto) no devuelve nada
    const conSinCobro = () =>
      prismaMock.pedido.findMany.mockImplementation(async (a: any) => (a?.where?.pago_estado === 'PAGADO' ? [sinCobro] : []));

    it('con pedidos PAGADO sin cobro del día y sin nota responde 409 PAGOS_SIN_COBRO con la lista y no cierra', async () => {
      conSinCobro();
      await expect(service.cerrar(dto, mockUsuarioCajero)).rejects.toMatchObject({
        response: { codigo: 'PAGOS_SIN_COBRO', pedidos: [{ codigo: 'CP-9', total: 45.5, medio: 'YAPE' }] },
      });
      expect(prismaMock.cierreCaja.create).not.toHaveBeenCalled();
    });

    it('con nota cierra y deja los pedidos en la auditoría del cierre', async () => {
      conSinCobro();
      await service.cerrar({ ...dto, nota: 'Yape confirmado antes de la corrección' }, mockUsuarioCajero);
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'CERRAR_CAJA', despues: expect.objectContaining({ pagos_sin_cobro: ['CP-9 S/ 45.50 YAPE'] }) }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 7. Cobros en curso impiden cerrar la caja
  // -------------------------------------------------------------------------
  describe('7. cobros en curso', () => {
    it('rechaza cerrar la caja si existen pedidos pendientes de pago o confirmación (409)', async () => {
      prismaMock.pedido.count.mockResolvedValue(2);

      await expect(
        service.cerrar(
          { conteo: { '200': 1 }, medios: { yape: 200 } },
          mockUsuarioCajero,
        ),
      ).rejects.toThrow(HttpException);

      try {
        await service.cerrar(
          { conteo: { '200': 1 }, medios: { yape: 200 } },
          mockUsuarioCajero,
        );
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(e.getResponse().codigo).toBe('COBROS_EN_CURSO');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 8. Montos esperados del sistema (solo ADMIN)
  // -------------------------------------------------------------------------
  describe('8. montos esperados en vivo', () => {
    it('el cajero, el SUPERVISOR y el ADMIN ven el esperado sin código (el conteo a ciegas ya no se usa)', async () => {
      const caj = await service.obtenerEsperado(mockUsuarioCajero);
      expect(caj.cajaId).toBe(10);
      expect(caj.efectivoEsperado).toBe(355);
      const sup = await service.obtenerEsperado(mockUsuarioSupervisor);
      expect(sup.cajaId).toBe(10);

      // ADMIN recibe totales en vivo
      const esperado = await service.obtenerEsperado(mockUsuarioAdmin);
      expect(esperado).toEqual(
        expect.objectContaining({
          cajaId: 10,
          efectivoEsperado: 355.0,
          medios: {
            efectivo: 355.0,
            yape: 200.0,
            plin: 0.0,
            transferencia: 50.0,
            tarjeta: 100.0,
          },
          desglose: {
            ventasEfectivo: 300.0,
            ingresos: 20.0,
            egresos: 15.0,
            liquidadoRepartidores: 0,
            propinas: { total: 0, efectivo: 0, digital: 0 },
            // Desglose llano: 50 + 300 + 0 + 20 − 15 = 355 (el vuelto de 10 ya está descontado en el cobro)
            apertura: 50,
            cobrosEfectivo: 300,
            vueltos: 10,
            esperado: 355,
            porMedio: { efectivo: 355, yape: 200, plin: 0, transferencia: 50, tarjeta: 100 },
          },
        }),
      );
      const d = esperado.desglose;
      expect(d.apertura + d.cobrosEfectivo + d.liquidadoRepartidores + d.ingresos - d.egresos).toBe(d.esperado);
    });
  });

  // -------------------------------------------------------------------------
  // 8b. Turno de la caja abierta: cobros y movimientos de ESA caja, no de la de hoy
  // -------------------------------------------------------------------------
  describe('8b. turno de la caja abierta de cualquier día', () => {
    const cajaAyer = { ...mockCajaAbierta, id: 7n, fecha: new Date('2026-11-02') };
    const cajaHoy = { ...mockCajaAbierta, id: 8n, fecha: new Date('2026-11-03'), estado: 'CERRADA' };

    beforeEach(() => {
      // Caja de ayer abierta y una de hoy (cerrada) en la base: el turno sale de la abierta
      prismaMock.caja.findFirst.mockResolvedValue(cajaAyer);
      prismaMock.caja.findUnique.mockImplementation(async ({ where }: any) => (where.id === 7n ? cajaAyer : cajaHoy));
    });

    it('el ADMIN recibe los cobros y movimientos de la caja abierta de ayer, con los mismos totales', async () => {
      const esperado = await service.obtenerEsperado(mockUsuarioAdmin);

      expect(esperado.cajaId).toBe(7);
      expect(prismaMock.cobro.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { caja_id: 7n } }));
      expect(prismaMock.movimientoCaja.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { caja_id: 7n } }),
      );
      expect(esperado.cobrados).toHaveLength(4);
      expect(esperado.cobrados[0]).toEqual({
        pedidoId: '1',
        codigo: 'PED-1',
        cliente: 'Ana',
        total: 90,
        medios: ['EFECTIVO'],
        en: new Date('2026-10-21T15:00:00Z'),
      });
      // Lo que suman las listas es lo mismo que los totales por medio: 300 + 200 + 50 + 100
      const sumaCobros = esperado.cobrados.reduce((a, c) => a + c.total, 0);
      const { yape, plin, transferencia, tarjeta } = esperado.medios;
      const sumaMedios = esperado.desglose.ventasEfectivo + yape + plin + transferencia + tarjeta;
      expect(sumaCobros).toBe(650);
      expect(sumaMedios).toBe(650);
      expect(esperado.movimientos.map((m) => m.motivo)).toEqual(['Sencillo inicial extra', 'Compra de hielo']);
    });

    it('agrega el detalle de ventas (ventas) sin tocar cobrados ni los totales del cierre', async () => {
      const esperado = await service.obtenerEsperado(mockUsuarioAdmin);
      expect(esperado.ventas).toHaveLength(esperado.cobrados.length);
      expect(esperado.ventas.map((v) => v.pedidoId)).toEqual(esperado.cobrados.map((c) => c.pedidoId));
      // Los mismos totales de siempre
      expect(esperado.efectivoEsperado).toBe(355);
      expect(esperado.medios).toEqual({ efectivo: 355, yape: 200, plin: 0, transferencia: 50, tarjeta: 100 });
      expect(esperado.cobrados.reduce((a, c) => a + c.total, 0)).toBe(650);
    });

    it('el cajero también recibe cobros y movimientos de la caja abierta (sin código)', async () => {
      const esperado = await service.obtenerEsperado(mockUsuarioCajero);
      expect(esperado.cajaId).toBe(7);
      expect(esperado.cobrados).toHaveLength(4);
      expect(esperado.movimientos).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // 9. Validaciones de cierre adicionales (RN-CAP-097, notas, arqueo previo)
  // -------------------------------------------------------------------------
  describe('9. validaciones de cierre adicionales', () => {
    it('rechaza cerrar la caja si existen repartidores con efectivo pendiente por liquidar (RN-CAP-097 / RQ-CIE-02-08)', async () => {
      jest.spyOn(service as any, 'repartidoresConEfectivo').mockResolvedValue([
        {
          repartidorPartyId: '77',
          nombre: 'Luis Mensajero',
          pedidos: [],
          cobradoCentimos: 5000,
          liquidadoCentimos: 0,
          pendienteCentimos: 5000,
        },
      ]);

      await expect(
        service.cerrar(
          { conteo: { '200': 1 }, medios: { yape: 200 } },
          mockUsuarioCajero,
        ),
      ).rejects.toThrow(HttpException);

      try {
        await service.cerrar(
          { conteo: { '200': 1 }, medios: { yape: 200 } },
          mockUsuarioCajero,
        );
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(e.getResponse().codigo).toBe('REPARTIDORES_SIN_LIQUIDAR');
        expect(e.getResponse().mensaje).toContain('Luis Mensajero');
      }
    });

    it('cierra con FALTA aunque no haya nota: guarda NO_CUADRA, la diferencia por medio y no pide aprobación', async () => {
      const res = await service.cerrar({ conteo: { '200': 1 }, medios: { yape: 200 }, nota: '  ' }, mockUsuarioCajero);
      expect(res.resultado).toBe('NO_CUADRA');
      const creada = prismaMock.cierreCaja.create.mock.calls[0][0].data;
      expect(creada.resultado).toBe('NO_CUADRA');
      expect(creada.nota).toBeNull();
      // La BD (ck_cierre_caja_aprobacion) rechaza NO_CUADRA sin aprobado_por: se guarda quien cierra (era el error 500 del cierre con diferencia)
      expect(creada.aprobado_por).toBe(mockUsuarioCajero.partyId);
      const ef = res.medios!.find((m: any) => m.medio === 'EFECTIVO');
      expect(ef).toMatchObject({ sistema: 355, visto: 200, diferencia: -155 });
      expect(res.diferenciaTotal).toBe(-155);
    });

    it('cierra con SOBRA, guarda la nota y la diferencia total suma todos los medios', async () => {
      const res = await service.cerrar(
        { conteo: { '200': 1, '100': 1, '50': 1, '5': 1, '2': 1 }, medios: { yape: 210 }, nota: 'Me dieron de más' },
        mockUsuarioCajero,
      );
      expect(res.resultado).toBe('NO_CUADRA');
      expect(res.nota).toBe('Me dieron de más');
      // efectivo 357 vs 355 = +2; yape 210 vs 200 = +10
      expect(res.diferenciaTotal).toBe(12);
      expect(prismaMock.cierreCaja.create.mock.calls[0][0].data.nota).toBe('Me dieron de más');
    });

    it('cierra CUADRA con el efectivo como total directo (sin billetes) y lo guarda en el conteo', async () => {
      const res = await service.cerrar({ efectivoTotal: 355, medios: { yape: 200, plin: 0, transferencia: 50, tarjeta: 100 } }, mockUsuarioCajero);
      expect(res.resultado).toBe('CUADRA');
      expect(res.diferenciaTotal).toBe(0);
      expect(prismaMock.cierreCaja.create.mock.calls[0][0].data.conteo).toEqual({ total_directo: 355 });
    });

    it('sin conteo ni total ya no exige arqueo previo: el efectivo cuenta cero y cierra con diferencia', async () => {
      prismaMock.conteoCierre.findMany.mockResolvedValue([]);
      const res = await service.cerrar({}, mockUsuarioCajero);
      expect(res.resultado).toBe('NO_CUADRA');
      expect(res.diferenciaTotal).toBe(-355);
    });

    it('el arqueo previo que NO cuadró no cuenta intentos ni exige nada para cerrar', async () => {
      prismaMock.conteoCierre.findMany.mockResolvedValue([
        { intento: 3, resultado: 'NO_CUADRA' },
        { intento: 2, resultado: 'NO_CUADRA' },
        { intento: 1, resultado: 'NO_CUADRA' },
      ]);
      await expect(service.cerrar({ efectivoTotal: 355 }, mockUsuarioCajero)).resolves.toMatchObject({ resultado: 'CUADRA' });
    });
  });

  // -------------------------------------------------------------------------
  // 10. Historial y consultas por ID
  // -------------------------------------------------------------------------
  describe('10. historial y detalle', () => {
    it('lista el historial de cierres con paginación y filtros de fecha', async () => {
      prismaMock.caja.count.mockResolvedValue(1);
      prismaMock.caja.findMany.mockResolvedValue([
        {
          ...mockCajaAbierta,
          id: 10n,
          estado: 'CERRADA',
          cerrada_por: 101n,
          cerrada_en: new Date('2026-10-21T23:00:00Z'),
          cierre: {
            resultado: 'CUADRA',
            aprobado_por: null,
            nota: null,
            medios: [
              { medio: 'EFECTIVO', sistema: 355.0, visto: 355.0, diferencia: 0 },
            ],
          },
        },
      ]);

      const res = await service.historial(
        {
          pagina: 1,
          limite: 10,
          desde: '2026-10-01',
          hasta: '2026-10-31',
        },
        mockUsuarioAdmin,
      );

      expect(res.total).toBe(1);
      expect(res.pagina).toBe(1);
      expect(res.totalPaginas).toBe(1);
      expect(res.cierres).toHaveLength(1);
      expect(res.cierres[0].cierre?.resultado).toBe('CUADRA');
    });

    it('el historial muestra el nombre de quien cerró la caja, no solo su ID', async () => {
      prismaMock.caja.count.mockResolvedValue(1);
      prismaMock.caja.findMany.mockResolvedValue([
        { ...mockCajaAbierta, id: 10n, estado: 'CERRADA', cerrada_por: 101n, cerrada_en: new Date(), cierre: { resultado: 'CUADRA', aprobado_por: null, nota: null, medios: [] } },
      ]);
      prismaMock.party.findMany.mockResolvedValue([
        { id: 101n, persona: { nombres: 'Ana', apellidos: 'Caja' } },
      ]);

      const res = await service.historial({ pagina: 1, limite: 10 }, mockUsuarioAdmin);

      expect(res.cierres[0].cerradaPor).toBe(101);
      expect(res.cierres[0].cerradaPorNombre).toBe('Ana Caja');
    });

    it('retorna 404 si el cierre no existe al buscar por ID', async () => {
      prismaMock.cierreCaja.findUnique.mockResolvedValue(null);

      await expect(service.obtenerCierrePorId(999, mockUsuarioAdmin)).rejects.toThrow(HttpException);

      try {
        await service.obtenerCierrePorId(999, mockUsuarioAdmin);
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(e.getResponse().codigo).toBe('CIERRE_NO_ENCONTRADO');
      }
    });

    it('retorna 400 si el ID proporcionado no es un número válido', async () => {
      await expect(service.obtenerCierrePorId('invalido', mockUsuarioAdmin)).rejects.toThrow(HttpException);

      try {
        await service.obtenerCierrePorId('invalido', mockUsuarioAdmin);
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(e.getResponse().codigo).toBe('ID_INVALIDO');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 11. Errores de caja y repartidor
  // -------------------------------------------------------------------------
  describe('11. errores de caja y repartidor', () => {
    it('falla con NO_HAY_CAJA_ABIERTA cuando no hay caja abierta', async () => {
      prismaMock.caja.findFirst.mockResolvedValue(null);

      await expect(service.obtenerCajaAbierta()).rejects.toThrow(HttpException);

      try {
        await service.obtenerCajaAbierta();
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.CONFLICT);
        expect(e.getResponse().codigo).toBe('NO_HAY_CAJA_ABIERTA');
      }
    });

    it('falla con REPARTIDOR_NO_ENCONTRADO si el repartidor no existe', async () => {
      prismaMock.party.findUnique.mockResolvedValue(null);

      await expect(
        service.liquidarRepartidor(
          { repartidorPartyId: 9999, entregado: 50 },
          mockUsuarioCajero,
        ),
      ).rejects.toThrow(HttpException);

      try {
        await service.liquidarRepartidor(
          { repartidorPartyId: 9999, entregado: 50 },
          mockUsuarioCajero,
        );
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.NOT_FOUND);
        expect(e.getResponse().codigo).toBe('REPARTIDOR_NO_ENCONTRADO');
      }
    });
  });

  describe('reglas nuevas de cierre', () => {
    it('el historial de cierres es solo para el administrador (cajero recibe SOLO_ADMIN)', async () => {
      await expect(service.historial({ pagina: 1, limite: 10 }, mockUsuarioCajero)).rejects.toMatchObject({
        response: { codigo: 'SOLO_ADMIN' },
      });
    });

    it('no liquida a un repartidor sin efectivo pendiente (SIN_EFECTIVO_PENDIENTE)', async () => {
      jest.spyOn(service as any, 'repartidoresConEfectivo').mockResolvedValue([]);
      await expect(
        service.liquidarRepartidor({ repartidorPartyId: 55, entregado: 10 }, mockUsuarioCajero),
      ).rejects.toMatchObject({ response: { codigo: 'SIN_EFECTIVO_PENDIENTE' } });
    });

    it('pedidos sin cobrar: el cajero también los ve (ya no pide código de supervisor)', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([]);
      await expect(service.listarPendientesDeCobro()).resolves.toEqual([]);
    });

    it('pedidos sin cobrar: el admin los ve de cualquier día, sin anulados ni cobrados', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([
        { id: 74n, codigo: 'CP-W062', canal: 'CARTA', modalidad: 'RECOGER', estado: 'ENTREGADO', total: 42, creado_en: new Date('2026-10-23T20:21:00Z'), pago_estado: 'COORDINADO', cliente_nombre: '  Rosa Pérez ', cliente_telefono: '999888777' },
      ]);

      const lista = await service.listarPendientesDeCobro();

      expect(lista).toEqual([
        expect.objectContaining({ id: 74, codigo: 'CP-W062', total: 42, estado: 'ENTREGADO', pagoEstado: 'COORDINADO', clienteNombre: 'Rosa Pérez' }),
      ]);
      // Nunca teléfono ni DNI en la respuesta
      expect(lista[0]).not.toHaveProperty('cliente_telefono');
      expect(JSON.stringify(lista)).not.toContain('999888777');
      expect(prismaMock.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            pago_estado: { in: ['PENDIENTE', 'COORDINADO'] },
            estado: { not: 'ANULADO' },
          }),
        }),
      );
    });
  });
  // -------------------------------------------------------------------------
  // 13. Medios digitales calculados y correcciones con motivo
  // -------------------------------------------------------------------------
  describe('13. medios digitales calculados y correcciones', () => {
    const motivoValido = 'El voucher de Yape dice 210, no 200';
    const ajusteYape = {
      id: 1n,
      caja_id: 10n,
      medio: 'YAPE',
      monto_sistema: 200,
      monto_anterior: 200,
      monto_nuevo: 210,
      motivo: motivoValido,
      por_party_id: 101n,
      autorizado_por_party_id: 102n,
      creado_en: new Date('2026-10-21T16:00:00Z'),
    };

    it('el cajero recibe solo los 4 montos digitales con cuántos cobros los componen (sin efectivo, esperado ni diferencias)', async () => {
      const res = await service.obtenerDigitales();

      expect(Object.keys(res.medios).sort()).toEqual(['plin', 'tarjeta', 'transferencia', 'yape']);
      expect(res).not.toHaveProperty('efectivoEsperado');
      expect(JSON.stringify(res)).not.toMatch(/efectivo|esperado|diferencia/i);
      expect(res.medios.yape).toEqual({ monto: 200, sistema: 200, cobrado: 200, devuelto: 0, cobros: 1, corregido: false });
      expect(res.medios.transferencia).toEqual({ monto: 50, sistema: 50, cobrado: 50, devuelto: 0, cobros: 1, corregido: false });
      expect(res.medios.tarjeta).toEqual({ monto: 100, sistema: 100, cobrado: 100, devuelto: 0, cobros: 1, corregido: false });
      expect(res.medios.plin).toEqual({ monto: 0, sistema: 0, cobrado: 0, devuelto: 0, cobros: 0, corregido: false });
    });

    it('el monto digital que ve el cajero es el corregido, marcado como corregido', async () => {
      prismaMock.cierreAjusteMedio.findMany.mockResolvedValue([ajusteYape]);
      const res = await service.obtenerDigitales();
      expect(res.medios.yape).toMatchObject({ monto: 210, sistema: 200, corregido: true });
    });

    it('el cajero corrige un monto con motivo, sin código: queda con quién lo hizo y auditado', async () => {
      const res = await service.registrarAjusteMedio(
        { medio: 'YAPE', montoNuevo: 210, motivo: motivoValido },
        mockUsuarioCajero,
        '10.0.0.5',
      );

      expect(prismaMock.cierreAjusteMedio.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          caja_id: 10n,
          medio: 'YAPE',
          monto_sistema: 200,
          monto_anterior: 200,
          monto_nuevo: 210,
          motivo: motivoValido,
          por_party_id: 101n,
          autorizado_por_party_id: 101n,
        }),
      });
      expect(res).toMatchObject({ medio: 'YAPE', montoNuevo: 210, montoAnterior: 200 });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ modulo: 'cierre', accion: 'AJUSTE_MEDIO_DIGITAL', partyId: 101n }),
      );
    });

    it('rechaza un motivo corto (menos de 10 caracteres sin contar espacios)', async () => {
      await expect(
        service.registrarAjusteMedio({ medio: 'YAPE', montoNuevo: 210, motivo: '  corto  ' }, mockUsuarioSupervisor, undefined),
      ).rejects.toMatchObject({ response: { codigo: 'MOTIVO_REQUERIDO' }, status: HttpStatus.BAD_REQUEST });
      expect(prismaMock.cierreAjusteMedio.create).not.toHaveBeenCalled();
    });

    it('rechaza un monto con más de dos decimales y un monto igual al que ya vale', async () => {
      await expect(
        service.registrarAjusteMedio({ medio: 'YAPE', montoNuevo: 210.555, motivo: motivoValido }, mockUsuarioSupervisor, undefined),
      ).rejects.toMatchObject({ response: { codigo: 'MONTO_INVALIDO' } });
      await expect(
        service.registrarAjusteMedio({ medio: 'YAPE', montoNuevo: 200, motivo: motivoValido }, mockUsuarioSupervisor, undefined),
      ).rejects.toMatchObject({ response: { codigo: 'AJUSTE_SIN_CAMBIO' } });
      expect(prismaMock.cierreAjusteMedio.create).not.toHaveBeenCalled();
    });

    it('cierre con un medio distinto del sistema y sin ajuste YA NO se rechaza: queda como diferencia (AJUSTE_REQUERIDO retirado)', async () => {
      const dto: CerrarCajaDto = {
        conteo: { '200': 1, '100': 1, '50': 1, '5': 1 },
        medios: { yape: 210, plin: 0, transferencia: 50, tarjeta: 100 },
        nota: 'Yape distinto',
      };
      const res = await service.cerrar(dto, mockUsuarioAdmin, undefined);
      expect(res.resultado).toBe('NO_CUADRA');
      const medioYape = prismaMock.cierreMedio.create.mock.calls.map((c: any) => c[0].data).find((d: any) => d.medio === 'YAPE');
      expect(medioYape).toMatchObject({ sistema: 200, visto: 210 });
    });

    it('cierre con el monto corregido sí pasa: el medio queda visto con el valor ajustado y el resultado sigue NO_CUADRA', async () => {
      prismaMock.cierreAjusteMedio.findMany.mockResolvedValue([ajusteYape]);
      // Con diferencia el cierre exige nota (sin código de supervisor)
      const dto: CerrarCajaDto = {
        conteo: { '200': 1, '100': 1, '50': 1, '5': 1 },
        medios: { yape: 210, plin: 0, transferencia: 50, tarjeta: 100 },
        nota: 'Corrección aprobada',
      };
      const res = await service.cerrar(dto, mockUsuarioAdmin, undefined);
      const medioYape = prismaMock.cierreMedio.create.mock.calls.map((c: any) => c[0].data).find((d: any) => d.medio === 'YAPE');
      expect(medioYape).toMatchObject({ sistema: 200, visto: 210 });
      expect(res.resultado).toBe('NO_CUADRA');
    });

    it('el detalle del cierre devuelve las correcciones de esa caja con nombres', async () => {
      prismaMock.cierreCaja.findUnique.mockResolvedValue({
        caja_id: 10n,
        resultado: 'NO_CUADRA',
        aprobado_por: 99n,
        nota: 'Corrección',
        conteo: {},
        caja: { ...mockCajaAbierta, estado: 'CERRADA', cerrada_por: 1n, cerrada_en: new Date() },
        medios: [],
      });
      prismaMock.cierreAjusteMedio.findMany.mockResolvedValue([ajusteYape]);
      prismaMock.party.findMany.mockResolvedValue([
        { id: 101n, persona: { nombres: 'Ana', apellidos: 'Cajera' } },
        { id: 102n, persona: { nombres: 'Rosa', apellidos: 'Supervisora' } },
      ]);

      const detalle = await service.obtenerCierrePorId(10n, mockUsuarioAdmin);

      expect(detalle.ajustesMedio).toEqual([
        expect.objectContaining({
          medio: 'YAPE',
          montoSistema: 200,
          montoAnterior: 200,
          montoNuevo: 210,
          motivo: motivoValido,
          porNombre: 'Ana Cajera',
          autorizadoPorNombre: 'Rosa Supervisora',
        }),
      ]);
    });

    it('el historial de correcciones es append-only: la migración bloquea UPDATE y DELETE y el servicio nunca los usa', () => {
      const sql = fs.readFileSync(
        path.join(__dirname, '../../../prisma/migrations/20261211100000_cierre_ajuste_medio/migration.sql'),
        'utf8',
      );
      expect(sql).toMatch(/BEFORE UPDATE OR DELETE ON "cierre_ajuste_medio"/);
      const fuente = fs.readFileSync(path.join(__dirname, 'cierre.service.ts'), 'utf8');
      expect(fuente).not.toMatch(/cierreAjusteMedio\.(update|delete|upsert|updateMany|deleteMany)/);
    });
  });
  // -------------------------------------------------------------------------
  // 14. Devoluciones digitales descuentan del esperado digital del día
  // -------------------------------------------------------------------------
  describe('14. devoluciones digitales descuentan del esperado digital', () => {
    // Caja del 21/10 (día de Lima): [2026-10-21T05:00Z, 2026-10-22T05:00Z)
    const devolucion = (medio: string, monto: number, creado: string) => ({
      medio,
      monto_devuelto: monto,
      creado_en: new Date(creado),
    });

    it('sin devoluciones el esperado digital es lo cobrado y la devolución es 0', async () => {
      const res = await service.obtenerDigitales();
      expect(res.medios.yape).toMatchObject({ cobrado: 200, devuelto: 0, sistema: 200 });
    });

    it('una devolución por Yape del día resta de Yape: cobrado, devuelto (negativo) y esperado', async () => {
      prismaMock.devolucionPedido.findMany.mockResolvedValue([
        devolucion('YAPE', 50, '2026-10-21T17:00:00Z'),
      ]);
      const res = await service.obtenerDigitales();
      expect(res.medios.yape).toMatchObject({ cobrado: 200, devuelto: -50, sistema: 150, monto: 150 });
      // El resto de medios no cambia
      expect(res.medios.transferencia).toMatchObject({ cobrado: 50, devuelto: 0, sistema: 50 });
    });

    it('varios medios: cada uno descuenta solo sus devoluciones (Yape, Plin, transferencia, tarjeta)', async () => {
      prismaMock.devolucionPedido.findMany.mockResolvedValue([
        devolucion('YAPE', 50, '2026-10-21T17:00:00Z'),
        devolucion('TARJETA', 30, '2026-10-21T18:00:00Z'),
        devolucion('TARJETA', 20.5, '2026-10-21T19:00:00Z'),
        devolucion('TRANSFERENCIA', 10, '2026-10-21T20:00:00Z'),
      ]);
      const res = await service.obtenerDigitales();
      expect(res.medios.yape).toMatchObject({ cobrado: 200, devuelto: -50, sistema: 150 });
      expect(res.medios.tarjeta).toMatchObject({ cobrado: 100, devuelto: -50.5, sistema: 49.5 });
      expect(res.medios.transferencia).toMatchObject({ cobrado: 50, devuelto: -10, sistema: 40 });
      expect(res.medios.plin).toMatchObject({ cobrado: 0, devuelto: 0, sistema: 0 });
    });

    it('las devoluciones de otro día no cuentan (ni las de antes ni las de después de la caja)', async () => {
      prismaMock.devolucionPedido.findMany.mockResolvedValue([
        devolucion('YAPE', 50, '2026-10-20T20:00:00Z'), // ayer, en Lima 15:00
        devolucion('YAPE', 40, '2026-10-22T05:00:00Z'), // mañana 00:00 Lima: ya es otro día
        devolucion('YAPE', 10, '2026-10-21T04:59:59Z'), // ayer 23:59:59 Lima
      ]);
      const res = await service.obtenerDigitales();
      expect(res.medios.yape).toMatchObject({ cobrado: 200, devuelto: 0, sistema: 200 });
    });

    it('la devolución en efectivo no toca el esperado digital (ya sale como egreso de caja)', async () => {
      prismaMock.devolucionPedido.findMany.mockResolvedValue([
        devolucion('EFECTIVO', 40, '2026-10-21T17:00:00Z'),
      ]);
      const res = await service.obtenerDigitales();
      expect(res.medios.yape).toMatchObject({ sistema: 200, devuelto: 0 });
    });

    it('un saldo de cambio de ubicación cobrado por Yape suma y una devolución de cambio resta; lo pendiente no cuenta', async () => {
      prismaMock.pedidoCambioUbicacion.findMany.mockResolvedValue([
        { ajuste_tipo: 'SALDO', ajuste_estado: 'COBRADO', ajuste_medio: 'YAPE', ajuste_monto: 6, ajuste_en: new Date('2026-10-21T17:00:00Z') },
        { ajuste_tipo: 'DEVOLUCION', ajuste_estado: 'DEVUELTO', ajuste_medio: 'YAPE', ajuste_monto: 4, ajuste_en: new Date('2026-10-21T18:00:00Z') },
        { ajuste_tipo: 'DEVOLUCION', ajuste_estado: 'PENDIENTE', ajuste_medio: 'YAPE', ajuste_monto: 9, ajuste_en: null },
      ]);
      const res = await service.obtenerDigitales();
      expect(res.medios.yape).toMatchObject({ cobrado: 206, devuelto: -4, sistema: 202 });
    });

    it('el ADMIN ve el esperado de Yape ya descontada la devolución', async () => {
      prismaMock.devolucionPedido.findMany.mockResolvedValue([
        devolucion('YAPE', 50, '2026-10-21T17:00:00Z'),
      ]);
      const res = await service.obtenerEsperado(mockUsuarioAdmin);
      expect(res.medios.yape).toBe(150);
    });

    it('el arqueo cuadra si el voucher de Yape ya viene con la devolución descontada', async () => {
      prismaMock.devolucionPedido.findMany.mockResolvedValue([
        devolucion('YAPE', 50, '2026-10-21T17:00:00Z'),
      ]);
      const dto: ArqueoDto = {
        conteo: { '200': 1, '100': 1, '50': 1, '5': 1 },
        medios: { yape: 150.0, plin: 0.0, transferencia: 50.0, tarjeta: 100.0 },
      };
      const resultado = await service.arqueo(dto, mockUsuarioCajero);
      expect(resultado).toEqual({ resultado: 'CUADRA', intento: 1 });
    });

    it('el cierre con Yape sin descontar la devolución cierra y deja la diferencia (+50): el sistema ya la descuenta', async () => {
      prismaMock.devolucionPedido.findMany.mockResolvedValue([
        devolucion('YAPE', 50, '2026-10-21T17:00:00Z'),
      ]);
      const res = await service.cerrar(
        { conteo: { '200': 1, '100': 1, '50': 1, '5': 1 }, medios: { yape: 200, plin: 0, transferencia: 50, tarjeta: 100 } } as CerrarCajaDto,
        mockUsuarioCajero,
      );
      expect(res.resultado).toBe('NO_CUADRA');
      expect(res.medios!.find((m: any) => m.medio === 'YAPE')).toMatchObject({ sistema: 150, visto: 200, diferencia: 50 });
    });
  });
});
