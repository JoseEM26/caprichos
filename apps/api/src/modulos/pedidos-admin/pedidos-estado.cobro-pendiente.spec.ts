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
const cajero: any = { partyId: 2n, rol: 'CAJERO', debeCambiar: false };

describe('Cobro antes de entregar: EN_CAMINO y ENTREGADO exigen pedido cobrado', () => {
  let service: PedidosEstadoService;
  let prisma: any;
  let auditoria: any;
  let comandas: any;
  let pedido: any;

  beforeEach(async () => {
    pedido = {
      id: 10n, codigo: 'CP-T001', modalidad: 'LLEVAR', estado: 'LISTO', pago_estado: 'PENDIENTE', pago_metodo: null,
      total: 30, repartidor_party_id: null, pasa_cocina_en: null,
    };
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
      pedido: { findUnique: jest.fn(async () => pedido), update: jest.fn(async ({ data }: any) => ({ ...pedido, ...data })) },
      pedidoEstadoHistorial: { create: jest.fn() },
      comandaArea: { findMany: jest.fn().mockResolvedValue([]) },
      pedidoPagoPlan: { findMany: jest.fn().mockResolvedValue([]) },
      rolPermiso: { findFirst: jest.fn() },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    comandas = { despejar: jest.fn().mockResolvedValue({ ok: true }) };
    const m = await Test.createTestingModule({
      providers: [
        PedidosEstadoService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { obtenerCliente: () => ({}) } },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: EventosGateway, useValue: { emitirAdmin: jest.fn() } },
        { provide: SalonService, useValue: { avisarListo: jest.fn() } },
        { provide: ComandasService, useValue: comandas },
      ],
    }).compile();
    service = m.get(PedidosEstadoService);
  });

  it.each([
    ['LLEVAR', 'LISTO', 'ENTREGADO'],
    ['RECOGER', 'LISTO', 'ENTREGADO'],
    ['DELIVERY', 'LISTO', 'EN_CAMINO'],
    ['DELIVERY', 'EN_CAMINO', 'ENTREGADO'],
  ])('%s %s -> %s sin cobrar (Yape): 409 COBRO_PENDIENTE y no cambia nada', async (modalidad, desde, hacia) => {
    Object.assign(pedido, { modalidad, estado: desde, pago_metodo: 'YAPE', zona_id: 1n, entrega_lat: -12, entrega_lng: -77, repartidor_party_id: 9n });
    const err: any = await service.cambiarEstado(10n, { estado: hacia }, cajero).catch((e) => e);
    expect(err.getStatus()).toBe(409);
    expect(err.getResponse()).toMatchObject({ codigo: 'COBRO_PENDIENTE', puedeForzar: false });
    expect(prisma.pedido.update).not.toHaveBeenCalled();
    expect(comandas.despejar).not.toHaveBeenCalled();
  });

  it('con el pedido PAGADO entrega normal', async () => {
    pedido.pago_estado = 'PAGADO';
    expect((await service.cambiarEstado(10n, { estado: 'ENTREGADO' }, cajero)).estado).toBe('ENTREGADO');
  });

  it('MESA sin cobrar entrega (se cobra al final)', async () => {
    pedido.modalidad = 'MESA';
    expect((await service.cambiarEstado(10n, { estado: 'ENTREGADO' }, cajero)).estado).toBe('ENTREGADO');
  });

  it('delivery en efectivo contra entrega sale sin cobrar', async () => {
    Object.assign(pedido, { modalidad: 'DELIVERY', pago_metodo: 'EFECTIVO', zona_id: 1n, entrega_lat: -12, entrega_lng: -77, repartidor_party_id: 9n });
    expect((await service.cambiarEstado(10n, { estado: 'EN_CAMINO' }, cajero)).estado).toBe('EN_CAMINO');
  });

  it('LISTO (cocina) no se revisa: solo la salida y la entrega', async () => {
    pedido.estado = 'PREPARANDO';
    expect((await service.cambiarEstado(10n, { estado: 'LISTO' }, cajero)).estado).toBe('LISTO');
  });

  it('el mensaje al administrador añade la opción de entregar sin cobrar', async () => {
    const err: any = await service.cambiarEstado(10n, { estado: 'ENTREGADO' }, admin).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ codigo: 'COBRO_PENDIENTE', puedeForzar: true });
    expect(err.getResponse().mensaje).toContain('sin cobrar');
  });

  describe('forzar como administrador', () => {
    it('con motivo: entrega, audita PEDIDO_FORZAR_SIN_COBRO y el pedido sigue sin cobrar', async () => {
      const r = await service.cambiarEstado(10n, { estado: 'ENTREGADO', forzarSinCobro: true, motivo: 'El cliente pagará mañana' }, admin, '1.2.3.4');
      expect(r.estado).toBe('ENTREGADO');
      expect(prisma.pedido.update.mock.calls[0][0].data.pago_estado).toBeUndefined();
      const a = auditoria.registrar.mock.calls.map((c: any[]) => c[0]).find((x: any) => x.accion === 'PEDIDO_FORZAR_SIN_COBRO');
      expect(a).toMatchObject({ entidadId: 10n, partyId: 1n, motivo: 'El cliente pagará mañana', despues: { estado: 'ENTREGADO', pagoEstado: 'PENDIENTE' } });
    });

    it('sin motivo o corto: 400; el `forzar` de Cocina no sirve para el cobro', async () => {
      for (const dto of [{ estado: 'ENTREGADO', forzarSinCobro: true }, { estado: 'ENTREGADO', forzarSinCobro: true, motivo: 'corto' }]) {
        const err: any = await service.cambiarEstado(10n, dto, admin).catch((e) => e);
        expect(err.getResponse().codigo).toBe('MOTIVO_REQUERIDO');
      }
      const err: any = await service.cambiarEstado(10n, { estado: 'ENTREGADO', forzar: true, motivo: 'Cocina sin pantalla ok' }, admin).catch((e) => e);
      expect(err.getResponse().codigo).toBe('COBRO_PENDIENTE');
      expect(prisma.pedido.update).not.toHaveBeenCalled();
    });

    it('un no-administrador que fuerza: 403', async () => {
      const err: any = await service.cambiarEstado(10n, { estado: 'ENTREGADO', forzarSinCobro: true, motivo: 'Motivo bien largo' }, cajero).catch((e) => e);
      expect(err.getStatus()).toBe(403);
      expect(err.getResponse().codigo).toBe('FORZAR_SOLO_ADMIN');
    });
  });
});
