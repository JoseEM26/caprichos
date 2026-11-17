jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
jest.mock('../comprobantes/comprobantes.service', () => ({ ComprobantesService: class {} }));
// Cobro de Caja sobre un pedido de «Tarjeta / Yape en línea» sin pagar (D, b). Datos sintéticos.
import { CobrosService } from './cobros.service';

describe('Cobro de Caja sobre pedido que espera pago en línea (D, b)', () => {
  const cajero: any = { id: 2n, partyId: 2n, rol: 'CAJERO', debeCambiar: false };
  let pedido: any;
  let tx: any;
  let prisma: any;
  let servicio: CobrosService;

  beforeEach(() => {
    pedido = { id: 10n, codigo: 'CP-T003', canal: 'CARTA', modalidad: 'RECOGER', estado: 'POR_PAGAR', pago_estado: 'PENDIENTE_ONLINE', total: 30, propina: 0, cobros: [], planPago: [] };
    tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      caja: { findUnique: jest.fn().mockResolvedValue({ id: 1n, estado: 'ABIERTA' }) },
      pedido: { findUnique: jest.fn(async () => pedido), update: jest.fn() },
      cobro: { create: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn(async (fn: any) => fn(tx)),
      parametro: { findUnique: jest.fn().mockResolvedValue(null) },
      caja: { findUnique: jest.fn().mockResolvedValue({ id: 1n, fecha: new Date(), estado: 'ABIERTA' }) },
    };
    servicio = new CobrosService(prisma, { obtenerCliente: () => ({}) } as any, { registrar: jest.fn() } as any);
  });

  it('un cobro a mano (efectivo, Yape o cualquiera) se rechaza con PAGO_ONLINE_PENDIENTE y no escribe', async () => {
    for (const medio of ['EFECTIVO', 'YAPE', 'TARJETA']) {
      const err: any = await servicio.cobrar({ pedidoId: '10', pagos: [{ medio, monto: 30 }] } as any, cajero).catch((e) => e);
      expect(err.getResponse()).toMatchObject({ codigo: 'PAGO_ONLINE_PENDIENTE' });
    }
    expect(tx.cobro.create).not.toHaveBeenCalled();
    expect(tx.pedido.update).not.toHaveBeenCalled();
  });

  it('el cobro que registra la pasarela al aprobarse (origen CULQI) sigue pasando la guarda', async () => {
    const err: any = await servicio.cobrar({ pedidoId: '10', pagos: [{ medio: 'YAPE', monto: 30 }], origen: 'CULQI' } as any, cajero).catch((e) => e);
    // La guarda no lo frena: el error, si lo hay, no es el de pago en línea (el resto del cobro no se simula aquí)
    expect(err?.getResponse?.()?.codigo).not.toBe('PAGO_ONLINE_PENDIENTE');
  });
});
