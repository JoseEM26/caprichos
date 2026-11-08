import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CajaService } from './caja.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('CajaService', () => {
  let service: CajaService;
  let prismaMock: any;
  let auditoriaMock: any;

  const cajeroUsuario = {
    id: 2n,
    partyId: 2n,
    rol: 'CAJERO',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prismaMock = {
      caja: {
        findUnique: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      movimientoCaja: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      cobro: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findMany: jest.fn().mockResolvedValue([]) },
      liquidacion: { findMany: jest.fn().mockResolvedValue([]) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      // monto inicial oficial S/ 150; por defecto nadie es ADMIN/SUPERVISOR
      parametro: { findUnique: jest.fn().mockResolvedValue({ clave: 'caja_monto_inicial', valor: 150 }) },
      userAccount: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn().mockResolvedValue(null) },
      person: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    prismaMock.$transaction = jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CajaService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
      ],
    }).compile();

    service = module.get<CajaService>(CajaService);
  });

  describe('abrirCaja', () => {
    it('no abre la de hoy si una caja de un día anterior sigue abierta', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(null);
      prismaMock.caja.findFirst.mockResolvedValue({ id: 3n, fecha: new Date('2026-10-21T00:00:00.000Z'), estado: 'ABIERTA' });

      await expect(service.abrirCaja({ apertura: 10 }, cajeroUsuario)).rejects.toMatchObject({
        response: { codigo: 'CAJA_ANTERIOR_SIN_CERRAR' },
      });
      expect(prismaMock.caja.create).not.toHaveBeenCalled();
    });

    it('debe abrir la caja con monto en soles y auditar', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(null);
      prismaMock.caja.create.mockResolvedValue({
        id: 10n,
        fecha: new Date('2026-10-21T00:00:00.000Z'),
        apertura: new Prisma.Decimal(150),
        estado: 'ABIERTA',
        abierta_por: 2n,
        cerrada_por: null,
        cerrada_en: null,
      });

      const res = await service.abrirCaja({ apertura: 150 }, cajeroUsuario);

      expect(res.id).toBe('10');
      expect(res.apertura).toBe(150);
      expect(res.estado).toBe('ABIERTA');
      expect(prismaMock.caja.create).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'caja',
          accion: 'ABRIR_CAJA',
          resultado: 'OK',
          entidad: 'caja',
        }),
      );
    });

    describe('monto inicial oficial', () => {
      const cajaCreada = (monto: number) => ({
        id: 11n, fecha: new Date('2026-10-21T00:00:00.000Z'), apertura: new Prisma.Decimal(monto),
        estado: 'ABIERTA', abierta_por: 2n, cerrada_por: null, cerrada_en: null,
      });
      beforeEach(() => {
        prismaMock.caja.findUnique.mockResolvedValue(null);
      });

      it('abre con el monto oficial y no lo marca como distinto', async () => {
        prismaMock.caja.create.mockResolvedValue(cajaCreada(150));
        await service.abrirCaja({ apertura: 150 }, cajeroUsuario);
        expect(auditoriaMock.registrar).toHaveBeenCalledWith(
          expect.objectContaining({ despues: expect.objectContaining({ distintoDelOficial: false }) }),
        );
      });

      it('sin monto, abre con el oficial', async () => {
        prismaMock.caja.create.mockResolvedValue(cajaCreada(150));
        await service.abrirCaja({}, cajeroUsuario);
        expect(prismaMock.caja.create.mock.calls[0][0].data.apertura.toString()).toBe('150');
      });

      it('con monto distinto del oficial abre sin pedir código y lo deja auditado', async () => {
        prismaMock.caja.create.mockResolvedValue(cajaCreada(200));
        await service.abrirCaja({ apertura: 200 }, cajeroUsuario, '1.1.1.1');
        expect(prismaMock.caja.create).toHaveBeenCalled();
        expect(auditoriaMock.registrar).toHaveBeenCalledWith(
          expect.objectContaining({
            accion: 'ABRIR_CAJA',
            partyId: 2n,
            despues: expect.objectContaining({ apertura: 200, montoOficial: 150, distintoDelOficial: true, abiertaPor: '2' }),
          }),
        );
      });

      it('precarga: la caja cerrada devuelve el monto oficial', async () => {
        const r = await service.obtenerCajaActual(cajeroUsuario);
        expect(r.montoInicialOficial).toBe(150);
      });
    });

    it('apertura duplicada -> 409 CAJA_YA_ABIERTA si ya existe caja hoy', async () => {
      prismaMock.caja.findUnique.mockResolvedValue({
        id: 10n,
        estado: 'ABIERTA',
      });

      await expect(
        service.abrirCaja({ apertura: 100 }, cajeroUsuario),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'CAJA_YA_ABIERTA',
          }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('apertura duplicada -> 409 CAJA_YA_ABIERTA si ya existe caja cerrada hoy', async () => {
      prismaMock.caja.findUnique.mockResolvedValue({
        id: 10n,
        estado: 'CERRADA',
      });

      await expect(
        service.abrirCaja({ apertura: 0 }, cajeroUsuario),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'CAJA_YA_ABIERTA',
          }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });
  });

  describe('obtenerCajaActual', () => {
    it('debe retornar caja en null y totales en 0 si no hay caja hoy', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(null);

      const res = await service.obtenerCajaActual({ rol: 'ADMIN' });

      expect(res.caja).toBeNull();
      expect(res.abierta).toBe(false);
      expect(res.efectivoEsperado).toBe(0);
    });

    it('sin caja de hoy avisa de la caja de otro día que sigue abierta, solo con la fecha (también al cajero)', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(null);
      prismaMock.caja.findFirst.mockResolvedValue({ fecha: new Date('2026-10-22T00:00:00.000Z') });

      const res = await service.obtenerCajaActual({ rol: 'CAJERO' });

      expect(res.caja).toBeNull();
      expect(res.cajaAnteriorAbierta).toEqual({ fecha: '2026-10-22' });
      expect(res).not.toHaveProperty('efectivoEsperado');
    });

    it('debe calcular totales por medio y efectivo esperado correctamente', async () => {
      prismaMock.caja.findUnique.mockResolvedValue({
        id: 1n,
        fecha: new Date('2026-10-21T00:00:00.000Z'),
        apertura: new Prisma.Decimal(50),
        estado: 'ABIERTA',
        abierta_por: 2n,
        cerrada_por: null,
        cerrada_en: null,
        cobros: [
          {
            id: 1n,
            pedido_id: 11n,
            total: new Prisma.Decimal(100),
            en: new Date('2026-10-24T15:00:00Z'),
            anulado_en: null,
            pedido: { codigo: 'CP-W001', cliente_nombre: 'Ana' },
            pagos: [
              {
                medio: 'EFECTIVO',
                monto: new Prisma.Decimal(100),
                recibido: new Prisma.Decimal(100),
                vuelto: new Prisma.Decimal(0),
              },
            ],
          },
          {
            id: 2n,
            pedido_id: 12n,
            total: new Prisma.Decimal(50),
            en: new Date('2026-10-24T16:00:00Z'),
            anulado_en: null,
            pedido: { codigo: 'CP-W002', cliente_nombre: null },
            pagos: [
              {
                medio: 'YAPE',
                monto: new Prisma.Decimal(50),
                recibido: null,
                vuelto: null,
              },
              {
                medio: 'EFECTIVO',
                monto: new Prisma.Decimal(30),
                recibido: new Prisma.Decimal(50),
                vuelto: new Prisma.Decimal(20),
              },
            ],
          },
          {
            id: 3n,
            anulado_en: new Date(), // Cobro anulado: no debe contar
            pagos: [
              {
                medio: 'EFECTIVO',
                monto: new Prisma.Decimal(80),
                recibido: null,
                vuelto: null,
              },
            ],
          },
        ],
        movimientos: [
          {
            id: 1n,
            tipo: 'INGRESO',
            monto: new Prisma.Decimal(20),
            anulado_en: null,
          },
          {
            id: 2n,
            tipo: 'EGRESO',
            monto: new Prisma.Decimal(15),
            anulado_en: null,
          },
          {
            id: 3n,
            tipo: 'EGRESO',
            monto: new Prisma.Decimal(50),
            anulado_en: new Date(), // Anulado: no debe contar
          },
        ],
      });

      // El cálculo de montos lee cobros y movimientos de sus tablas: se alimentan con los mismos datos
      prismaMock.cobro.findMany.mockResolvedValue([
        { id: 1n, pedido_id: 1n, anulado_en: null, pagos: [{ medio: 'EFECTIVO', monto: new Prisma.Decimal(100) }] },
        {
          id: 2n,
          pedido_id: 2n,
          anulado_en: null,
          pagos: [
            { medio: 'YAPE', monto: new Prisma.Decimal(50) },
            { medio: 'EFECTIVO', monto: new Prisma.Decimal(30) },
          ],
        },
      ]);
      prismaMock.movimientoCaja.findMany.mockResolvedValue([
        { id: 1n, tipo: 'INGRESO', monto: new Prisma.Decimal(20) },
        { id: 2n, tipo: 'EGRESO', monto: new Prisma.Decimal(15) },
      ]);

      const res = await service.obtenerCajaActual({ rol: 'ADMIN' });

      expect(res.abierta).toBe(true);
      expect(res.totalesPorMedio!.EFECTIVO).toBe(130); // 100 + 30
      expect(res.totalesPorMedio!.YAPE).toBe(50);
      expect(res.resumen!.apertura).toBe(50);
      expect(res.resumen!.cobrosEfectivo).toBe(130);
      expect(res.resumen!.vueltosEfectivo).toBe(20);
      expect(res.resumen!.ingresos).toBe(20);
      expect(res.resumen!.egresos).toBe(15);
      // Efectivo esperado = 50 + 130 + 20 - 15 = 185
      expect(res.efectivoEsperado).toBe(185);
      // Pedidos cobrados en esta caja (solo del turno, con sus medios)
      expect(res.cobrados).toEqual([
        { pedidoId: '11', codigo: 'CP-W001', cliente: 'Ana', total: 100, medios: ['EFECTIVO'], en: new Date('2026-10-24T15:00:00Z') },
        { pedidoId: '12', codigo: 'CP-W002', cliente: null, total: 50, medios: ['YAPE', 'EFECTIVO'], en: new Date('2026-10-24T16:00:00Z') },
      ]);
    });

    it('al cajero solo le muestra si la caja está abierta, sin totales ni efectivo esperado (DT-61)', async () => {
      prismaMock.caja.findUnique.mockResolvedValue({
        id: 1n,
        fecha: new Date('2026-10-21T00:00:00.000Z'),
        apertura: new Prisma.Decimal(50),
        estado: 'ABIERTA',
        abierta_por: 2n,
        cerrada_por: null,
        cerrada_en: null,
        cobros: [],
        movimientos: [],
      });

      const res = await service.obtenerCajaActual({ rol: 'CAJERO' });

      expect(res.abierta).toBe(true);
      expect(res.efectivoEsperado).toBeUndefined();
      expect(res.totalesPorMedio).toBeUndefined();
      expect(res.resumen).toBeUndefined();
    });
  });

  describe('movimiento de caja chica', () => {
    it('debe registrar un movimiento si la caja está abierta y auditar', async () => {
      prismaMock.caja.findUnique.mockResolvedValue({
        id: 1n,
        estado: 'ABIERTA',
      });
      prismaMock.movimientoCaja.create.mockResolvedValue({
        id: 5n,
        caja_id: 1n,
        tipo: 'EGRESO',
        monto: new Prisma.Decimal(15),
        motivo: 'Compra de hielo',
      });

      const res = await service.crearMovimiento(
        { tipo: 'EGRESO', monto: 15, motivo: 'Compra de hielo' },
        cajeroUsuario,
      );

      expect(res.id).toBe('5');
      expect(res.tipo).toBe('EGRESO');
      expect(res.monto).toBe(15);
      expect(prismaMock.movimientoCaja.create).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'caja',
          accion: 'CREAR_MOVIMIENTO',
        }),
      );
    });

    it('si no hay caja abierta, registrar movimiento -> 409 CAJA_CERRADA', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(null);

      await expect(
        service.crearMovimiento(
          { tipo: 'INGRESO', monto: 20, motivo: 'Sencillo' },
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'CAJA_CERRADA',
          }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });

    it('debe anular un movimiento con motivo sin borrarlo', async () => {
      prismaMock.caja.findUnique.mockResolvedValue({ id: 1n, estado: 'ABIERTA' });
      prismaMock.movimientoCaja.findUnique.mockResolvedValue({
        id: 5n,
        anulado_en: null,
      });
      prismaMock.movimientoCaja.update.mockResolvedValue({
        id: 5n,
        caja_id: 1n,
        tipo: 'EGRESO',
        monto: new Prisma.Decimal(15),
        motivo: 'Compra de hielo',
        anulado_en: new Date(),
        motivo_anulacion: 'Error en monto',
      });

      const res = await service.anularMovimiento(
        5,
        { motivo: 'Error en monto' },
        cajeroUsuario,
      );

      expect(res.anulado_en).toBeDefined();
      expect(res.motivo_anulacion).toBe('Error en monto');
      expect(prismaMock.movimientoCaja.update).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'caja',
          accion: 'ANULAR_MOVIMIENTO',
        }),
      );
    });

    it('anular movimiento ya anulado -> 409 MOVIMIENTO_YA_ANULADO', async () => {
      prismaMock.movimientoCaja.findUnique.mockResolvedValue({
        id: 5n,
        anulado_en: new Date(),
      });

      await expect(
        service.anularMovimiento(
          5,
          { motivo: 'Intento duplicado' },
          cajeroUsuario,
        ),
      ).rejects.toThrow(
        expect.objectContaining({
          response: expect.objectContaining({
            codigo: 'MOVIMIENTO_YA_ANULADO',
          }),
          status: HttpStatus.CONFLICT,
        }),
      );
    });
  });

  describe('reglas nuevas de caja', () => {
    it('abrir dos veces a la vez: la segunda choca con la fecha única y responde CAJA_YA_ABIERTA (409)', async () => {
      prismaMock.caja.findUnique.mockResolvedValue(null);
      prismaMock.caja.findFirst.mockResolvedValue(null);
      prismaMock.caja.create.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

      await expect(service.abrirCaja({ apertura: 150 } as any, { partyId: 1n, rol: 'ADMIN' })).rejects.toMatchObject({
        response: { codigo: 'CAJA_YA_ABIERTA' },
        status: HttpStatus.CONFLICT,
      });
    });

    it('la apertura admite como máximo dos decimales (MONTO_INVALIDO)', async () => {
      await expect(service.abrirCaja({ apertura: 10.005 } as any, { partyId: 1n, rol: 'ADMIN' })).rejects.toMatchObject({
        response: { codigo: 'MONTO_INVALIDO' },
      });
    });

    it('no se anula un movimiento de una caja cerrada (un cierre no se edita)', async () => {
      prismaMock.movimientoCaja.findUnique.mockResolvedValue({ id: 6n, caja_id: 1n, anulado_en: null });
      prismaMock.caja.findUnique.mockResolvedValue({ id: 1n, estado: 'CERRADA' });

      await expect(
        service.anularMovimiento('6', { motivo: 'Error en monto' } as any, cajeroUsuario),
      ).rejects.toMatchObject({ response: { codigo: 'CAJA_CERRADA' } });
    });
  });
});
