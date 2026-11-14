jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Prisma } from '@prisma/client';
import { RepartosService } from './repartos.service';

const admin: any = { partyId: 1n, rol: 'ADMIN' };
const supervisor: any = { partyId: 3n, rol: 'SUPERVISOR' };
const cajero: any = { partyId: 2n, rol: 'CAJERO' };

function montar(pedido: any) {
  const prisma: any = {
    parametro: { findMany: jest.fn().mockResolvedValue([]) },
    pedido: {
      findUnique: jest.fn().mockResolvedValue(pedido),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({ ...pedido, ...data })),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    party: { findUnique: jest.fn().mockResolvedValue({ persona: { nombres: 'Ana', apellidos: 'Supervisora' } }) },
    pedidoEstadoHistorial: { create: jest.fn() },
    pedidoPagoPlan: { findMany: jest.fn().mockResolvedValue([]) },
    solicitudCambioCobro: { findFirst: jest.fn().mockResolvedValue(null) },
    rutaReparto: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ id: 1n }), update: jest.fn(), delete: jest.fn() },
    cobro: { findFirst: jest.fn().mockResolvedValue(null) },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
    $queryRaw: jest.fn().mockResolvedValue([]),
  };
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  const avisos: any = { avisar: jest.fn(), despertar: jest.fn() };
  const service = new RepartosService(prisma, auditoria, {} as any, { emitirAdmin: jest.fn() } as any, avisos);
  return { prisma, auditoria, service };
}
const pedidoBase = (extra: any = {}) => ({
  id: 20n, codigo: 'CP-W020', modalidad: 'DELIVERY', estado: 'EN_CAMINO', repartidor_party_id: 101n, pago_estado: 'PAGADO', pago_metodo: 'YAPE',
  total: new Prisma.Decimal(40), creado_en: new Date(), zona: null, planPago: [], ...extra,
});

describe('Repartos: ADMIN y SUPERVISOR cierran el reparto por el repartidor', () => {
  it('solo ADMIN y SUPERVISOR (Caja: 403) y con motivo', async () => {
    const { service } = montar(pedidoBase());
    await expect(service.cerrarPorRepartidor('20', { motivo: 'Entregó pero no marcó' }, cajero)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN_SUPERVISOR' } });
    await expect(service.cerrarPorRepartidor('20', { motivo: '' }, supervisor)).rejects.toMatchObject({ response: { codigo: 'MOTIVO_REQUERIDO' } });
  });

  it('EN_CAMINO ya suyo: se entrega con el repartidor como autor y nota «cerrado por» en historial y auditoría', async () => {
    const { service, prisma, auditoria } = montar(pedidoBase());
    const r = await service.cerrarPorRepartidor('20', { motivo: 'Entregó pero no marcó' }, supervisor);
    expect(r.estado).toBe('ENTREGADO');
    expect(prisma.pedidoEstadoHistorial.create.mock.calls[0][0].data).toMatchObject({
      estado_nuevo: 'ENTREGADO', por_party_id: 101n, motivo: 'Entregado (cerrado por Ana Supervisora)',
    });
    // El reparto y su pago siguen siendo del repartidor (no se toca repartidor_party_id)
    expect(prisma.pedido.update.mock.calls[0][0].data.repartidor_party_id).toBeUndefined();
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({
      accion: 'ENTREGAR', partyId: 3n, motivo: 'cerrado por Ana Supervisora', despues: { repartidor: '101', cerradoPor: 'Ana Supervisora' },
    }));
  });

  it('LISTO con otro repartidor: reasigna al elegido, sale y entrega, todo a nombre del repartidor', async () => {
    const { service, prisma } = montar(pedidoBase({ estado: 'LISTO', repartidor_party_id: null }));
    const reasignar = jest.spyOn(service, 'reasignarPedido').mockResolvedValue({} as any);
    const salir = jest.spyOn(service, 'salir').mockResolvedValue({} as any);
    const entregar = jest.spyOn(service, 'entregar').mockResolvedValue({ estado: 'ENTREGADO' } as any);
    await service.cerrarPorRepartidor('20', { repartidorPartyId: '102', motivo: 'Entregó pero no marcó' }, admin);
    expect(reasignar).toHaveBeenCalledWith(20n, expect.objectContaining({ repartidorPartyId: '102' }), admin, undefined);
    expect(salir).toHaveBeenCalledWith(20n, admin, undefined, expect.anything(), { partyId: 102n, cerradoPor: 'Ana Supervisora' });
    expect(entregar).toHaveBeenCalledWith(20n, admin, undefined, expect.anything(), { partyId: 102n, cerradoPor: 'Ana Supervisora' });
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('pedido anulado, entregado o que no es delivery: 409', async () => {
    for (const extra of [{ estado: 'ANULADO' }, { estado: 'ENTREGADO' }, { modalidad: 'RECOGER' }]) {
      const { service } = montar(pedidoBase(extra));
      await expect(service.cerrarPorRepartidor('20', { motivo: 'Entregó pero no marcó' }, admin)).rejects.toMatchObject({ response: { codigo: 'ESTADO_INVALIDO' } });
    }
  });

  it('sin repartidor elegido ni asignado: 400', async () => {
    const { service } = montar(pedidoBase({ repartidor_party_id: null }));
    await expect(service.cerrarPorRepartidor('20', { motivo: 'Entregó pero no marcó' }, admin)).rejects.toMatchObject({ response: { codigo: 'REPARTIDOR_REQUERIDO' } });
  });
});

describe('Repartos: resolver «DEVUELTO» de un pedido pagado no anula', () => {
  it('409 PEDIDO_PAGADO y el pedido queda igual', async () => {
    const { service, prisma } = montar(pedidoBase({ estado: 'LISTO', repartidor_party_id: null }));
    prisma.incidenteEntrega = { findFirst: jest.fn(), update: jest.fn() };
    prisma.cobro.findMany = jest.fn().mockResolvedValue([{ credito_personal: false }]);
    await expect(service.resolverFalla('20', { nota: 'Devuelto al local', cierre: 'DEVUELTO' }, admin)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_PAGADO' } });
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });
});
