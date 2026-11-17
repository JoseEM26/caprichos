// El gateway importa @nestjs/jwt (ESM): en las pruebas basta con un doble
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { Test } from '@nestjs/testing';
import { PedidosEstadoService } from './pedidos-estado.service';
import { SalonService } from '../salon/salon.service';
import { PrismaService } from '../../comun/prisma/prisma.service';
import { RedisService } from '../../comun/redis/redis.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { EventosGateway } from '../../comun/socket/eventos.gateway';
import { ComandasService } from '../cocina/comandas.service';

const admin: any = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };

// Pedido de «Tarjeta / Yape en línea» que espera el pago del cliente (datos sintéticos)
describe('Pago en línea sin pagar: no pasa a cocina ni se cobra a mano (D)', () => {
  let service: PedidosEstadoService;
  let prisma: any;
  let pedido: any;

  beforeEach(async () => {
    pedido = {
      id: 10n, codigo: 'CP-T002', canal: 'CARTA', modalidad: 'RECOGER', estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE',
      pago_metodo: null, pago_preferido: 'CULQI', total: 30, propina: 0, repartidor_party_id: null, pasa_cocina_en: null,
    };
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      pedido: { findUnique: jest.fn(async () => pedido), update: jest.fn(async ({ data }: any) => ({ ...pedido, ...data })) },
      pedidoEstadoHistorial: { create: jest.fn() },
      comandaArea: { findMany: jest.fn().mockResolvedValue([]) },
      pedidoPagoPlan: { findMany: jest.fn().mockResolvedValue([]) },
      rolPermiso: { findFirst: jest.fn() },
    };
    const m = await Test.createTestingModule({
      providers: [
        PedidosEstadoService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { obtenerCliente: () => ({}) } },
        { provide: AuditoriaService, useValue: { registrar: jest.fn().mockResolvedValue(undefined) } },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
        { provide: SalonService, useValue: { avisarListo: jest.fn() } },
        { provide: ComandasService, useValue: { despejar: jest.fn().mockResolvedValue({ ok: true }) } },
      ],
    }).compile();
    service = m.get(PedidosEstadoService);
  });

  it.each(['COLA', 'PREPARANDO', 'LISTO', 'ENTREGADO'])('ADMIN no pasa POR_PAGAR a %s: 400 PAGO_ONLINE_PENDIENTE y no cambia nada', async (hacia) => {
    const err: any = await service.cambiarEstado(10n, { estado: hacia } as any, admin).catch((e) => e);
    expect(err.getStatus()).toBe(400);
    expect(err.getResponse()).toMatchObject({ codigo: 'PAGO_ONLINE_PENDIENTE', mensaje: 'Este pedido espera el pago en línea del cliente. Pasa a cocina solo cuando pague.' });
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('ANULADO sí se permite desde POR_PAGAR (no lo frena la regla)', async () => {
    const err: any = await service.cambiarEstado(10n, { estado: 'ANULADO', motivo: 'Sin pago en línea en 15 minutos' } as any, admin).catch((e) => e);
    expect(err?.getResponse?.()?.codigo).not.toBe('PAGO_ONLINE_PENDIENTE');
  });

  it('registrarPago (Caja) sobre el pedido en línea sin pagar: 400 PAGO_ONLINE_PENDIENTE, con cualquier medio', async () => {
    for (const metodo of ['CULQI', 'EFECTIVO', 'YAPE']) {
      const err: any = await service.registrarPago(10n, { metodo, estado: 'PAGADO' } as any, admin).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'PAGO_ONLINE_PENDIENTE' });
    }
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('tras cambiar de medio (COLA, pago PENDIENTE) el pedido sí puede pasar a preparación', async () => {
    Object.assign(pedido, { estado: 'COLA', pago_estado: 'PENDIENTE', pago_preferido: 'YAPE' });
    const r = await service.cambiarEstado(10n, { estado: 'PREPARANDO' } as any, admin);
    expect(r.estado).toBe('PREPARANDO');
  });
});
