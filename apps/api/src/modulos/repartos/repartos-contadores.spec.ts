jest.mock('@nestjs/jwt', () => ({
  JwtService: jest.fn().mockImplementation(() => ({ signAsync: jest.fn(), verifyAsync: jest.fn() })),
  JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class MockJwtModule {} }) },
}));

import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';

describe('Contadores del delivery (GET /admin/repartos/contadores)', () => {
  let service: RepartosService;
  const prisma: any = { pedido: { findMany: jest.fn(), count: jest.fn() }, parametro: { findMany: jest.fn().mockResolvedValue([]) } };

  beforeEach(async () => {
    jest.clearAllMocks();
    const mod = await Test.createTestingModule({
      providers: [
        RepartosService,
        RutaService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
      ],
    }).compile();
    service = mod.get(RepartosService);
  });

  it('cuenta por etapa y suma los pendientes', async () => {
    prisma.pedido.findMany.mockResolvedValue([
      { estado: 'COLA', repartidor_party_id: null },
      { estado: 'PREPARANDO', repartidor_party_id: null },
      { estado: 'LISTO', repartidor_party_id: null },
      { estado: 'LISTO', repartidor_party_id: 5n },
      { estado: 'EN_CAMINO', repartidor_party_id: 5n },
    ]);
    prisma.pedido.count.mockResolvedValue(7);
    const r = await service.contadoresDelivery({ partyId: 1n, rol: 'CAJERO', debeCambiar: false });
    expect(r).toEqual({ enCocina: 2, listos: 1, enCamino: 2, pendientes: 5, entregadosHoy: 7 });
  });

  it('solo mira DELIVERY vivos sin falla (excluye anulados, otros canales y entregados) y entregados de hoy', async () => {
    prisma.pedido.findMany.mockResolvedValue([]);
    prisma.pedido.count.mockResolvedValue(0);
    await service.contadoresDelivery({ partyId: 1n, rol: 'ADMIN', debeCambiar: false });
    const donde = prisma.pedido.findMany.mock.calls[0][0].where;
    expect(donde.modalidad).toBe('DELIVERY');
    expect(donde.estado.in).toEqual(['COLA', 'PREPARANDO', 'LISTO', 'EN_CAMINO']);
    expect(donde.motivo_falla).toBeNull();
    const cuenta = prisma.pedido.count.mock.calls[0][0].where;
    expect(cuenta).toMatchObject({ modalidad: 'DELIVERY', estado: 'ENTREGADO' });
    expect(cuenta.entregado_en.gte).toBeInstanceOf(Date);
  });

  it('D: los vivos del tablero son solo de hoy (un LISTO de ayer no cuenta)', async () => {
    prisma.pedido.findMany.mockResolvedValue([]);
    prisma.pedido.count.mockResolvedValue(0);
    await service.contadoresDelivery({ partyId: 1n, rol: 'ADMIN', debeCambiar: false });
    expect(prisma.pedido.findMany.mock.calls[0][0].where.creado_en.gte).toBeInstanceOf(Date);
  });

  it('el repartidor no los ve', async () => {
    await expect(service.contadoresDelivery({ partyId: 9n, rol: 'REPARTIDOR', debeCambiar: false })).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.pedido.findMany).not.toHaveBeenCalled();
  });
});
