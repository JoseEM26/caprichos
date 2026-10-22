// El gateway importa @nestjs/jwt (ESM): en las pruebas se usa un mock
jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

describe('RepartosService', () => {
  let service: RepartosService;
  let rutaService: RutaService;
  let prismaMock: any;
  let auditoriaMock: any;
  let eventosGatewayMock: any;

  const repartidor1: UsuarioAutenticado = {
    partyId: 101n,
    rol: 'REPARTIDOR',
    debeCambiar: false,
  };

  const repartidor2: UsuarioAutenticado = {
    partyId: 102n,
    rol: 'REPARTIDOR',
    debeCambiar: false,
  };

  const adminAuth: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prismaMock = {
      parametro: {
        findMany: jest.fn().mockResolvedValue([
          { clave: 'rep_naranja_min', valor: 35 },
          { clave: 'rep_rojo_min', valor: 50 },
          { clave: 'rep_max_pedidos', valor: 3 },
          { clave: 'rep_msg3_seg', valor: 90 },
        ]),
      },
      pedido: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      pedidoEstadoHistorial: {
        create: jest.fn(),
      },
      mensajeReparto: {
        upsert: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      incidenteEntrega: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    eventosGatewayMock = {
      emitirAdmin: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepartosService,
        RutaService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
      ],
    }).compile();

    service = module.get<RepartosService>(RepartosService);
    rutaService = module.get<RutaService>(RutaService);
  });

  describe('1. Límite de 3 pedidos por repartidor (DT-68 / RQ-DEL-02-20)', () => {
    it('lanza 409 LIMITE_PEDIDOS si el repartidor ya tiene 3 pedidos activos', async () => {
      // El repartidor ya tiene 3 pedidos activos en LISTO o EN_CAMINO
      prismaMock.pedido.count.mockResolvedValue(3);

      await expect(
        service.tomarPedido('10', repartidor1),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.tomarPedido('10', repartidor1),
      ).rejects.toMatchObject({
        response: {
          codigo: 'LIMITE_PEDIDOS',
          mensaje: 'Ya llevas 3 pedidos: entrega alguno antes de tomar otro',
        },
      });
    });

    it('permite tomar pedido si tiene menos de 3 pedidos activos', async () => {
      prismaMock.pedido.count.mockResolvedValue(2);
      prismaMock.pedido.updateMany.mockResolvedValue({ count: 1 });
      const pedidoMock = {
        id: 10n,
        codigo: 'CP-0100',
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        total: new Prisma.Decimal(45),
        pago_estado: 'PENDIENTE',
        pago_metodo: 'EFECTIVO',
        creado_en: new Date(),
        repartidor_party_id: 101n,
        tomado_en: new Date(),
        zona: { codigo: 'Z2' },
      };
      prismaMock.pedido.findUniqueOrThrow.mockResolvedValue(pedidoMock);

      const res = await service.tomarPedido('10', repartidor1);

      expect(res.id).toBe('10');
      expect(prismaMock.pedidoEstadoHistorial.create).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'TOMAR', modulo: 'repartos' }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith(
        'pedido:estado',
        expect.objectContaining({ id: 10, estado: 'LISTO', repartidor_party_id: 101 }),
      );
    });
  });

  describe('2. Concurrencia: dos repartidores toman el mismo pedido (RNF-CAP-010 / RN-CAP-024)', () => {
    it('el segundo repartidor recibe 409 YA_TOMADO si otro lo tomó antes', async () => {
      prismaMock.pedido.count.mockResolvedValue(0);
      // Simula que otro repartidor actualizó primero y updateMany afectó 0 filas
      prismaMock.pedido.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 20n,
        codigo: 'CP-0101',
        estado: 'LISTO',
        repartidor_party_id: 101n, // Ya tomado por el repartidor 1
        motivo_falla: null,
      });

      await expect(
        service.tomarPedido('20', repartidor2),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.tomarPedido('20', repartidor2),
      ).rejects.toMatchObject({
        response: {
          codigo: 'YA_TOMADO',
          mensaje: 'Otro repartidor ya tomó este pedido',
        },
      });
    });
  });

  describe('2b. Delivery sin ubicación (RQ-CAJ-01-03)', () => {
    it('no se puede tomar hasta que caja lo ubique: 409 FALTA_UBICAR', async () => {
      prismaMock.pedido.count.mockResolvedValue(0);
      prismaMock.pedido.updateMany.mockResolvedValue({ count: 0 });
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 30n,
        estado: 'LISTO',
        repartidor_party_id: null,
        motivo_falla: null,
        entrega_lat: null,
        entrega_lng: null,
      });

      await expect(service.tomarPedido('30', repartidor1)).rejects.toMatchObject({
        response: { codigo: 'FALTA_UBICAR' },
      });
      expect(prismaMock.pedido.updateMany.mock.calls[0][0].where).toMatchObject({
        entrega_lat: { not: null },
        entrega_lng: { not: null },
      });
    });
  });

  describe('3. Transiciones de estado (Tomar -> Salir -> Llegué -> Entregar)', () => {
    it('POST :id/salir cambia de LISTO a EN_CAMINO y registra aviso 1 pendiente', async () => {
      const pedidoMock = {
        id: 30n,
        codigo: 'CP-0102',
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        repartidor_party_id: 101n,
        creado_en: new Date(),
        total: new Prisma.Decimal(50),
        zona: { codigo: 'Z1' },
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        estado: 'EN_CAMINO',
        salio_en: new Date(),
      });

      const res = await service.salir('30', repartidor1);

      expect(res.estado).toBe('EN_CAMINO');
      // Registra aviso 1 pendiente
      expect(prismaMock.mensajeReparto.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ numero: 1, estado: 'PENDIENTE' }),
        }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith(
        'pedido:estado',
        expect.objectContaining({ id: 30, estado: 'EN_CAMINO' }),
      );
    });

    it('rechaza salir si el pedido no está asignado al repartidor', async () => {
      const pedidoMock = {
        id: 31n,
        codigo: 'CP-0103',
        estado: 'LISTO',
        repartidor_party_id: 102n, // Asignado a otro
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);

      await expect(service.salir('31', repartidor1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('POST :id/llegue registra llego_en y aviso 2 pendiente', async () => {
      const pedidoMock = {
        id: 32n,
        codigo: 'CP-0104',
        modalidad: 'DELIVERY',
        estado: 'EN_CAMINO',
        repartidor_party_id: 101n,
        creado_en: new Date(),
        total: new Prisma.Decimal(60),
        zona: { codigo: 'Z2' },
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        llego_en: new Date(),
      });

      const res = await service.llegue('32', repartidor1);

      expect(res.estado).toBe('EN_CAMINO');
      expect(prismaMock.mensajeReparto.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ numero: 2, estado: 'PENDIENTE' }),
        }),
      );
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'LLEGUE' }),
      );
    });

    it('POST :id/entregar cambia a ENTREGADO sin cobrar si es contra entrega en efectivo', async () => {
      const pedidoMock = {
        id: 33n,
        codigo: 'CP-0105',
        modalidad: 'DELIVERY',
        estado: 'EN_CAMINO',
        repartidor_party_id: 101n,
        pago_estado: 'PENDIENTE',
        pago_metodo: 'EFECTIVO',
        total: new Prisma.Decimal(38.5),
        creado_en: new Date(),
        zona: { codigo: 'Z2' },
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        estado: 'ENTREGADO',
        entregado_en: new Date(),
      });

      const res = await service.entregar('33', repartidor1);

      expect(res.estado).toBe('ENTREGADO');
      // No modifica pago_estado, deja dato de efectivo a rendir
      expect(res.pago_estado).toBe('PENDIENTE');
      expect(res.por_rendir_efectivo).toBe(38.5);
      expect(prismaMock.pedidoEstadoHistorial.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            estado_anterior: 'EN_CAMINO',
            estado_nuevo: 'ENTREGADO',
          }),
        }),
      );
    });
  });

  describe('4. Avisos de reparto 1-2-3 (DT-60 / DT-74)', () => {
    it('genera aviso 3 pendiente tras 90 segundos sin respuesta del aviso 2', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ id: 40n });

      const ahora = Date.now();
      const hace100Seg = new Date(ahora - 100 * 1000);

      // Aviso 1 y aviso 2 enviados hace 100 segundos, sin respuesta
      prismaMock.mensajeReparto.findMany
        .mockResolvedValueOnce([
          { pedido_id: 40n, numero: 1, enviado_en: hace100Seg, estado: 'PENDIENTE', respondido_en: null },
          { pedido_id: 40n, numero: 2, enviado_en: hace100Seg, estado: 'PENDIENTE', respondido_en: null },
        ])
        .mockResolvedValueOnce([
          { pedido_id: 40n, numero: 1, enviado_en: hace100Seg, estado: 'PENDIENTE', respondido_en: null },
          { pedido_id: 40n, numero: 2, enviado_en: hace100Seg, estado: 'PENDIENTE', respondido_en: null },
          { pedido_id: 40n, numero: 3, enviado_en: new Date(), estado: 'PENDIENTE', respondido_en: null },
        ]);

      const mensajes = await service.consultarMensajes('40');

      expect(prismaMock.mensajeReparto.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pedido_id: 40n, numero: 3, estado: 'PENDIENTE' }),
        }),
      );
      expect(mensajes).toHaveLength(3);
    });

    it('no genera aviso 3 si el cliente ya respondió al aviso 2', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({ id: 41n });
      const hace100Seg = new Date(Date.now() - 100 * 1000);

      prismaMock.mensajeReparto.findMany.mockResolvedValue([
        { pedido_id: 41n, numero: 2, enviado_en: hace100Seg, estado: 'ENVIADO', respondido_en: new Date() },
      ]);

      const mensajes = await service.consultarMensajes('41');

      expect(prismaMock.mensajeReparto.create).not.toHaveBeenCalled();
      expect(mensajes).toHaveLength(1);
    });
  });

  describe('5. Entrega fallida y evidencia (FT-DEL-03 / DT-70)', () => {
    it('exige al menos 2 llamadas para motivo NO_CONTESTA (400 EVIDENCIA_INSUFICIENTE)', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 50n,
        codigo: 'CP-0106',
        estado: 'EN_CAMINO',
      });

      // Solo 1 llamada registrada
      await expect(
        service.reportarFalla(
          '50',
          {
            motivo: 'NO_CONTESTA',
            contactos: [{ tipo: 'LLAMADA' }],
          },
          repartidor1,
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.reportarFalla(
          '50',
          {
            motivo: 'NO_CONTESTA',
            contactos: [{ tipo: 'LLAMADA' }, { tipo: 'WHATSAPP' }],
          },
          repartidor1,
        ),
      ).rejects.toMatchObject({
        response: {
          codigo: 'EVIDENCIA_INSUFICIENTE',
        },
      });
    });

    it('reporta falla con 2 llamadas: crea incidente con intento 1 y pedido pasa a motivo_falla', async () => {
      const pedidoMock = {
        id: 51n,
        codigo: 'CP-0107',
        estado: 'EN_CAMINO',
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.incidenteEntrega.count.mockResolvedValue(0); // Intento 1
      prismaMock.incidenteEntrega.create.mockResolvedValue({
        id: 501n,
        pedido_id: 51n,
        intento: 1,
        motivo: 'NO_CONTESTA',
      });
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        estado: 'LISTO',
        repartidor_party_id: null,
        motivo_falla: 'NO_CONTESTA',
      });

      const res = await service.reportarFalla(
        '51',
        {
          motivo: 'NO_CONTESTA',
          contactos: [{ tipo: 'LLAMADA' }, { tipo: 'LLAMADA' }],
          fotoArchivoId: 999,
        },
        repartidor1,
      );

      expect(res.ok).toBe(true);
      expect(res.intento).toBe(1);
      expect(prismaMock.incidenteEntrega.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            intento: 1,
            motivo: 'NO_CONTESTA',
            foto_archivo_id: 999n,
          }),
        }),
      );
      // El pedido pasa a LISTO sin repartidor para coordinación de caja
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            motivo_falla: 'NO_CONTESTA',
            repartidor_party_id: null,
            estado: 'LISTO',
          }),
        }),
      );
    });

    it('caja resuelve falla con POST :id/resolver y nota', async () => {
      const pedidoMock = {
        id: 52n,
        codigo: 'CP-0108',
        estado: 'LISTO',
        motivo_falla: 'NO_CONTESTA',
        total: new Prisma.Decimal(40),
        envio: new Prisma.Decimal(5),
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoMock);
      prismaMock.incidenteEntrega.findFirst.mockResolvedValue({
        id: 502n,
        pedido_id: 52n,
      });
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoMock,
        motivo_falla: null,
        total: new Prisma.Decimal(43),
        estado: 'LISTO',
      });

      const res = await service.resolverFalla(
        '52',
        {
          nota: 'Cliente contestó, reprogramar para las 8pm',
          cierre: 'REPROGRAMADO',
          recargo: 3,
        },
        adminAuth,
      );

      expect(res.ok).toBe(true);
      expect(prismaMock.incidenteEntrega.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            cierre: 'REPROGRAMADO',
            recargo: expect.any(Prisma.Decimal),
            cerrado_por: 1n,
          }),
        }),
      );
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            motivo_falla: null,
            estado: 'LISTO',
            total: expect.any(Prisma.Decimal),
          }),
        }),
      );
    });
  });

  describe('6. Listados disponibles y míos con ruta sugerida', () => {
    it('GET disponibles lista pedidos DELIVERY en LISTO sin repartidor ni falla', async () => {
      const pedidosMock = [
        {
          id: 60n,
          codigo: 'CP-0109',
          modalidad: 'DELIVERY',
          estado: 'LISTO',
          total: new Prisma.Decimal(50),
          pago_estado: 'PENDIENTE',
          pago_metodo: 'EFECTIVO',
          paga_con: new Prisma.Decimal(100),
          creado_en: new Date(),
          entrega_lat: new Prisma.Decimal(-12.015),
          entrega_lng: new Prisma.Decimal(-76.965),
          zona: { codigo: 'Z2' },
          repartidor_party_id: null,
          motivo_falla: null,
        },
      ];
      prismaMock.pedido.findMany.mockResolvedValue(pedidosMock);

      const items = await service.listarDisponibles();

      expect(items).toHaveLength(1);
      expect(items[0].id).toBe('60');
      expect(items[0].cobro_pendiente_efectivo).toBe(true);
      expect(items[0].paga_con).toBe(100);
      expect(items[0].color).toBe('verde');
    });

    it('GET mios retorna los pedidos asignados con orden, paso y ruta', async () => {
      const propiosMock = [
        {
          id: 70n,
          codigo: 'CP-0110',
          modalidad: 'DELIVERY',
          estado: 'LISTO',
          total: new Prisma.Decimal(40),
          creado_en: new Date(),
          entrega_lat: new Prisma.Decimal(-12.014),
          entrega_lng: new Prisma.Decimal(-76.966),
          zona: { codigo: 'Z2' },
          repartidor_party_id: 101n,
        },
      ];
      prismaMock.pedido.findMany
        .mockResolvedValueOnce(propiosMock) // Propios
        .mockResolvedValueOnce([]); // Disponibles para paso

      const res = await service.listarMios(repartidor1);

      expect(res.pedidos).toHaveLength(1);
      expect(res.orden).toEqual(['70']);
      expect(Array.isArray(res.paso)).toBe(true);
      expect(Array.isArray(res.ruta)).toBe(true);
    });
  });
});
