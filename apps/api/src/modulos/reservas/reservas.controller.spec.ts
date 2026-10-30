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
import { ReservasController } from './reservas.controller';
import { ReservasService } from './reservas.service';
import { AccesoGuard } from '../acceso/acceso.guard';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { ConfigService } from '@nestjs/config';

describe('ReservasController', () => {
  let controller: ReservasController;
  let service: any;

  beforeEach(async () => {
    service = {
      crear: jest.fn(),
      listar: jest.fn(),
      calendario: jest.fn(),
      agenda: jest.fn(),
      reservasMesaHoy: jest.fn(),
      actualizar: jest.fn(),
      cancelar: jest.fn(),
      sentar: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReservasController],
      providers: [
        { provide: ReservasService, useValue: service },
        { provide: PrismaService, useValue: {} },
        { provide: AuditoriaService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => 'test-secret' } },
      ],
    })
      .overrideGuard(AccesoGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReservasController>(ReservasController);
  });

  it('POST /admin/reservas delega a service.crear', async () => {
    const dto = {
      nombre: 'Lucia',
      telefono: '999111333',
      personas: 3,
      hora: '2026-10-25T19:00:00-05:00',
      mesas: [2],
    };
    const reqMock: any = { usuario: { partyId: 5n, rol: 'MOZO' }, ip: '192.168.1.1' };

    service.crear.mockResolvedValue({ id: '1', ...dto });

    const res = await controller.crear(dto, reqMock);

    expect(service.crear).toHaveBeenCalledWith(dto, reqMock.usuario, '192.168.1.1');
    expect(res.id).toBe('1');
  });

  it('GET /admin/reservas delega a service.listar', async () => {
    service.listar.mockResolvedValue([{ id: '1', estado: 'ACTIVA' }]);

    const res = await controller.listar('2026-10-01', '2026-10-31', 'ACTIVA');

    expect(service.listar).toHaveBeenCalledWith({
      desde: '2026-10-01',
      hasta: '2026-10-31',
      estado: 'ACTIVA',
    });
    expect(res).toHaveLength(1);
  });

  it('GET /admin/reservas/calendario delega a service.calendario', async () => {
    service.calendario.mockResolvedValue([{ fecha: '2026-10-05', cantidad: 2 }]);

    const res = await controller.calendario('2026-10');

    expect(service.calendario).toHaveBeenCalledWith('2026-10');
    expect(res).toEqual([{ fecha: '2026-10-05', cantidad: 2 }]);
  });

  it('GET /admin/reservas/agenda delega a service.agenda', async () => {
    service.agenda.mockResolvedValue([{ id: '10', hora: '19:00' }]);

    const res = await controller.agenda('2026-10-12');

    expect(service.agenda).toHaveBeenCalledWith('2026-10-12');
    expect(res).toHaveLength(1);
  });

  it('GET /admin/reservas/mesa/:mesaId/hoy delega a service.reservasMesaHoy', async () => {
    service.reservasMesaHoy.mockResolvedValue([{ id: '20', mesa_id: '4' }]);

    const res = await controller.reservasMesaHoy('4');

    expect(service.reservasMesaHoy).toHaveBeenCalledWith('4');
    expect(res).toHaveLength(1);
  });

  it('PATCH /admin/reservas/:id delega a service.actualizar', async () => {
    const dto = { personas: 4 };
    const reqMock: any = { usuario: { partyId: 1n, rol: 'ADMIN' }, ip: '127.0.0.1' };
    service.actualizar.mockResolvedValue({ id: '9', personas: 4 });

    const res = await controller.actualizar('9', dto, reqMock);

    expect(service.actualizar).toHaveBeenCalledWith('9', dto, reqMock.usuario, '127.0.0.1');
    expect(res.personas).toBe(4);
  });

  it('POST /admin/reservas/:id/cancelar delega a service.cancelar', async () => {
    const dto = { motivo: 'Cliente no viene' };
    const reqMock: any = { usuario: { partyId: 1n, rol: 'ADMIN' }, ip: '127.0.0.1' };
    service.cancelar.mockResolvedValue({ id: '9', estado: 'CANCELADA' });

    const res = await controller.cancelar('9', dto, reqMock);

    expect(service.cancelar).toHaveBeenCalledWith('9', dto, reqMock.usuario, '127.0.0.1');
    expect(res.estado).toBe('CANCELADA');
  });

  it('POST /admin/reservas/:id/sentar delega a service.sentar', async () => {
    const reqMock: any = { usuario: { partyId: 2n, rol: 'MOZO' }, ip: '10.0.0.1' };
    service.sentar.mockResolvedValue({ mesas: ['1', '2'], personas: 6, nombre: 'Ana' });

    const res = await controller.sentar('9', reqMock);

    expect(service.sentar).toHaveBeenCalledWith('9', reqMock.usuario, '10.0.0.1');
    expect(res).toEqual({ mesas: ['1', '2'], personas: 6, nombre: 'Ana' });
  });
});
