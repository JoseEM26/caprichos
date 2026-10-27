jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({
    signAsync: jest.fn(),
    verifyAsync: jest.fn(),
  })),
  JwtModule: {
    registerAsync: jest.fn().mockReturnValue({
      module: class MockJwtModule {},
    }),
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { Prisma } from '@prisma/client';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

describe('Aislamiento estricto en servidor para rol REPARTIDOR', () => {
  let service: RepartosService;
  let prismaMock: any;
  let auditoriaMock: any;

  const repartidorA: UsuarioAutenticado = {
    partyId: 1001n,
    rol: 'REPARTIDOR',
    debeCambiar: false,
  };

  const repartidorB: UsuarioAutenticado = {
    partyId: 1002n,
    rol: 'REPARTIDOR',
    debeCambiar: false,
  };

  const adminUser: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prismaMock = {
      parametro: {
        findMany: jest.fn().mockResolvedValue([
          { clave: 'rep_max_pedidos', valor: 5 },
        ]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      pedido: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      mensajeReparto: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        upsert: jest.fn(),
      },
      pedidoEstadoHistorial: {
        create: jest.fn(),
      },
      incidenteEntrega: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(),
      },
      person: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
      $queryRaw: jest.fn(),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepartosService,
        RutaService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();

    service = module.get<RepartosService>(RepartosService);
  });

  describe('1. listarTodos - Aislamiento de pedidos en listado principal', () => {
    it('Repartidor A ve SOLO sus pedidos y nunca los de B ni pedidos sin asignar', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([]);

      await service.listarTodos({}, repartidorA);

      expect(prismaMock.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            modalidad: 'DELIVERY',
            repartidor_party_id: 1001n,
          }),
        }),
      );
    });

    it('Repartidor A no puede ver pedidos de B aunque pase el filtro ?repartidor=1002', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([]);

      await service.listarTodos({ repartidor: '1002' }, repartidorA);

      expect(prismaMock.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            modalidad: 'DELIVERY',
            repartidor_party_id: 1001n,
          }),
        }),
      );
    });

    it('El Administrador ve todos los repartidores y puede filtrar por repartidor', async () => {
      prismaMock.pedido.findMany.mockResolvedValue([]);

      await service.listarTodos({ repartidor: '1002' }, adminUser);

      expect(prismaMock.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            modalidad: 'DELIVERY',
            repartidor_party_id: 1002n,
          }),
        }),
      );
    });
  });

  describe('2. Teléfono del cliente oculto antes de tomar el pedido', () => {
    it('En listarDisponibles el teléfono es null para REPARTIDOR', async () => {
      const pedidoDisponible = {
        id: 501n,
        codigo: 'CP-DISP1',
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        cliente_nombre: 'Juan Perez',
        cliente_telefono: '987654321',
        entrega_direccion: 'Av Principal 123',
        entrega_referencia: 'Frente al parque',
        entrega_lat: new Prisma.Decimal(-12.015),
        entrega_lng: new Prisma.Decimal(-76.965),
        total: new Prisma.Decimal(50),
        pago_estado: 'PENDIENTE',
        pago_metodo: 'EFECTIVO',
        repartidor_party_id: null,
        creado_en: new Date(),
        lineas: [{ cantidad: 2 }, { cantidad: 1 }],
      };
      prismaMock.pedido.findMany.mockResolvedValue([pedidoDisponible]);

      const res = await service.listarDisponibles(repartidorA);

      expect(res).toHaveLength(1);
      expect(res[0].codigo).toBe('CP-DISP1');
      expect(res[0].cantidad_productos).toBe(3);
      // REGLA CLAVE: Teléfono del cliente oculto
      expect(res[0].cliente_telefono).toBeNull();
    });

    it('En listarDisponibles el teléfono SÍ es visible para ADMIN', async () => {
      const pedidoDisponible = {
        id: 501n,
        codigo: 'CP-DISP1',
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        cliente_nombre: 'Juan Perez',
        cliente_telefono: '987654321',
        entrega_direccion: 'Av Principal 123',
        total: new Prisma.Decimal(50),
        pago_estado: 'PENDIENTE',
        pago_metodo: 'EFECTIVO',
        repartidor_party_id: null,
        creado_en: new Date(),
        lineas: [{ cantidad: 2 }],
      };
      prismaMock.pedido.findMany.mockResolvedValue([pedidoDisponible]);

      const res = await service.listarDisponibles(adminUser);

      expect(res).toHaveLength(1);
      expect(res[0].cliente_telefono).toBe('987654321');
    });

    it('En listarMios el teléfono SÍ es visible porque el pedido ya está asignado al repartidor', async () => {
      const pedidoMio = {
        id: 601n,
        codigo: 'CP-MIO1',
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        cliente_nombre: 'Maria Gomez',
        cliente_telefono: '912345678',
        entrega_direccion: 'Calle Los Robles 456',
        entrega_lat: new Prisma.Decimal(-12.016),
        entrega_lng: new Prisma.Decimal(-76.964),
        total: new Prisma.Decimal(35),
        pago_estado: 'PAGADO',
        pago_metodo: 'YAPE',
        repartidor_party_id: 1001n,
        creado_en: new Date(),
        lineas: [{ cantidad: 4 }],
      };
      prismaMock.pedido.findMany
        .mockResolvedValueOnce([pedidoMio]) // pedidosPropios
        .mockResolvedValueOnce([]); // pedidosDisponibles al paso

      const res = await service.listarMios(repartidorA);

      expect(res.pedidos).toHaveLength(1);
      expect(res.pedidos[0].cliente_telefono).toBe('912345678');
      expect(res.pedidos[0].cantidad_productos).toBe(4);
      expect(res.orden).toContain('601');
    });
  });

  describe('3. Protección contra acciones en pedidos ajenos (403 NO_ASIGNADO)', () => {
    const pedidoDeA = {
      id: 701n,
      codigo: 'CP-DE-A',
      modalidad: 'DELIVERY',
      estado: 'EN_CAMINO',
      repartidor_party_id: 1001n,
      total: new Prisma.Decimal(40),
    };

    it('Repartidor B no puede consultar mensajes del pedido de A (403 NO_ASIGNADO)', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoDeA);

      await expect(
        service.consultarMensajes('701', repartidorB),
      ).rejects.toThrow(ForbiddenException);

      await expect(
        service.consultarMensajes('701', repartidorB),
      ).rejects.toMatchObject({
        response: { codigo: 'NO_ASIGNADO' },
      });
    });

    it('Repartidor B no puede reportar falla en pedido de A (403 NO_ASIGNADO)', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoDeA);

      await expect(
        service.reportarFalla(
          '701',
          {
            motivo: 'NO_CONTESTA',
            contactos: [{ tipo: 'LLAMADA' }, { tipo: 'LLAMADA' }],
          },
          repartidorB,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Repartidor B no puede marcar llegada o entrega en pedido de A (403 NO_ASIGNADO)', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoDeA);

      await expect(service.llegue('701', repartidorB)).rejects.toThrow(ForbiddenException);
      await expect(service.entregar('701', repartidorB)).rejects.toThrow(ForbiddenException);
    });

    it('Admin sí puede consultar mensajes del pedido de cualquier repartidor', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoDeA);
      prismaMock.mensajeReparto.findMany.mockResolvedValue([{ numero: 1, enviado_en: new Date() }]);

      const res = await service.consultarMensajes('701', adminUser);
      expect(res).toHaveLength(1);
    });
  });

  describe('4. Límite rep_max_pedidos (default 5)', () => {
    it('Rechaza tomar pedido si el repartidor ya tiene 5 activos (409 LIMITE_PEDIDOS)', async () => {
      prismaMock.pedido.count.mockResolvedValue(5);

      await expect(
        service.tomarPedido('801', repartidorA),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.tomarPedido('801', repartidorA),
      ).rejects.toMatchObject({
        response: { codigo: 'LIMITE_PEDIDOS' },
      });
    });

    it('Permite tomar pedido si tiene 4 activos (< 5)', async () => {
      prismaMock.pedido.count.mockResolvedValue(4);
      prismaMock.pedido.updateMany.mockResolvedValue({ count: 1 });
      prismaMock.pedido.findUniqueOrThrow.mockResolvedValue({
        id: 802n,
        codigo: 'CP-TOMADO',
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        total: new Prisma.Decimal(20),
        pago_estado: 'PENDIENTE',
        pago_metodo: 'EFECTIVO',
        creado_en: new Date(),
        repartidor_party_id: 1001n,
        tomado_en: new Date(),
        lineas: [],
      });

      const res = await service.tomarPedido('802', repartidorA);
      expect(res.codigo).toBe('CP-TOMADO');
    });
  });

  describe('5. Toma concurrente atómica', () => {
    it('Si otro repartidor ganó el pedido antes, updateMany afecta 0 y da 409 YA_TOMADO', async () => {
      prismaMock.pedido.count.mockResolvedValue(0);
      prismaMock.pedido.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 901n,
        codigo: 'CP-GANADO',
        estado: 'LISTO',
        repartidor_party_id: 1002n, // Ya lo tomó B
        motivo_falla: null,
      });

      await expect(service.tomarPedido('901', repartidorA)).rejects.toThrow(ConflictException);
      await expect(service.tomarPedido('901', repartidorA)).rejects.toMatchObject({
        response: { codigo: 'YA_TOMADO' },
      });
    });
  });
});
