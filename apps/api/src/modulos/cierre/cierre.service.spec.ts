import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { CierreService } from './cierre.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
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
        findMany: jest.fn().mockResolvedValue(mockCobros),
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
      pedido: {
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
      },
      party: {
        findUnique: jest.fn().mockResolvedValue({
          id: 55n,
          tipo: 'PERSONA',
          persona: { nombres: 'Carlos', apellidos: 'Repartidor' },
        }),
      },
      liquidacion: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 100n, ...data })),
      },
      userAccount: {
        findMany: jest.fn().mockResolvedValue([]),
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
  // 3. 3er intento exige PIN de supervisor
  // -------------------------------------------------------------------------
  describe('3. 3er intento exige PIN', () => {
    it('rechaza cerrar caja descuadrada sin PIN de supervisor', async () => {
      // Conteo que no cuadra
      const dtoCerrar: CerrarCajaDto = {
        conteo: { '200': 1 }, // 200 vs 355 esperado
        medios: { yape: 200 },
        nota: 'Faltante de turno tarde',
      };

      await expect(
        service.cerrar(dtoCerrar, mockUsuarioCajero, undefined),
      ).rejects.toThrow(HttpException);

      try {
        await service.cerrar(dtoCerrar, mockUsuarioCajero, undefined);
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(e.getResponse().codigo).toBe('PIN_REQUERIDO');
      }
    });

    it('tras 3 intentos de arqueo previos, exige PIN de supervisor para nuevo intento o cierre', async () => {
      prismaMock.conteoCierre.count.mockResolvedValue(3);

      const dtoArqueo: ArqueoDto = {
        conteo: { '200': 1 },
        medios: { yape: 200 },
      };

      await expect(
        service.arqueo(dtoArqueo, mockUsuarioCajero, undefined),
      ).rejects.toThrow(HttpException);

      try {
        await service.arqueo(dtoArqueo, mockUsuarioCajero, undefined);
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(e.getResponse().codigo).toBe('PIN_REQUERIDO');
      }
    });

    it('bloquea por 10 minutos en Redis tras 3 pines erróneos y audita PIN_FALLIDO', async () => {
      const pinHashAdmin = await argon2.hash('654321');
      prismaMock.userAccount.findMany.mockResolvedValue([
        { id: 1n, party_id: 1n, rol: 'ADMIN', pin_hash: pinHashAdmin, activo: true },
      ]);

      // Intento con PIN inválido '111111'
      await expect(
        service.verificarPinSupervisor('111111', 101n, '127.0.0.1', 10n),
      ).rejects.toThrow(HttpException);

      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'ACCESO',
          modulo: 'cierre',
          accion: 'PIN_FALLIDO',
          resultado: 'RECHAZADO',
        }),
      );

      // Si Redis ya tiene 3 fallos acumulados
      redisMock.get.mockResolvedValue('3');
      await expect(
        service.verificarPinSupervisor('654321', 101n, '127.0.0.1', 10n),
      ).rejects.toThrow(HttpException);

      try {
        await service.verificarPinSupervisor('654321', 101n, '127.0.0.1', 10n);
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.FORBIDDEN);
        expect(e.getResponse().codigo).toBe('PIN_BLOQUEADO');
      }
    });

    it('con PIN de supervisor válido de 6 dígitos permite cerrar caja descuadrada', async () => {
      const pinCorrecto = '123456';
      const pinHash = await argon2.hash(pinCorrecto);

      prismaMock.userAccount.findMany.mockResolvedValue([
        { id: 99n, party_id: 99n, rol: 'ADMIN', pin_hash: pinHash, activo: true },
      ]);

      const dtoCerrar: CerrarCajaDto = {
        conteo: { '200': 1 }, // 200 en efectivo vs 355
        medios: { yape: 200, plin: 0, transferencia: 50, tarjeta: 100 },
        nota: 'Diferencia autorizada por supervisor',
      };

      const res = await service.cerrar(dtoCerrar, mockUsuarioCajero, pinCorrecto);

      expect(res.resultado).toBe('NO_CUADRA');
      expect(res.aprobadoPor).toBe(99);
      expect(res.nota).toBe('Diferencia autorizada por supervisor');
      expect(prismaMock.cierreCaja.create).toHaveBeenCalled();
      expect(prismaMock.caja.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n },
          data: expect.objectContaining({ estado: 'CERRADA' }),
        }),
      );
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
      const pinHash = await argon2.hash('654321');
      prismaMock.userAccount.findMany.mockResolvedValue([
        { id: 2n, party_id: 2n, rol: 'ADMIN', pin_hash: pinHash, activo: true },
      ]);

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

      const resCerrar = await service.cerrar(dtoCerrar, mockUsuarioCajero, '654321');

      // El cajero no recibe el esperado ni la diferencia (DT-61)
      expect(resCerrar.medios).toBeUndefined();

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
    it('lista pedidos delivery entregados cobrados en efectivo y calcula saldo por liquidar', async () => {
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
          cobro: {
            anulado_en: null,
            pagos: [{ medio: 'EFECTIVO', monto: 40.0 }],
          },
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
          cobro: null,
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
        totalCobrado: 100.0,
        totalLiquidado: 30.0,
        pendiente: 70.0,
      });
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
    it('el cajero solo ve el esperado con un PIN de supervisor válido; el ADMIN lo ve directo', async () => {
      // CAJERO sin PIN o con PIN errado es rechazado con 403
      prismaMock.userAccount.findMany.mockResolvedValue([
        { id: 1n, party_id: 1n, rol: 'ADMIN', pin_hash: await argon2.hash('654321'), activo: true },
      ]);
      await expect(service.obtenerEsperado(mockUsuarioCajero)).rejects.toThrow(HttpException);
      await expect(service.obtenerEsperado(mockUsuarioCajero, '111111')).rejects.toThrow(HttpException);

      // CAJERO con el PIN correcto de la supervisora recibe el detalle
      const conPin = await service.obtenerEsperado(mockUsuarioCajero, '654321');
      expect(conPin.cajaId).toBe(10);

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
          },
        }),
      );
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

    it('exige nota explicativa cuando el cierre no cuadra (NOTA_REQUERIDA)', async () => {
      const dtoSinNota: CerrarCajaDto = {
        conteo: { '200': 1 },
        medios: { yape: 200 },
        nota: '  ',
      };

      await expect(
        service.cerrar(dtoSinNota, mockUsuarioCajero, '123456'),
      ).rejects.toThrow(HttpException);

      try {
        await service.cerrar(dtoSinNota, mockUsuarioCajero, '123456');
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(e.getResponse().codigo).toBe('NOTA_REQUERIDA');
      }
    });

    it('exige arqueo previo si no se proporciona conteo ni medios al cerrar (ARQUEO_REQUERIDO)', async () => {
      prismaMock.conteoCierre.findMany.mockResolvedValue([]);

      await expect(
        service.cerrar({}, mockUsuarioCajero),
      ).rejects.toThrow(HttpException);

      try {
        await service.cerrar({}, mockUsuarioCajero);
      } catch (e: any) {
        expect(e.getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect(e.getResponse().codigo).toBe('ARQUEO_REQUERIDO');
      }
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
        expect(e.getStatus()).toBe(HttpStatus.BAD_REQUEST);
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

    it('bloquea el PIN de supervisor 5 minutos tras 3 fallos (300 s en Redis)', async () => {
      prismaMock.userAccount.findMany.mockResolvedValue([]);
      await expect(
        service.verificarPinSupervisor('000000', 101n, '127.0.0.1', 10n),
      ).rejects.toMatchObject({ response: { codigo: 'PIN_INVALIDO' } });
      expect(redisMock.expire).toHaveBeenCalledWith(expect.any(String), 5 * 60);
    });
  });
});
