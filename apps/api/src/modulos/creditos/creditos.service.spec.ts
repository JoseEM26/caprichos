import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreditosService } from './creditos.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

describe('CreditosService', () => {
  let service: CreditosService;
  let prisma: {
    parametro: { findUnique: jest.Mock };
    pedido: { findUnique: jest.Mock; update: jest.Mock };
    party: { findUnique: jest.Mock };
    partyRole: { findMany: jest.Mock };
    userAccount: { findMany: jest.Mock };
    consumoPersonal: { create: jest.Mock; findMany: jest.Mock };
    $transaction: jest.Mock;
  };
  let auditoria: {
    registrar: jest.Mock;
  };

  const usuarioAdmin = {
    partyId: BigInt(1),
    rol: 'ADMIN',
    debeCambiar: false,
  } as any;

  beforeEach(async () => {
    prisma = {
      parametro: { findUnique: jest.fn() },
      pedido: { findUnique: jest.fn(), update: jest.fn() },
      party: { findUnique: jest.fn() },
      partyRole: { findMany: jest.fn() },
      userAccount: { findMany: jest.fn() },
      consumoPersonal: { create: jest.fn(), findMany: jest.fn() },
      $transaction: jest.fn(),
    };

    auditoria = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
      ],
    }).compile();

    service = module.get<CreditosService>(CreditosService);
  });

  describe('obtenerPorcentajeDescuento', () => {
    it('retorna 25 por defecto si no hay parámetro', async () => {
      prisma.parametro.findUnique.mockResolvedValue(null);
      const pct = await service.obtenerPorcentajeDescuento();
      expect(pct).toBe(25);
    });

    it('retorna el porcentaje configurado si existe', async () => {
      prisma.parametro.findUnique.mockResolvedValue({ valor: 20 });
      const pct = await service.obtenerPorcentajeDescuento();
      expect(pct).toBe(20);
    });
  });

  describe('rangos de fecha', () => {
    it('calcula rango de semana con lunes y domingo', () => {
      const rango = service.calcularRangoSemana(0);
      expect(rango.inicio.getDay()).toBe(1); // Lunes
      expect(rango.fin.getDay()).toBe(0); // Domingo
      expect(rango.etiqueta).toMatch(/^Lun \d{2}\/\d{2} – Dom \d{2}\/\d{2}$/);
    });

    it('calcula rango de mes con primer y último día', () => {
      const rango = service.calcularRangoMes(0);
      expect(rango.inicio.getDate()).toBe(1);
      expect(rango.navegable).toBe(true);
    });

    it('calcula rango personalizado con fechas explícitas', () => {
      const rango = service.calcularRangoPersonalizado('2026-10-01', '2026-10-15');
      expect(rango.etiqueta).toBe('Del 01/10/2026 al 15/10/2026');
      expect(rango.navegable).toBe(false);
    });
  });

  describe('registrarConsumo', () => {
    it('calcula descuento del 25 % solo a líneas elegibles (sin combos ni docenas) y registra consumo', async () => {
      prisma.parametro.findUnique.mockResolvedValue({ valor: 25 });
      prisma.pedido.findUnique.mockResolvedValue({
        id: BigInt(10),
        codigo: 'P-0010',
        total: '30.00',
        subtotal: '30.00',
        estado: 'PENDIENTE',
        consumoPersonal: null,
        lineas: [
          {
            nombre: 'Café americano',
            subtotal: '8.00',
            precio_unit: '8.00',
            cantidad: 1,
            oferta_id: null,
            linea_combo_id: null,
          },
          {
            nombre: 'Combo desayuno',
            subtotal: '22.00',
            precio_unit: '22.00',
            cantidad: 1,
            oferta_id: BigInt(1),
            linea_combo_id: null,
          },
        ],
      });

      prisma.party.findUnique.mockResolvedValue({
        id: BigInt(9),
        persona: { nombres: 'Marta', apellidos: 'Gómez' },
        usuario: { activo: true },
        roles: [],
      });

      const fakeConsumo = {
        id: BigInt(1),
        party_id: BigInt(9),
        pedido_id: BigInt(10),
        monto: 28, // 30 - 2 (25% de 8)
        fecha: new Date(),
      };
      const fakePedidoActualizado = {
        id: BigInt(10),
        codigo: 'P-0010',
      };

      prisma.$transaction.mockImplementation((cb: any) =>
        cb({
          consumoPersonal: {
            create: jest.fn().mockResolvedValue(fakeConsumo),
          },
          pedido: {
            update: jest.fn().mockResolvedValue(fakePedidoActualizado),
          },
        }),
      );

      const res = await service.registrarConsumo(10, 9, usuarioAdmin, '127.0.0.1');

      expect(res.monto).toBe(28);
      expect(res.descuento).toBe(2);
      expect(res.colaborador).toBe('Marta Gómez');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'creditos',
          accion: 'REGISTRAR_CONSUMO',
        }),
      );
    });

    it('falla con 404 si el pedido no existe', async () => {
      prisma.pedido.findUnique.mockResolvedValue(null);
      await expect(service.registrarConsumo(99, 1)).rejects.toThrow(NotFoundException);
    });

    it('falla con 409 si el pedido ya fue cobrado a crédito', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: BigInt(10),
        consumoPersonal: { id: BigInt(1) },
      });
      await expect(service.registrarConsumo(10, 1)).rejects.toThrow(ConflictException);
    });

    it('falla con 400 si el colaborador está desactivado', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: BigInt(10),
        consumoPersonal: null,
        lineas: [],
      });
      prisma.party.findUnique.mockResolvedValue({
        id: BigInt(5),
        usuario: { activo: false },
      });

      await expect(service.registrarConsumo(10, 5)).rejects.toThrow(BadRequestException);
    });
  });

  describe('obtenerResumen y exportar', () => {
    it('obtiene resumen agrupado y genera CSV de exportación', async () => {
      prisma.parametro.findUnique.mockResolvedValue({ valor: 25 });
      prisma.userAccount.findMany.mockResolvedValue([
        {
          party_id: BigInt(9),
          rol: 'CAJERO',
          party: { persona: { nombres: 'Marta', apellidos: 'Gómez' } },
        },
      ]);
      prisma.partyRole.findMany.mockResolvedValue([]);

      prisma.consumoPersonal.findMany.mockResolvedValue([
        {
          id: BigInt(1),
          party_id: BigInt(9),
          pedido_id: BigInt(101),
          monto: '26.40',
          fecha: new Date('2026-10-14T12:00:00Z'),
          pedido: {
            codigo: 'CP-P01',
            lineas: [{ cantidad: 1, nombre: 'Frappe lúcuma', tamano: 'Grande' }],
          },
        },
      ]);

      const resumen = await service.obtenerResumen({});
      expect(resumen.totales.totalMonto).toBe(26.4);
      expect(resumen.totales.trabajadoresConConsumo).toBe(1);
      expect(resumen.trabajadores[0].nombre).toBe('Marta Gómez');
      expect(resumen.trabajadores[0].items[0].lineas[0]).toBe('1 × Frappe lúcuma (Grande)');

      const exp = await service.exportar({}, usuarioAdmin, '10.0.0.1');
      expect(exp.nombreArchivo).toMatch(/\.csv$/);
      expect(exp.contenidoCsv).toContain('Marta Gómez');
      expect(exp.contenidoCsv).toContain('CP-P01');
      expect(exp.contenidoCsv).toContain('26.40');
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'LECTURA_SENSIBLE',
          modulo: 'creditos',
          accion: 'EXPORTAR',
        }),
      );
    });
  });
});
