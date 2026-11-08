jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
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
      expect(rango.inicio.getUTCDay()).toBe(1); // Lunes
      expect(rango.fin.getUTCDay()).toBe(0); // Domingo
      expect(rango.etiqueta).toMatch(/^Lun \d{2}\/\d{2} – Dom \d{2}\/\d{2}$/);
    });

    it('calcula rango de mes con primer y último día', () => {
      const rango = service.calcularRangoMes(0);
      expect(rango.inicio.getUTCDate()).toBe(1);
      expect(rango.navegable).toBe(true);
    });

    it('calcula rango personalizado con fechas explícitas', () => {
      const rango = service.calcularRangoPersonalizado('2026-10-01', '2026-10-15');
      expect(rango.etiqueta).toBe('Del 01/10/2026 al 15/10/2026');
      expect(rango.navegable).toBe(false);
    });
  });

  describe('registrarConsumo', () => {
    it('no carga a crédito un pedido ya cobrado en caja (YA_COBRADO)', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: BigInt(11), codigo: 'P-0011', total: '20.00', estado: 'PENDIENTE', canal: 'PERSONAL',
        pago_estado: 'PAGADO', consumoPersonal: null, lineas: [], cobro: { anulado_en: null },
      });
      await expect(service.registrarConsumo(11, 9)).rejects.toMatchObject({
        response: { codigo: 'YA_COBRADO' },
      });
    });

    it('no se consume crédito por la carta virtual (CANAL_NO_PERMITIDO)', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: BigInt(12), codigo: 'P-0012', total: '20.00', estado: 'PENDIENTE', canal: 'CARTA',
        pago_estado: 'PENDIENTE', consumoPersonal: null, lineas: [], cobro: null,
      });
      await expect(service.registrarConsumo(12, 9)).rejects.toMatchObject({
        response: { codigo: 'CANAL_NO_PERMITIDO' },
      });
    });

    it('el crédito no se da a clientes sin cuenta ni rol de empleado (NO_ES_PERSONAL)', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: BigInt(13), codigo: 'P-0013', total: '20.00', estado: 'PENDIENTE', canal: 'PERSONAL',
        pago_estado: 'PENDIENTE', consumoPersonal: null, lineas: [], cobro: null,
      });
      prisma.party.findUnique.mockResolvedValue({
        id: BigInt(20), persona: { nombres: 'Cliente', apellidos: 'Suelto' }, usuario: null, roles: [],
      });
      await expect(service.registrarConsumo(13, 20)).rejects.toMatchObject({
        response: { codigo: 'NO_ES_PERSONAL' },
      });
    });
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

    const partyPersonal = { id: BigInt(9), persona: { nombres: 'Marta', apellidos: 'Gómez' }, usuario: { activo: true }, roles: [] };

    it('un pedido que pasa a PAGADO por crédito (sin cobro de Caja) descuenta sus insumos por receta', async () => {
      const stock = { descontarPorPedido: jest.fn().mockResolvedValue({ ok: true }) };
      const svc = new CreditosService(prisma as any, auditoria as any, stock as any);
      prisma.parametro.findUnique.mockResolvedValue({ valor: 25 });
      prisma.pedido.findUnique.mockResolvedValue({
        id: BigInt(10), codigo: 'P-0010', total: '8.00', subtotal: '8.00', estado: 'COLA', canal: 'MOZO', consumoPersonal: null, cobros: [],
        lineas: [{ nombre: 'Café', subtotal: '8.00', precio_unit: '8.00', cantidad: 1, oferta_id: null, linea_combo_id: null }],
      });
      prisma.party.findUnique.mockResolvedValue(partyPersonal);
      prisma.$transaction.mockImplementation((cb: any) =>
        cb({
          consumoPersonal: { create: jest.fn().mockResolvedValue({ id: BigInt(1), monto: 6, fecha: new Date() }) },
          pedido: { update: jest.fn().mockResolvedValue({ id: BigInt(10), codigo: 'P-0010' }) },
        }),
      );
      await svc.registrarConsumo(10, 9, usuarioAdmin);
      expect(stock.descontarPorPedido).toHaveBeenCalledWith(BigInt(10));
    });

    it('un pedido del personal que ya trae su 25 % no lo repite ni toca el pedido: el consumo es su total', async () => {
      prisma.pedido.findUnique.mockResolvedValue({
        id: BigInt(10), codigo: 'CP-W010', total: '21.00', descuento: '7.00', estado: 'COLA', canal: 'MOZO',
        pago_estado: 'PAGADO', es_personal: true, consumoPersonal: null, cobros: [],
        descuento_detalle: [{ tipo: 'PERSONAL', montoDescontado: 7, descuentoValor: 25 }],
        lineas: [{ nombre: 'Café', subtotal: '28.00', precio_unit: '14', cantidad: 2, oferta_id: null, linea_combo_id: null }],
      });
      prisma.party.findUnique.mockResolvedValue(partyPersonal);
      const crearConsumo = jest.fn().mockResolvedValue({ id: BigInt(1), monto: 21, fecha: new Date() });
      const actualizar = jest.fn().mockResolvedValue({ id: BigInt(10), codigo: 'P-0010' });
      prisma.$transaction.mockImplementation((cb: any) => cb({ consumoPersonal: { create: crearConsumo }, pedido: { update: actualizar } }));

      const res = await service.registrarConsumo(10, 9);

      expect(crearConsumo.mock.calls[0][0].data.monto).toBe(21);
      expect(actualizar.mock.calls[0][0].data).not.toHaveProperty('descuento');
      expect(actualizar.mock.calls[0][0].data).not.toHaveProperty('total');
      expect(res.descuento).toBe(7);
    });

    it('suma el descuento del personal al que ya tenía el pedido en vez de pisarlo y deja el detalle', async () => {
      prisma.parametro.findUnique.mockResolvedValue({ valor: 25 });
      prisma.pedido.findUnique.mockResolvedValue({
        id: BigInt(10), codigo: 'P-0010', total: '23.00', descuento: '5.00', estado: 'COLA', canal: 'MOZO',
        pago_estado: 'PENDIENTE', consumoPersonal: null, cobros: [], descuento_detalle: [],
        lineas: [{ nombre: 'Café', subtotal: '20.00', precio_unit: '20', cantidad: 1, oferta_id: null, linea_combo_id: null }],
      });
      prisma.party.findUnique.mockResolvedValue(partyPersonal);
      const actualizar = jest.fn().mockResolvedValue({ id: BigInt(10), codigo: 'P-0010' });
      prisma.$transaction.mockImplementation((cb: any) =>
        cb({ consumoPersonal: { create: jest.fn().mockResolvedValue({ id: BigInt(1), monto: 18, fecha: new Date() }) }, pedido: { update: actualizar } }),
      );
      await service.registrarConsumo(10, 9);
      const data = actualizar.mock.calls[0][0].data;
      expect(data.descuento).toBe(10);
      expect(data.total).toBe(18);
      expect(data.descuento_detalle).toEqual([expect.objectContaining({ tipo: 'PERSONAL', montoDescontado: 5 })]);
      expect(data).not.toHaveProperty('party_id');
    });

    it('con ajustarPedido=false solo acumula el consumo: el pedido no se actualiza', async () => {
      prisma.parametro.findUnique.mockResolvedValue({ valor: 25 });
      prisma.pedido.findUnique.mockResolvedValue({
        id: BigInt(10), codigo: 'P-0010', total: '20.00', descuento: '0', estado: 'COLA', canal: 'MOZO',
        pago_estado: 'PAGADO', es_personal: true, consumoPersonal: null, cobros: [], descuento_detalle: [],
        lineas: [{ nombre: 'Café', subtotal: '20.00', precio_unit: '20', cantidad: 1, oferta_id: null, linea_combo_id: null }],
      });
      prisma.party.findUnique.mockResolvedValue(partyPersonal);
      const crearConsumo = jest.fn().mockResolvedValue({ id: BigInt(1), monto: 15, fecha: new Date() });
      const actualizar = jest.fn().mockResolvedValue({ id: BigInt(10), codigo: 'P-0010' });
      prisma.$transaction.mockImplementation((cb: any) => cb({ consumoPersonal: { create: crearConsumo }, pedido: { update: actualizar } }));
      await service.registrarConsumo(10, 9, undefined, undefined, false);
      expect(crearConsumo.mock.calls[0][0].data.monto).toBe(15);
      expect(actualizar).not.toHaveBeenCalled();
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

  describe('anulación', () => {
    it('el resumen deja fuera los consumos de pedidos anulados o rechazados', async () => {
      prisma.parametro.findUnique.mockResolvedValue({ valor: 25 });
      prisma.userAccount.findMany.mockResolvedValue([]);
      prisma.partyRole.findMany.mockResolvedValue([]);
      prisma.consumoPersonal.findMany.mockResolvedValue([]);
      await service.obtenerResumen({});
      expect(prisma.consumoPersonal.findMany.mock.calls[0][0].where.pedido).toEqual({
        estado: { notIn: ['ANULADO', 'RECHAZADO'] },
      });
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
