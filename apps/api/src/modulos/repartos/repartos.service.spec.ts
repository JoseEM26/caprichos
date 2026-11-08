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
import { COORDENADAS_LOCAL_DEFAULT, RutaService } from './ruta.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AvisosPedidoService } from '../chatbot/servicios/avisos-pedido.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

describe('RepartosService', () => {
  let service: RepartosService;
  let rutaService: RutaService;
  let prismaMock: any;
  let auditoriaMock: any;
  let eventosGatewayMock: any;
  let avisosMock: any;

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
      solicitudCambioCobro: { findFirst: jest.fn().mockResolvedValue(null) },
      parametro: {
        findMany: jest.fn().mockResolvedValue([
          { clave: 'rep_naranja_min', valor: 35 },
          { clave: 'rep_rojo_min', valor: 50 },
          { clave: 'rep_max_pedidos', valor: 3 },
          { clave: 'rep_msg3_seg', valor: 90 },
        ]),
        findUnique: jest.fn(),
        upsert: jest.fn(),
      },
      rutaReparto: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 1n }), update: jest.fn(), delete: jest.fn() },
      zonaReparto: {
        findMany: jest.fn(),
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
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
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
      person: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      archivo: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      userAccount: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    eventosGatewayMock = {
      emitirAdmin: jest.fn(),
    };

    avisosMock = {
      avisar: jest.fn().mockResolvedValue({ estado: 'ENCOLADO' }),
      despertar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RepartosService,
        RutaService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: EventosGateway, useValue: eventosGatewayMock },
        { provide: AvisosPedidoService, useValue: avisosMock },
      ],
    }).compile();

    service = module.get<RepartosService>(RepartosService);
    rutaService = module.get<RutaService>(RutaService);
  });

  describe('1. Límite de pedidos por repartidor (rep_max_pedidos default 5)', () => {
    it('lanza 409 LIMITE_PEDIDOS si el repartidor ya tiene 5 pedidos activos', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'rep_max_pedidos', valor: 5 },
      ]);
      // El repartidor ya tiene 5 pedidos activos en LISTO o EN_CAMINO
      prismaMock.pedido.count.mockResolvedValue(5);

      await expect(
        service.tomarPedido('10', repartidor1),
      ).rejects.toThrow(ConflictException);

      await expect(
        service.tomarPedido('10', repartidor1),
      ).rejects.toMatchObject({
        response: {
          codigo: 'LIMITE_PEDIDOS',
          mensaje: 'Ya llevas 5 pedidos: entrega alguno antes de tomar otro',
        },
      });
    });

    it('permite tomar pedido si tiene menos de 5 pedidos activos', async () => {
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
      // Asignar ya no avisa al cliente: solo «Ya salió», «Ya llegó» y «Entregado»
      expect(avisosMock.avisar).not.toHaveBeenCalled();
      expect(prismaMock.pedidoEstadoHistorial.create).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'TOMAR', modulo: 'repartos' }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith(
        'pedido:estado',
        expect.objectContaining({ id: 10, estado: 'LISTO', repartidor_party_id: '101' }),
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
      // Ya no pre-registra el aviso (lo registra AvisosPedidoService al enviar); dispara el aviso de salida
      expect(prismaMock.mensajeReparto.upsert).not.toHaveBeenCalled();
      expect(avisosMock.avisar).toHaveBeenCalledWith(30n, 'SALIDA', {}, expect.anything());
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

    it('POST :id/llegue registra llego_en y dispara el aviso de llegada', async () => {
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
      expect(prismaMock.mensajeReparto.upsert).not.toHaveBeenCalled();
      expect(avisosMock.avisar).toHaveBeenCalledWith(32n, 'LLEGADA', {}, expect.anything());
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'LLEGUE' }),
      );
    });

    it('POST :id/entregar de un delivery sin repartidor: 409 REPARTIDOR_REQUERIDO, no se marca entregado', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 34n,
        codigo: 'CP-0106',
        modalidad: 'DELIVERY',
        estado: 'EN_CAMINO',
        repartidor_party_id: null,
        zona: null,
      });

      await expect(service.entregar('34', adminAuth)).rejects.toMatchObject({
        status: 409,
        response: { codigo: 'REPARTIDOR_REQUERIDO' },
      });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
    });

    it('POST :id/entregar con un cambio de cobro pendiente: 409 «Esperando que Caja valide el pago», no se entrega', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 35n, codigo: 'CP-0107', modalidad: 'DELIVERY', estado: 'EN_CAMINO', repartidor_party_id: 101n,
        pago_estado: 'PENDIENTE', pago_metodo: 'EFECTIVO', total: new Prisma.Decimal(40), creado_en: new Date(), zona: null,
      });
      prismaMock.solicitudCambioCobro = { findFirst: jest.fn().mockResolvedValue({ id: 3n }) };

      await expect(service.entregar('35', repartidor1)).rejects.toMatchObject({
        status: 409,
        response: { codigo: 'CAMBIO_COBRO_PENDIENTE', mensaje: 'Esperando que Caja valide el pago…' },
      });
      expect(prismaMock.pedido.update).not.toHaveBeenCalled();
      expect(prismaMock.solicitudCambioCobro.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { pedido_id: 35n, estado: 'PENDIENTE' } }),
      );
    });

    it('POST :id/entregar con el cambio aprobado: el efectivo por rendir sale del plan nuevo', async () => {
      const base = {
        id: 36n, codigo: 'CP-0108', modalidad: 'DELIVERY', estado: 'EN_CAMINO', repartidor_party_id: 101n,
        pago_estado: 'PENDIENTE', total: new Prisma.Decimal(40), creado_en: new Date(), zona: null,
      };
      prismaMock.solicitudCambioCobro = { findFirst: jest.fn().mockResolvedValue(null) };
      // efectivo → Yape aprobado: ya no hay efectivo que rendir
      prismaMock.pedido.findUnique.mockResolvedValue({ ...base, pago_metodo: 'YAPE', planPago: [] });
      prismaMock.pedido.update.mockResolvedValue({ ...base, pago_metodo: 'YAPE', estado: 'ENTREGADO' });
      expect((await service.entregar('36', repartidor1)).por_rendir_efectivo).toBe(0);
      // efectivo + Yape aprobado: solo el renglón de efectivo
      const plan = [{ medio: 'EFECTIVO', monto: new Prisma.Decimal(15) }, { medio: 'YAPE', monto: new Prisma.Decimal(25) }];
      prismaMock.pedido.findUnique.mockResolvedValue({ ...base, pago_metodo: 'YAPE', planPago: plan });
      prismaMock.pedido.update.mockResolvedValue({ ...base, pago_metodo: 'YAPE', estado: 'ENTREGADO', planPago: plan });
      expect((await service.entregar('36', repartidor1)).por_rendir_efectivo).toBe(15);
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
    it('consultar mensajes es solo lectura: no crea el aviso 3 (lo decide el planificador por tiempo)', async () => {
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

      expect(prismaMock.mensajeReparto.create).not.toHaveBeenCalled();
      expect(mensajes).toHaveLength(2);
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
        repartidor_party_id: 101n,
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
        repartidor_party_id: 101n,
      };
      prismaMock.pedido.findUnique.mockResolvedValue({
        ...pedidoMock,
        llego_en: new Date(Date.now() - 15 * 60000),
      });
      prismaMock.archivo.findMany.mockResolvedValue([{ id: 999n }]);
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

  describe('5b. Prueba de entrega fallida: cliente no salió (fotos y tiempo de espera)', () => {
    const minutosAtras = (min: number) => new Date(Date.now() - min * 60000);

    const pedidoEnPuerta = (llegoHaceMin: number | null) => ({
      id: 60n,
      codigo: 'CP-0110',
      estado: 'EN_CAMINO',
      repartidor_party_id: 101n,
      llego_en: llegoHaceMin == null ? null : minutosAtras(llegoHaceMin),
    });

    const reportarNoSalio = (fotoArchivoIds?: (number | string)[]) =>
      service.reportarFalla(
        '60',
        {
          motivo: 'NO_CONTESTA',
          contactos: [{ tipo: 'LLAMADA' }, { tipo: 'LLAMADA' }],
          fotoArchivoIds,
        },
        repartidor1,
      );

    beforeEach(() => {
      prismaMock.incidenteEntrega.count.mockResolvedValue(0);
      prismaMock.incidenteEntrega.create.mockResolvedValue({ id: 700n, intento: 1 });
      prismaMock.pedido.update.mockResolvedValue({ id: 60n, codigo: 'CP-0110', estado: 'LISTO', motivo_falla: 'NO_CONTESTA' });
      prismaMock.archivo.findMany.mockImplementation(async ({ where }: any) =>
        where.id.in.map((id: bigint) => ({ id })),
      );
    });

    it('sin «Llegué» marcado: rechazado (SIN_LLEGADA)', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoEnPuerta(null));
      await expect(reportarNoSalio([1])).rejects.toMatchObject({ response: { codigo: 'SIN_LLEGADA' } });
      expect(prismaMock.incidenteEntrega.create).not.toHaveBeenCalled();
    });

    it('antes de cumplirse la espera: rechazado con cuántos minutos faltan', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoEnPuerta(4));
      await expect(reportarNoSalio([1])).rejects.toMatchObject({
        response: { codigo: 'ESPERA_NO_CUMPLIDA', mensaje: 'Aún no pasó el tiempo de espera (faltan 6 min)' },
      });
      expect(prismaMock.incidenteEntrega.create).not.toHaveBeenCalled();
    });

    it('pasado el tiempo sin foto: rechazado (FOTO_REQUERIDA)', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoEnPuerta(15));
      await expect(reportarNoSalio([])).rejects.toMatchObject({ response: { codigo: 'FOTO_REQUERIDA' } });
      expect(prismaMock.incidenteEntrega.create).not.toHaveBeenCalled();
    });

    it('pasado el tiempo con 2 fotos: guarda llegada, minutos esperados y las fotos en el incidente', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoEnPuerta(15));
      await reportarNoSalio([11, '12']);

      expect(prismaMock.incidenteEntrega.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          motivo: 'NO_CONTESTA',
          foto_archivo_id: 11n,
          llego_en: expect.any(Date),
          espera_max_min: 10,
          repartidor_party_id: 101n,
          fotos: { create: [{ archivo_id: 11n }, { archivo_id: 12n }] },
        }),
      });
    });

    it('acepta 1 a 3 fotos y rechaza más de 3', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoEnPuerta(15));
      await reportarNoSalio([21]);
      await reportarNoSalio([21, 22, 23]);
      expect(prismaMock.incidenteEntrega.create).toHaveBeenCalledTimes(2);

      await expect(reportarNoSalio([1, 2, 3, 4])).rejects.toMatchObject({ response: { codigo: 'DEMASIADAS_FOTOS' } });
      expect(prismaMock.incidenteEntrega.create).toHaveBeenCalledTimes(2);
    });

    it('otro motivo (dirección no encontrada) no pide llegada ni foto', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoEnPuerta(null));
      const res = await service.reportarFalla(
        '60',
        { motivo: 'DIRECCION_NO_ENCONTRADA', contactos: [] },
        repartidor1,
      );
      expect(res.ok).toBe(true);
      expect(prismaMock.incidenteEntrega.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ motivo: 'DIRECCION_NO_ENCONTRADA', llego_en: null, espera_max_min: null }),
      });
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
      expect(items[0].color).toBe('VERDE');
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
      expect(res.distanciaKm).toBeDefined();
      expect(res.tiempoMin).toBeDefined();
      expect(res.totalParadas).toBe(1);
    });
  });

  describe('7. Umbrales de color y tiempos de espera de reparto', () => {
    it('calcula los cuatro colores según umbrales (VERDE, RETRASADO, TARDE, MUY_TARDE)', () => {
      const ahora = new Date();
      const hace10Min = new Date(ahora.getTime() - 10 * 60000);
      const hace22Min = new Date(ahora.getTime() - 22 * 60000);
      const hace35Min = new Date(ahora.getTime() - 35 * 60000);
      const hace50Min = new Date(ahora.getTime() - 50 * 60000);

      const rVerde = service.calcularMinutosYColor(hace10Min, ahora, 20, 30, 45);
      expect(rVerde.minutosEspera).toBe(10);
      expect(rVerde.color).toBe('VERDE');

      const rAmarillo = service.calcularMinutosYColor(hace22Min, ahora, 20, 30, 45);
      expect(rAmarillo.minutosEspera).toBe(22);
      expect(rAmarillo.color).toBe('RETRASADO');

      const rNaranja = service.calcularMinutosYColor(hace35Min, ahora, 20, 30, 45);
      expect(rNaranja.minutosEspera).toBe(35);
      expect(rNaranja.color).toBe('TARDE');

      const rRojo = service.calcularMinutosYColor(hace50Min, ahora, 20, 30, 45);
      expect(rRojo.minutosEspera).toBe(50);
      expect(rRojo.color).toBe('MUY_TARDE');
    });
  });

  describe('8. Visibilidad restringida para REPARTIDOR (RQ-DEL-02-03)', () => {
    it('un repartidor solo consulta sus pedidos asignados y los disponibles', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([]);
      prismaMock.pedido.findMany.mockResolvedValue([]);

      await service.listarTodos({}, repartidor1);

      expect(prismaMock.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            modalidad: 'DELIVERY',
            repartidor_party_id: 101n,
          }),
        }),
      );
    });

    it('un admin puede ver todos y filtrar por repartidor', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([]);
      prismaMock.pedido.findMany.mockResolvedValue([]);

      await service.listarTodos({ repartidor: '102' }, adminAuth);

      expect(prismaMock.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            modalidad: 'DELIVERY',
            repartidor_party_id: 102n,
          }),
        }),
      );
    });
  });

  describe('8b. Vista activa de reparto: solo pedidos vivos salvo historial explícito', () => {
    it('por defecto solo consulta LISTO y EN_CAMINO (sin ANULADO, ENTREGADO ni otras modalidades)', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([]);
      prismaMock.pedido.findMany.mockResolvedValue([]);

      await service.listarTodos({}, adminAuth);

      expect(prismaMock.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            modalidad: 'DELIVERY',
            estado: { in: ['LISTO', 'EN_CAMINO'] },
          }),
        }),
      );
    });

    it('con historial=true no restringe el estado', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([]);
      prismaMock.pedido.findMany.mockResolvedValue([]);

      await service.listarTodos({ historial: 'true' }, adminAuth);

      const args = prismaMock.pedido.findMany.mock.calls.at(-1)[0];
      expect(args.where.estado).toBeUndefined();
    });

    it('un estado explícito prevalece sobre la vista activa', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([]);
      prismaMock.pedido.findMany.mockResolvedValue([]);

      await service.listarTodos({ estado: 'ENTREGADO' }, adminAuth);

      expect(prismaMock.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ estado: 'ENTREGADO' }) }),
      );
    });

    it('el repartidor también recibe solo pedidos activos', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([]);
      prismaMock.pedido.findMany.mockResolvedValue([]);

      await service.listarTodos({}, repartidor1);

      expect(prismaMock.pedido.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ estado: { in: ['LISTO', 'EN_CAMINO'] } }),
        }),
      );
    });
  });

  describe('9. Configuración de Reparto (GET / PUT admin/repartos/config)', () => {
    it('obtiene la configuración actual con valores por defecto', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([]);

      const config = await service.obtenerConfig();

      expect(config.retrasadoMin).toBe(20);
      expect(config.tardeMin).toBe(30);
      expect(config.muyTardeMin).toBe(45);
      expect(config.velocidadKmh).toBe(25);
      expect(config.maxPedidos).toBe(5);
      expect(config.localCoords).toEqual(COORDENADAS_LOCAL_DEFAULT);
    });

    it('actualiza los umbrales respetando orden ascendente y audita cada cambio', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'reparto_retrasado_min', valor: 20 },
        { clave: 'reparto_tarde_min', valor: 30 },
        { clave: 'reparto_muy_tarde_min', valor: 45 },
      ]);
      prismaMock.parametro.findUnique.mockResolvedValue(null);
      prismaMock.parametro.upsert.mockResolvedValue({ clave: 'reparto_retrasado_min', valor: 25 });

      const res = await service.actualizarConfig(
        { retrasadoMin: 25, tardeMin: 35, muyTardeMin: 50 },
        adminAuth,
        '127.0.0.1',
      );

      expect(prismaMock.parametro.upsert).toHaveBeenCalled();
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'configuracion',
          accion: 'PARAMETRO',
        }),
      );
      expect(res).toBeDefined();
    });

    it('rechaza umbrales que no respeten el orden ascendente estricto', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([]);

      try {
        await service.actualizarConfig({ retrasadoMin: 40, tardeMin: 30 }, adminAuth);
        throw new Error('Debería haber fallado');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse().codigo).toBe('ORDEN_UMBRALES_INVALIDO');
      }
    });

    it('rechaza valores fuera de rango razonable', async () => {
      prismaMock.parametro.findMany.mockResolvedValue([]);

      try {
        await service.actualizarConfig({ velocidadKmh: 3 }, adminAuth);
        throw new Error('Debería haber fallado');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse().codigo).toBe('RANGO_INVALIDO');
      }

      try {
        await service.actualizarConfig({ maxPedidos: 0 }, adminAuth);
        throw new Error('Debería haber fallado');
      } catch (err: any) {
        expect(err).toBeInstanceOf(BadRequestException);
        expect(err.getResponse().codigo).toBe('RANGO_INVALIDO');
      }
    });
  });

  describe('10. Zonas de reparto (GET admin/repartos/zonas)', () => {
    it('devuelve las zonas con código, tarifa, polígono y centroide calculado', async () => {
      const zonasDb = [
        {
          id: 1n,
          codigo: 'Z2',
          tarifa: new Prisma.Decimal(2),
          activa: true,
          poligono: [
            [-12.01, -76.97],
            [-12.03, -76.97],
            [-12.03, -76.95],
            [-12.01, -76.95],
          ],
        },
      ];
      prismaMock.zonaReparto.findMany.mockResolvedValue(zonasDb);

      const res = await service.listarZonas();

      expect(res).toHaveLength(1);
      expect(res[0].codigo).toBe('Z2');
      expect(res[0].nombre).toBe('Zona Z2');
      expect(res[0].tarifa).toBe(2);
      expect(res[0].puntos).toBe(4);
      expect(res[0].centro).toEqual([-12.02, -76.96]);
    });
  });

  describe('11. Iniciar ruta atómica e idempotente (POST admin/repartos/iniciar-ruta)', () => {
    it('inicia ruta con éxito asignando y saliendo a EN_CAMINO en un solo paso', async () => {
      const lockedRows = [
        {
          id: 10n,
          codigo: 'CP-010',
          modalidad: 'DELIVERY',
          estado: 'LISTO',
          repartidor_party_id: null,
          anulado_en: null,
          motivo_falla: null,
          entrega_lat: new Prisma.Decimal(-12.02),
          entrega_lng: new Prisma.Decimal(-76.96),
        },
        {
          id: 20n,
          codigo: 'CP-020',
          modalidad: 'DELIVERY',
          estado: 'LISTO',
          repartidor_party_id: null,
          anulado_en: null,
          motivo_falla: null,
          entrega_lat: new Prisma.Decimal(-12.025),
          entrega_lng: new Prisma.Decimal(-76.965),
        },
      ];
      prismaMock.$queryRaw.mockResolvedValue(lockedRows);
      prismaMock.pedido.findMany
        .mockResolvedValueOnce([]) // pedidos activos previos
        .mockResolvedValueOnce([
          {
            ...lockedRows[0],
            total: new Prisma.Decimal(30),
            creado_en: new Date(),
            zona: { codigo: 'Z2' },
          },
          {
            ...lockedRows[1],
            total: new Prisma.Decimal(25),
            creado_en: new Date(),
            zona: { codigo: 'Z2' },
          },
        ]);

      const res = await service.iniciarRuta(
        { pedidoIds: ['10', '20'] },
        repartidor1,
        '127.0.0.1',
      );

      expect(res.tomados).toHaveLength(2);
      expect(res.perdidos).toHaveLength(0);
      expect(res.tomados[0].codigo).toBe('CP-010');
      expect(res.tomados[1].codigo).toBe('CP-020');
      expect(prismaMock.pedido.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 10n },
          data: expect.objectContaining({
            repartidor_party_id: 101n,
            estado: 'EN_CAMINO',
          }),
        }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith(
        'pedido:estado',
        expect.objectContaining({ estado: 'EN_CAMINO' }),
      );
    });

    it('reporta perdidos individualmente (OTRO_REPARTIDOR, LIMITE, ANULADO, NO_DISPONIBLE) sin fallar en bloque', async () => {
      const lockedRows = [
        {
          id: 10n,
          codigo: 'CP-010',
          modalidad: 'DELIVERY',
          estado: 'LISTO',
          repartidor_party_id: 102n, // tomado por Carlos
          anulado_en: null,
          motivo_falla: null,
          entrega_lat: new Prisma.Decimal(-12.02),
          entrega_lng: new Prisma.Decimal(-76.96),
        },
        {
          id: 11n,
          codigo: 'CP-011',
          modalidad: 'DELIVERY',
          estado: 'ANULADO',
          repartidor_party_id: null,
          anulado_en: new Date(),
          motivo_falla: null,
          entrega_lat: new Prisma.Decimal(-12.02),
          entrega_lng: new Prisma.Decimal(-76.96),
        },
        {
          id: 12n,
          codigo: 'CP-012',
          modalidad: 'DELIVERY',
          estado: 'LISTO',
          repartidor_party_id: null,
          anulado_en: null,
          motivo_falla: null,
          entrega_lat: null, // falta ubicar
          entrega_lng: null,
        },
        {
          id: 13n,
          codigo: 'CP-013',
          modalidad: 'DELIVERY',
          estado: 'LISTO',
          repartidor_party_id: null,
          anulado_en: null,
          motivo_falla: null,
          entrega_lat: new Prisma.Decimal(-12.02),
          entrega_lng: new Prisma.Decimal(-76.96),
        },
        {
          id: 14n,
          codigo: 'CP-014',
          modalidad: 'DELIVERY',
          estado: 'LISTO',
          repartidor_party_id: null,
          anulado_en: null,
          motivo_falla: null,
          entrega_lat: new Prisma.Decimal(-12.02),
          entrega_lng: new Prisma.Decimal(-76.96),
        },
      ];

      prismaMock.$queryRaw.mockResolvedValue(lockedRows);
      prismaMock.person.findMany.mockResolvedValue([
        { party_id: 102n, nombres: 'Carlos', apellidos: 'Soto' },
      ]);
      // Repartidor ya lleva 2 pedidos activos (límite 3)
      prismaMock.pedido.findMany
        .mockResolvedValueOnce([{ id: 1010n }, { id: 1011n }])
        .mockResolvedValueOnce([
          {
            ...lockedRows[3], // CP-013 es el único tomado (ocupa el cupo 3)
            total: new Prisma.Decimal(20),
            creado_en: new Date(),
            zona: { codigo: 'Z2' },
          },
        ]);

      const res = await service.iniciarRuta(
        { pedidoIds: ['10', '11', '12', '13', '14'] },
        repartidor1,
      );

      expect(res.tomados).toHaveLength(1);
      expect(res.tomados[0].codigo).toBe('CP-013');

      expect(res.perdidos).toHaveLength(4);
      expect(res.perdidos).toEqual([
        { pedidoId: '10', codigo: 'CP-010', motivo: 'OTRO_REPARTIDOR', tomadoPor: 'Carlos Soto' },
        { pedidoId: '11', codigo: 'CP-011', motivo: 'ANULADO' },
        { pedidoId: '12', codigo: 'CP-012', motivo: 'NO_DISPONIBLE' },
        { pedidoId: '14', codigo: 'CP-014', motivo: 'LIMITE' },
      ]);
    });

    it('es idempotente: reintento de red o doble toque con pedido ya tomado no duplica ni falla', async () => {
      const lockedRows = [
        {
          id: 50n,
          codigo: 'CP-050',
          modalidad: 'DELIVERY',
          estado: 'LISTO',
          repartidor_party_id: 101n, // ya asignado a este mismo repartidor
          anulado_en: null,
          motivo_falla: null,
          entrega_lat: new Prisma.Decimal(-12.02),
          entrega_lng: new Prisma.Decimal(-76.96),
        },
      ];
      prismaMock.$queryRaw.mockResolvedValue(lockedRows);
      prismaMock.pedido.findMany
        .mockResolvedValueOnce([{ id: 50n }])
        .mockResolvedValueOnce([
          {
            ...lockedRows[0],
            estado: 'EN_CAMINO',
            total: new Prisma.Decimal(35),
            creado_en: new Date(),
            zona: { codigo: 'Z2' },
          },
        ]);

      const res = await service.iniciarRuta({ pedidoIds: ['50'] }, repartidor1);

      expect(res.tomados).toHaveLength(1);
      expect(res.perdidos).toHaveLength(0);
      expect(res.tomados[0].codigo).toBe('CP-050');
    });

    it('simula concurrencia atómica con Promise.all sin colisiones', async () => {
      // Repartidor 1 toma primero CP-100, Repartidor 2 intenta el mismo
      const row100Inicial = {
        id: 100n,
        codigo: 'CP-100',
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        repartidor_party_id: null,
        anulado_en: null,
        motivo_falla: null,
        entrega_lat: new Prisma.Decimal(-12.02),
        entrega_lng: new Prisma.Decimal(-76.96),
      };

      // Mock para repartidor 1 (encuentra libre y toma)
      prismaMock.$queryRaw.mockResolvedValueOnce([row100Inicial]);
      prismaMock.pedido.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            ...row100Inicial,
            estado: 'EN_CAMINO',
            repartidor_party_id: 101n,
            total: new Prisma.Decimal(40),
            creado_en: new Date(),
            zona: { codigo: 'Z2' },
          },
        ]);

      const resRider1 = await service.iniciarRuta({ pedidoIds: ['100'] }, repartidor1);
      expect(resRider1.tomados).toHaveLength(1);
      expect(resRider1.perdidos).toHaveLength(0);

      // Mock para repartidor 2 (encuentra ya tomado por rider 1)
      const row100YaTomado = {
        ...row100Inicial,
        repartidor_party_id: 101n,
      };
      prismaMock.$queryRaw.mockResolvedValueOnce([row100YaTomado]);
      prismaMock.person.findMany.mockResolvedValueOnce([
        { party_id: 101n, nombres: 'Juan', apellidos: 'Rider' },
      ]);
      prismaMock.pedido.findMany.mockResolvedValueOnce([]);

      const resRider2 = await service.iniciarRuta({ pedidoIds: ['100'] }, repartidor2);
      expect(resRider2.tomados).toHaveLength(0);
      expect(resRider2.perdidos).toHaveLength(1);
      expect(resRider2.perdidos[0].motivo).toBe('OTRO_REPARTIDOR');
      expect(resRider2.perdidos[0].tomadoPor).toBe('Juan Rider');
    });
  });

  describe('12. Liberar y reasignar por Caja/Admin', () => {
    it('liberarPedido regresa el pedido a LISTO sin repartidor asignado', async () => {
      const pedidoTomado = {
        id: 300n,
        codigo: 'CP-300',
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        repartidor_party_id: 101n,
        tomado_en: new Date(),
        salio_en: null,
        total: new Prisma.Decimal(50),
        creado_en: new Date(),
        zona: { codigo: 'Z2' },
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoTomado);
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoTomado,
        repartidor_party_id: null,
        tomado_en: null,
        salio_en: null,
        estado: 'LISTO',
      });

      const res = await service.liberarPedido(
        '300',
        { motivo: 'Repartidor pinchó llanta' },
        adminAuth,
      );

      expect(res.repartidor_party_id).toBeNull();
      expect(res.estado).toBe('LISTO');
      expect(prismaMock.pedidoEstadoHistorial.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pedido_id: 300n,
            estado_nuevo: 'LISTO',
            motivo: expect.stringContaining('Repartidor pinchó llanta'),
          }),
        }),
      );
      expect(eventosGatewayMock.emitirAdmin).toHaveBeenCalledWith(
        'pedido:estado',
        expect.objectContaining({ id: 300, estado: 'LISTO', repartidor_party_id: null }),
      );
    });

    it('liberarPedido rechaza liberar un pedido que ya fue entregado', async () => {
      prismaMock.pedido.findUnique.mockResolvedValue({
        id: 301n,
        codigo: 'CP-301',
        estado: 'ENTREGADO',
        repartidor_party_id: 101n,
      });

      await expect(
        service.liberarPedido('301', { motivo: 'Error' }, adminAuth),
      ).rejects.toThrow(ConflictException);
    });

    it('reasignarPedido transfiere el pedido a otro repartidor disponible', async () => {
      const pedidoTomado = {
        id: 400n,
        codigo: 'CP-400',
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        repartidor_party_id: 101n,
        total: new Prisma.Decimal(30),
        creado_en: new Date(),
        zona: { codigo: 'Z2' },
      };
      prismaMock.pedido.findUnique.mockResolvedValue(pedidoTomado);
      prismaMock.userAccount.findUnique.mockResolvedValue({
        party_id: 102n,
        rol: 'REPARTIDOR',
        activo: true,
        party: { persona: { nombres: 'Carlos' } },
      });
      prismaMock.pedido.count.mockResolvedValue(1); // tiene 1 pedido activo (límite 3)
      prismaMock.pedido.update.mockResolvedValue({
        ...pedidoTomado,
        repartidor_party_id: 102n,
        tomado_en: new Date(),
      });

      const res = await service.reasignarPedido(
        '400',
        { repartidorPartyId: '102', motivo: 'Cambio de turno' },
        adminAuth,
      );

      expect(res.repartidor_party_id).toBe('102');
      expect(prismaMock.pedidoEstadoHistorial.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pedido_id: 400n,
            motivo: expect.stringContaining('Cambio de turno'),
          }),
        }),
      );
    });

    it('detecta alerta ámbar para caja cuando un pedido tomado no sale tras N minutos', async () => {
      const ahora = new Date();
      const tomadoHace15Min = new Date(ahora.getTime() - 15 * 60 * 1000);

      const pedidoSinSalir = {
        id: 500n,
        codigo: 'CP-500',
        modalidad: 'DELIVERY',
        estado: 'LISTO',
        repartidor_party_id: 101n,
        tomado_en: tomadoHace15Min,
        salio_en: null,
        total: new Prisma.Decimal(25),
        creado_en: new Date(ahora.getTime() - 25 * 60 * 1000),
        zona: { codigo: 'Z2' },
      };

      prismaMock.parametro.findMany.mockResolvedValue([
        { clave: 'reparto_tomado_sin_salir_min', valor: 10 },
      ]);
      prismaMock.pedido.findMany.mockResolvedValue([pedidoSinSalir]);

      const lista = await service.listarTodos({}, adminAuth);
      expect(lista).toHaveLength(1);
      expect(lista[0].alerta_tomado_sin_salir).toBe(true);
      expect(lista[0].minutos_sin_salir).toBeGreaterThanOrEqual(15);
    });
  });
});
