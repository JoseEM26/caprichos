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
import { RepartosController } from './repartos.controller';
import { RepartosService } from './repartos.service';
import { RepartosChatService } from './repartos-chat.service';
import { UbicacionRepartidorService } from './ubicacion-repartidor.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ConfigService } from '@nestjs/config';

describe('RepartosController', () => {
  let controller: RepartosController;
  let serviceMock: any;

  const repartidorAuth = {
    partyId: 100n,
    rol: 'REPARTIDOR',
    debeCambiar: false,
  };

  const adminAuth = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    serviceMock = {
      listarDisponibles: jest.fn(),
      listarMios: jest.fn(),
      listarTodos: jest.fn(),
      obtenerResumen: jest.fn(),
      consultarMensajes: jest.fn(),
      tomarPedido: jest.fn(),
      iniciarRuta: jest.fn(),
      liberarPedido: jest.fn(),
      reasignarPedido: jest.fn(),
      salir: jest.fn(),
      llegue: jest.fn(),
      entregar: jest.fn(),
      reportarFalla: jest.fn(),
      resolverFalla: jest.fn(),
      obtenerConfig: jest.fn(),
      actualizarConfig: jest.fn(),
      listarZonas: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RepartosController],
      providers: [
        { provide: RepartosService, useValue: serviceMock },
        { provide: RepartosChatService, useValue: {} },
        { provide: UbicacionRepartidorService, useValue: {} },
        { provide: PrismaService, useValue: {} },
        { provide: AuditoriaService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => 'secreto' } },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RepartosController>(RepartosController);
  });

  it('GET /admin/repartos/disponibles delega a service.listarDisponibles', async () => {
    serviceMock.listarDisponibles.mockResolvedValue([{ id: '1' }]);
    const reqMock: any = { usuario: adminAuth };
    const res = await controller.listarDisponibles(reqMock);
    expect(serviceMock.listarDisponibles).toHaveBeenCalledWith(adminAuth);
    expect(res).toEqual([{ id: '1' }]);
  });

  it('GET /admin/repartos/mios delega a service.listarMios con usuario autenticado', async () => {
    serviceMock.listarMios.mockResolvedValue({ pedidos: [], orden: [], paso: [], ruta: [] });
    const reqMock: any = { usuario: repartidorAuth };
    const res = await controller.listarMios(reqMock);
    expect(serviceMock.listarMios).toHaveBeenCalledWith(repartidorAuth);
    expect(res.orden).toBeDefined();
  });

  it('GET /admin/repartos/resumen delega a service.obtenerResumen', async () => {
    serviceMock.obtenerResumen.mockResolvedValue({
      lados: { Norte: 1, Sur: 0, Este: 0, Oeste: 0 },
      zonas: {},
      total: 1,
    });
    const reqMock: any = { usuario: adminAuth };
    const res = await controller.obtenerResumen(reqMock);
    expect(serviceMock.obtenerResumen).toHaveBeenCalledWith(adminAuth);
    expect(res.lados.Norte).toBe(1);
  });

  it('GET /admin/repartos/:id/mensajes delega a service.consultarMensajes', async () => {
    serviceMock.consultarMensajes.mockResolvedValue([{ numero: 1 }]);
    const reqMock: any = { usuario: repartidorAuth };
    const res = await controller.consultarMensajes('5', reqMock);
    expect(serviceMock.consultarMensajes).toHaveBeenCalledWith('5', repartidorAuth);
    expect(res).toHaveLength(1);
  });

  it('GET /admin/repartos delega a service.listarTodos', async () => {
    serviceMock.listarTodos.mockResolvedValue([]);
    const reqMock: any = { usuario: adminAuth };
    const res = await controller.listarTodos({ repartidor: '100' }, reqMock);
    expect(serviceMock.listarTodos).toHaveBeenCalledWith({ repartidor: '100' }, adminAuth);
    expect(res).toEqual([]);
  });

  it('POST /admin/repartos/:id/tomar delega a service.tomarPedido', async () => {
    serviceMock.tomarPedido.mockResolvedValue({ id: '10', estado: 'LISTO' });
    const reqMock: any = { usuario: repartidorAuth, ip: '127.0.0.1' };
    const res = await controller.tomarPedido('10', reqMock);
    expect(serviceMock.tomarPedido).toHaveBeenCalledWith('10', repartidorAuth, '127.0.0.1');
    expect(res.id).toBe('10');
  });

  it('POST /admin/repartos/:id/salir delega a service.salir', async () => {
    serviceMock.salir.mockResolvedValue({ id: '10', estado: 'EN_CAMINO' });
    const reqMock: any = { usuario: repartidorAuth, ip: '127.0.0.1' };
    const res = await controller.salir('10', reqMock);
    expect(serviceMock.salir).toHaveBeenCalledWith('10', repartidorAuth, '127.0.0.1');
    expect(res.estado).toBe('EN_CAMINO');
  });

  it('POST /admin/repartos/:id/llegue delega a service.llegue', async () => {
    serviceMock.llegue.mockResolvedValue({ id: '10', llego_en: new Date() });
    const reqMock: any = { usuario: repartidorAuth, ip: '127.0.0.1' };
    const res = await controller.llegue('10', reqMock);
    expect(serviceMock.llegue).toHaveBeenCalledWith('10', repartidorAuth, '127.0.0.1');
    expect(res.llego_en).toBeDefined();
  });

  it('POST /admin/repartos/:id/entregar delega a service.entregar', async () => {
    serviceMock.entregar.mockResolvedValue({ id: '10', estado: 'ENTREGADO' });
    const reqMock: any = { usuario: repartidorAuth, ip: '127.0.0.1' };
    const res = await controller.entregar('10', reqMock);
    expect(serviceMock.entregar).toHaveBeenCalledWith('10', repartidorAuth, '127.0.0.1');
    expect(res.estado).toBe('ENTREGADO');
  });

  it('POST /admin/repartos/:id/reportar delega a service.reportarFalla', async () => {
    serviceMock.reportarFalla.mockResolvedValue({ ok: true, intento: 1 });
    const reqMock: any = { usuario: repartidorAuth, ip: '127.0.0.1' };
    const dto = { motivo: 'NO_CONTESTA' as const, contactos: [{ tipo: 'LLAMADA' as const }, { tipo: 'LLAMADA' as const }] };
    const res = await controller.reportarFalla('10', dto, reqMock);
    expect(serviceMock.reportarFalla).toHaveBeenCalledWith('10', dto, repartidorAuth, '127.0.0.1');
    expect(res.ok).toBe(true);
  });

  it('POST /admin/repartos/:id/resolver delega a service.resolverFalla', async () => {
    serviceMock.resolverFalla.mockResolvedValue({ ok: true });
    const reqMock: any = { usuario: adminAuth, ip: '127.0.0.1' };
    const dto = { nota: 'Resuelto con éxito' };
    const res = await controller.resolverFalla('10', dto, reqMock);
    expect(serviceMock.resolverFalla).toHaveBeenCalledWith('10', dto, adminAuth, '127.0.0.1');
    expect(res.ok).toBe(true);
  });

  it('GET /admin/repartos/config delega a service.obtenerConfig', async () => {
    const configMock = {
      retrasadoMin: 20,
      tardeMin: 30,
      muyTardeMin: 45,
      velocidadKmh: 25,
      maxPedidos: 3,
      localCoords: { lat: -12.0147, lng: -76.966 },
    };
    serviceMock.obtenerConfig.mockResolvedValue(configMock);
    const res = await controller.obtenerConfig();
    expect(serviceMock.obtenerConfig).toHaveBeenCalled();
    expect(res).toEqual(configMock);
  });

  it('PUT /admin/repartos/config delega a service.actualizarConfig con dto y usuario', async () => {
    const dto = { retrasadoMin: 22, tardeMin: 32, muyTardeMin: 48 };
    serviceMock.actualizarConfig.mockResolvedValue({ ...dto, velocidadKmh: 25, maxPedidos: 3 });
    const reqMock: any = { usuario: adminAuth, ip: '127.0.0.1' };
    const res = await controller.actualizarConfig(dto, reqMock);
    expect(serviceMock.actualizarConfig).toHaveBeenCalledWith(dto, adminAuth, '127.0.0.1');
    expect(res.retrasadoMin).toBe(22);
  });

  it('GET /admin/repartos/zonas delega a service.listarZonas', async () => {
    const zonasMock = [{ id: '1', codigo: 'Z2', nombre: 'Zona Z2', tarifa: 2, activa: true, puntos: 4 }];
    serviceMock.listarZonas.mockResolvedValue(zonasMock);
    const res = await controller.listarZonas();
    expect(serviceMock.listarZonas).toHaveBeenCalled();
    expect(res).toEqual(zonasMock);
  });

  it('POST /admin/repartos/iniciar-ruta delega a service.iniciarRuta', async () => {
    serviceMock.iniciarRuta.mockResolvedValue({ tomados: [{ id: '1' }], perdidos: [] });
    const reqMock: any = { usuario: repartidorAuth, ip: '127.0.0.1' };
    const dto = { pedidoIds: ['1'] };
    const res = await controller.iniciarRuta(dto, reqMock);
    expect(serviceMock.iniciarRuta).toHaveBeenCalledWith(dto, repartidorAuth, '127.0.0.1');
    expect(res.tomados).toHaveLength(1);
  });

  it('POST /admin/repartos/:id/liberar delega a service.liberarPedido', async () => {
    serviceMock.liberarPedido.mockResolvedValue({ id: '10', estado: 'LISTO' });
    const reqMock: any = { usuario: adminAuth, ip: '127.0.0.1' };
    const dto = { motivo: 'Problema con moto' };
    const res = await controller.liberarPedido('10', dto, reqMock);
    expect(serviceMock.liberarPedido).toHaveBeenCalledWith('10', dto, adminAuth, '127.0.0.1');
    expect(res.estado).toBe('LISTO');
  });

  it('POST /admin/repartos/:id/reasignar delega a service.reasignarPedido', async () => {
    serviceMock.reasignarPedido.mockResolvedValue({ id: '10', repartidor_party_id: '102' });
    const reqMock: any = { usuario: adminAuth, ip: '127.0.0.1' };
    const dto = { repartidorPartyId: '102', motivo: 'Cambio de turno' };
    const res = await controller.reasignarPedido('10', dto, reqMock);
    expect(serviceMock.reasignarPedido).toHaveBeenCalledWith('10', dto, adminAuth, '127.0.0.1');
    expect(res.repartidor_party_id).toBe('102');
  });
});
