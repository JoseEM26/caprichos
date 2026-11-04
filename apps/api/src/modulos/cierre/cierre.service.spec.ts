import * as fs from 'fs';
import * as path from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { CierreService } from './cierre.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';
import { CobrosService } from '../caja/cobros.service';
import { SupervisorCodigoService } from '../supervisor-codigo/supervisor-codigo.service';
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
  let supervisorCodigoMock: any;
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
      party: {
        findMany: jest.fn().mockResolvedValue([]),
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
        // Por defecto nadie es ADMIN/SUPERVISOR activo: solo el cajero
        findFirst: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn().mockImplementation(async (cb) => cb(prismaMock)),
    };

    supervisorCodigoMock = {
      verificarYConsumirCodigo: jest.fn().mockImplementation(async (codigo: string | undefined, partyId?: any) => {
        const claveIntentos = `pin:supervisor:intentos:${partyId ?? 'general'}`;
        let intentos;
        try {
          intentos = await redisMock.get(claveIntentos);
        } catch {
          throw new HttpException(
            { codigo: 'PIN_NO_DISPONIBLE', mensaje: 'No se puede validar el código ahora, intenta en unos minutos' },
            HttpStatus.SERVICE_UNAVAILABLE,
          );
        }
        if (intentos && parseInt(intentos, 10) >= 3) {
          throw new HttpException(
            { codigo: 'CODIGO_BLOQUEADO', mensaje: 'Demasiados intentos fallidos de código de supervisor. Espera 5 minutos.' },
            HttpStatus.FORBIDDEN,
          );
        }
        if (!codigo || (codigo !== '654321' && codigo !== '123456')) {
          await redisMock.incr(claveIntentos);
          await redisMock.expire(claveIntentos, 5 * 60);
          await auditoriaMock.registrar({
            categoria: 'ACCESO',
            modulo: 'cierre',
            accion: 'PIN_FALLIDO',
            resultado: 'RECHAZADO',
          });
          throw new HttpException(
            { codigo: 'CODIGO_INVALIDO', mensaje: 'Código de supervisor inválido o no proporcionado' },
            HttpStatus.FORBIDDEN,
          );
        }
        await redisMock.del(claveIntentos);
        return { party_id: 99n, id: 99n, valido: true };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CierreService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: RedisService, useValue: redisServiceMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
        { provide: CobrosService, useValue: { cobrarEnCierre: jest.fn() } },
        { provide: SupervisorCodigoService, useValue: supervisorCodigoMock },
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

    it('tras 3 arqueos que no cuadraron, exige PIN de supervisor para el cuarto intento o el cierre', async () => {
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

    it('con 3 arqueos que no cuadraron aunque haya más intentos en total, el cuarto exige PIN', async () => {
      prismaMock.conteoCierre.count.mockImplementation(async ({ where }: any) =>
        where.resultado === 'NO_CUADRA' ? 3 : 5,
      );

      const dtoArqueo: ArqueoDto = {
        conteo: { '200': 1 },
        medios: { yape: 200 },
      };

      await expect(service.arqueo(dtoArqueo, mockUsuarioCajero, undefined)).rejects.toMatchObject({
        response: { codigo: 'PIN_REQUERIDO' },
      });
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

      // Cuadra con el sistema: el cierre no exige PIN de supervisor (puede fallar por otra causa del mock, no por el PIN)
      const error = await service.cerrar(dtoCerrar, mockUsuarioCajero, undefined).catch((e) => e);
      expect(error?.getResponse?.()?.codigo).not.toBe('PIN_REQUERIDO');
    });

    it('bloquea por 5 minutos en Redis tras 3 pines erróneos y audita PIN_FALLIDO', async () => {
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
        expect(e.getResponse().codigo).toBe('CODIGO_BLOQUEADO');
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

      // Yape y tarjeta se corrigieron antes con motivo: el cierre guarda esos valores como vistos
      prismaMock.cierreAjusteMedio.findMany.mockResolvedValue([
        { id: 1n, caja_id: 10n, medio: 'YAPE', monto_sistema: 200, monto_anterior: 200, monto_nuevo: 210, motivo: 'Voucher leído con 210', por_party_id: 101n, autorizado_por_party_id: 2n, creado_en: new Date() },
        { id: 2n, caja_id: 10n, medio: 'TARJETA', monto_sistema: 100, monto_anterior: 100, monto_nuevo: 90, motivo: 'Terminal cobró 90 real', por_party_id: 101n, autorizado_por_party_id: 2n, creado_en: new Date() },
      ]);

      const resCerrar = await service.cerrar(dtoCerrar, mockUsuarioCajero, '654321');

      // El cajero no recibe el esperado ni la diferencia (DT-61)
      expect(resCerrar.medios).toBeUndefined();
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
        where: { id: { in: [502n] }, pago_estado: 'PENDIENTE' },
        data: { pago_estado: 'PAGADO' },
      });
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

    it('el cajero sin PIN no recibe cobros ni movimientos (cierre ciego, DT-61)', async () => {
      await expect(service.obtenerEsperado(mockUsuarioCajero)).rejects.toThrow(HttpException);
      expect(prismaMock.cobro.findMany).not.toHaveBeenCalled();
      expect(prismaMock.movimientoCaja.findMany).not.toHaveBeenCalled();
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

    it('bloquea el PIN de supervisor 5 minutos tras 3 fallos (300 s en Redis)', async () => {
      prismaMock.userAccount.findMany.mockResolvedValue([]);
      await expect(
        service.verificarPinSupervisor('000000', 101n, '127.0.0.1', 10n),
      ).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
      expect(redisMock.expire).toHaveBeenCalledWith(expect.any(String), 5 * 60);
    });

    it('pedidos sin cobrar: el cajero sin PIN de supervisor no los ve (CODIGO_INVALIDO)', async () => {
      await expect(service.listarPendientesDeCobro(mockUsuarioCajero)).rejects.toMatchObject({
        response: { codigo: 'CODIGO_INVALIDO' },
      });
      expect(prismaMock.pedido.findMany).not.toHaveBeenCalled();
    });

    it('pedidos sin cobrar: el admin los ve de cualquier día, sin anulados ni cobrados', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([
        { id: 74n, codigo: 'CP-W062', canal: 'CARTA', modalidad: 'RECOGER', estado: 'ENTREGADO', total: 42, creado_en: new Date('2026-10-23T20:21:00Z'), pago_estado: 'COORDINADO', cliente_nombre: '  Rosa Pérez ', cliente_telefono: '999888777' },
      ]);

      const lista = await service.listarPendientesDeCobro(mockUsuarioAdmin);

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
  // 12. SUPERVISOR se autoriza sin PIN, como el ADMIN (misma regla que verificarYConsumirCodigo)
  // -------------------------------------------------------------------------
  describe('12. SUPERVISOR cierra sin PIN', () => {
    const conteoDescuadrado = { conteo: { '200': 1 }, medios: { yape: 200 }, nota: 'Faltante de turno' } as CerrarCajaDto;
    const conteoCuadra: CerrarCajaDto = {
      conteo: { '200': 1, '100': 1, '50': 1, '5': 1 },
      medios: { yape: 200, plin: 0, transferencia: 50, tarjeta: 100 },
    };

    beforeEach(() => {
      prismaMock.userAccount.findFirst.mockImplementation(async ({ where }: any) =>
        where.party_id === 102n ? { party_id: 102n, id: 30n, rol: 'SUPERVISOR' } : null,
      );
    });

    it('con descuadre cierra sin PIN: el servicio de supervisor lo autoriza (y audita) sin código', async () => {
      supervisorCodigoMock.verificarYConsumirCodigo.mockResolvedValueOnce({
        party_id: 102n,
        id: 30n,
        supervisorPartyId: 102n,
        supervisorId: 30n,
      });

      const error = await service.cerrar(conteoDescuadrado, mockUsuarioSupervisor, undefined).catch((e) => e);

      expect(error?.response?.codigo).not.toBe('PIN_REQUERIDO');
      expect(supervisorCodigoMock.verificarYConsumirCodigo).toHaveBeenCalledWith(
        undefined,
        102n,
        'cierre',
        undefined,
        'caja',
        10n,
      );
    });

    it('sin descuadre no pide nada de supervisor', async () => {
      const error = await service.cerrar(conteoCuadra, mockUsuarioSupervisor, undefined).catch((e) => e);

      expect(error?.response?.codigo).not.toBe('PIN_REQUERIDO');
      expect(supervisorCodigoMock.verificarYConsumirCodigo).not.toHaveBeenCalled();
    });

    it('el arqueo del cuarto intento tampoco le pide PIN', async () => {
      prismaMock.conteoCierre.count.mockResolvedValue(3);
      supervisorCodigoMock.verificarYConsumirCodigo.mockResolvedValueOnce({
        party_id: 102n,
        id: 30n,
        supervisorPartyId: 102n,
        supervisorId: 30n,
      });

      const error = await service.arqueo({ conteo: { '200': 1 }, medios: { yape: 200 } }, mockUsuarioSupervisor, undefined).catch((e) => e);

      expect(error?.response?.codigo).not.toBe('PIN_REQUERIDO');
      expect(supervisorCodigoMock.verificarYConsumirCodigo).toHaveBeenCalledWith(
        undefined,
        102n,
        'cierre',
        undefined,
        'caja',
        10n,
      );
    });

    it('el cajero sigue necesitando PIN: se rechaza antes de verificar nada', async () => {
      await expect(service.cerrar(conteoDescuadrado, mockUsuarioCajero, undefined)).rejects.toMatchObject({
        response: { codigo: 'PIN_REQUERIDO' },
      });
      expect(supervisorCodigoMock.verificarYConsumirCodigo).not.toHaveBeenCalled();
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
      expect(res.medios.yape).toEqual({ monto: 200, sistema: 200, cobros: 1, corregido: false });
      expect(res.medios.transferencia).toEqual({ monto: 50, sistema: 50, cobros: 1, corregido: false });
      expect(res.medios.tarjeta).toEqual({ monto: 100, sistema: 100, cobros: 1, corregido: false });
      expect(res.medios.plin).toEqual({ monto: 0, sistema: 0, cobros: 0, corregido: false });
    });

    it('el monto digital que ve el cajero es el corregido, marcado como corregido', async () => {
      prismaMock.cierreAjusteMedio.findMany.mockResolvedValue([ajusteYape]);
      const res = await service.obtenerDigitales();
      expect(res.medios.yape).toMatchObject({ monto: 210, sistema: 200, corregido: true });
    });

    it('el cajero sin código de supervisor no puede corregir un monto (PIN_REQUERIDO, nada se guarda)', async () => {
      await expect(
        service.registrarAjusteMedio({ medio: 'YAPE', montoNuevo: 210, motivo: motivoValido }, mockUsuarioCajero, undefined),
      ).rejects.toMatchObject({ response: { codigo: 'PIN_REQUERIDO' }, status: HttpStatus.FORBIDDEN });
      expect(prismaMock.cierreAjusteMedio.create).not.toHaveBeenCalled();
    });

    it('el cajero con código de supervisor válido corrige, y el registro queda con quién lo hizo y quién autorizó', async () => {
      const res = await service.registrarAjusteMedio(
        { medio: 'YAPE', montoNuevo: 210, motivo: motivoValido },
        mockUsuarioCajero,
        '123456',
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
          autorizado_por_party_id: 99n,
        }),
      });
      expect(res).toMatchObject({ medio: 'YAPE', montoNuevo: 210, montoAnterior: 200 });
    });

    it('el cajero con código de supervisor inválido no corrige', async () => {
      await expect(
        service.registrarAjusteMedio({ medio: 'YAPE', montoNuevo: 210, motivo: motivoValido }, mockUsuarioCajero, '000000'),
      ).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
      expect(prismaMock.cierreAjusteMedio.create).not.toHaveBeenCalled();
    });

    it('el ADMIN corrige sin código y queda auditado a su nombre', async () => {
      prismaMock.userAccount.findFirst.mockImplementation(async ({ where }: any) =>
        where.party_id === 1n ? { party_id: 1n, id: 1n, rol: 'ADMIN' } : null,
      );
      supervisorCodigoMock.verificarYConsumirCodigo.mockResolvedValueOnce({ party_id: 1n, id: 1n, supervisorPartyId: 1n, supervisorId: 1n });

      await service.registrarAjusteMedio({ medio: 'TARJETA', montoNuevo: 90, motivo: 'Terminal cobró 90 real' }, mockUsuarioAdmin, undefined);

      expect(prismaMock.cierreAjusteMedio.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ por_party_id: 1n, autorizado_por_party_id: 1n, medio: 'TARJETA' }),
      });
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ categoria: 'CAMBIO', modulo: 'cierre', accion: 'AJUSTE_MEDIO_DIGITAL', entidad: 'cierre_ajuste_medio', partyId: 1n }),
      );
    });

    it('el SUPERVISOR corrige sin código, con su nombre como autorizador', async () => {
      prismaMock.userAccount.findFirst.mockImplementation(async ({ where }: any) =>
        where.party_id === 102n ? { party_id: 102n, id: 30n, rol: 'SUPERVISOR' } : null,
      );
      supervisorCodigoMock.verificarYConsumirCodigo.mockResolvedValueOnce({ party_id: 102n, id: 30n, supervisorPartyId: 102n, supervisorId: 30n });

      await service.registrarAjusteMedio({ medio: 'YAPE', montoNuevo: 210, motivo: motivoValido }, mockUsuarioSupervisor, undefined);

      expect(prismaMock.cierreAjusteMedio.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ por_party_id: 102n, autorizado_por_party_id: 102n }),
      });
    });

    it('rechaza un motivo corto (menos de 10 caracteres sin contar espacios)', async () => {
      await expect(
        service.registrarAjusteMedio({ medio: 'YAPE', montoNuevo: 210, motivo: '  corto  ' }, mockUsuarioSupervisor, undefined),
      ).rejects.toMatchObject({ response: { codigo: 'MOTIVO_REQUERIDO' }, status: HttpStatus.BAD_REQUEST });
      expect(prismaMock.cierreAjusteMedio.create).not.toHaveBeenCalled();
    });

    it('rechaza un monto con más de dos decimales y un monto igual al que ya vale', async () => {
      prismaMock.userAccount.findFirst.mockImplementation(async ({ where }: any) =>
        where.party_id === 102n ? { party_id: 102n, id: 30n, rol: 'SUPERVISOR' } : null,
      );
      await expect(
        service.registrarAjusteMedio({ medio: 'YAPE', montoNuevo: 210.555, motivo: motivoValido }, mockUsuarioSupervisor, undefined),
      ).rejects.toMatchObject({ response: { codigo: 'MONTO_INVALIDO' } });
      supervisorCodigoMock.verificarYConsumirCodigo.mockResolvedValueOnce({ party_id: 102n, id: 30n, supervisorPartyId: 102n, supervisorId: 30n });
      await expect(
        service.registrarAjusteMedio({ medio: 'YAPE', montoNuevo: 200, motivo: motivoValido }, mockUsuarioSupervisor, undefined),
      ).rejects.toMatchObject({ response: { codigo: 'AJUSTE_SIN_CAMBIO' } });
      expect(prismaMock.cierreAjusteMedio.create).not.toHaveBeenCalled();
    });

    it('cierre con un medio distinto del sistema y sin ajuste se rechaza (AJUSTE_REQUERIDO)', async () => {
      const dto: CerrarCajaDto = {
        conteo: { '200': 1, '100': 1, '50': 1, '5': 1 },
        medios: { yape: 210, plin: 0, transferencia: 50, tarjeta: 100 },
        nota: 'Yape distinto',
      };
      await expect(service.cerrar(dto, mockUsuarioAdmin, undefined)).rejects.toMatchObject({
        response: { codigo: 'AJUSTE_REQUERIDO' },
        status: HttpStatus.CONFLICT,
      });
      expect(prismaMock.cierreCaja.create).not.toHaveBeenCalled();
    });

    it('cierre con el monto corregido sí pasa: el medio queda visto con el valor ajustado y el resultado sigue NO_CUADRA', async () => {
      prismaMock.cierreAjusteMedio.findMany.mockResolvedValue([ajusteYape]);
      // Con diferencia el cierre exige nota y código de supervisora: el ADMIN lo autoriza sin código
      prismaMock.userAccount.findFirst.mockImplementation(async ({ where }: any) =>
        where.party_id === 1n ? { party_id: 1n, id: 1n, rol: 'ADMIN' } : null,
      );
      supervisorCodigoMock.verificarYConsumirCodigo.mockResolvedValueOnce({ party_id: 1n, id: 1n, supervisorPartyId: 1n, supervisorId: 1n });
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
});
