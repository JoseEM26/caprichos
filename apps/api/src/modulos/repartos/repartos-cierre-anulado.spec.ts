jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';
import { cerrarRutaTrasAnular, sincronizarRuta } from './rutas-reparto';
import { pedidosRepartoDelDia } from '../caja/caja.calculo';

const rep = { partyId: 10n, rol: 'REPARTIDOR', debeCambiar: false } as any;
const admin = { partyId: 1n, rol: 'ADMIN', debeCambiar: false } as any;
const ped = (id: bigint, estado: string) => ({ id, codigo: `CP-W${id}`, estado, ruta_reparto_id: 7n as bigint | null, repartidor_party_id: 10n as bigint | null });

/** Base en memoria mínima: una ruta EN_CURSO (id 7) del repartidor 10 y sus pedidos. */
function fake(pedidos: any[]) {
  const ruta = { id: 7n, estado: 'EN_CURSO' as string, repartidor_party_id: 10n };
  const coincide = (p: any, w: any) =>
    (w.ruta_reparto_id === undefined || p.ruta_reparto_id === w.ruta_reparto_id) &&
    (w.repartidor_party_id === undefined || p.repartidor_party_id === w.repartidor_party_id) &&
    (w.estado === undefined || (w.estado.in ? w.estado.in.includes(p.estado) : p.estado === w.estado)) &&
    (w.id === undefined || (w.id.in ? w.id.in.includes(p.id) : p.id === w.id));
  const db: any = {
    rutaReparto: {
      findFirst: jest.fn(async () => (ruta.estado === 'EN_CURSO' ? ruta : null)),
      update: jest.fn(async ({ data }: any) => Object.assign(ruta, data)),
      delete: jest.fn(),
    },
    pedido: {
      count: jest.fn(async ({ where }: any) => pedidos.filter((p) => coincide(p, where)).length),
      findMany: jest.fn(async ({ where }: any) => pedidos.filter((p) => coincide(p, where))),
      updateMany: jest.fn(async ({ where, data }: any) => pedidos.filter((p) => coincide(p, where)).forEach((p) => Object.assign(p, data))),
    },
    mensajeReparto: { deleteMany: jest.fn() },
  };
  return { db, ruta };
}

describe('anular un pedido de la ruta: la ruta se sincroniza sin orden', () => {
  it('anular el 2 de una ruta de 4 no cierra la ruta y 1, 3 y 4 siguen pendientes', async () => {
    const pedidos = [ped(1n, 'LISTO'), ped(2n, 'ANULADO'), ped(3n, 'EN_CAMINO'), ped(4n, 'LISTO')];
    const { db, ruta } = fake(pedidos);
    const eventos = { emitirAdmin: jest.fn() };
    await cerrarRutaTrasAnular(db, 10n, eventos);
    expect(ruta.estado).toBe('EN_CURSO');
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('reparto:rutas', {});
  });

  it('anular el último pendiente cierra la ruta al instante', async () => {
    const { db, ruta } = fake([ped(1n, 'ENTREGADO'), ped(2n, 'ANULADO'), ped(3n, 'ENTREGADO')]);
    const eventos = { emitirAdmin: jest.fn() };
    await cerrarRutaTrasAnular(db, 10n, eventos);
    expect(ruta.estado).toBe('TERMINADA');
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('reparto:rutas', {});
  });

  it('un pedido sin repartidor no toca ninguna ruta', async () => {
    const { db } = fake([]);
    await cerrarRutaTrasAnular(db, null, { emitirAdmin: jest.fn() });
    expect(db.rutaReparto.findFirst).not.toHaveBeenCalled();
  });

  it('si sincronizarRuta falla, no lanza y lo deja en el log', async () => {
    const db: any = { rutaReparto: { findFirst: jest.fn().mockRejectedValue(new Error('BD caída')) } };
    const log = { error: jest.fn() };
    await expect(cerrarRutaTrasAnular(db, 10n, { emitirAdmin: jest.fn() }, log)).resolves.toBeUndefined();
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining('BD caída'));
  });

  it('sincronizarRuta no cuenta los anulados como pendientes', async () => {
    const { db, ruta } = fake([ped(1n, 'ANULADO'), ped(2n, 'RECHAZADO')]);
    await expect(sincronizarRuta(db, 10n)).resolves.toBe(7n);
    expect(ruta.estado).toBe('TERMINADA');
  });
});

describe('cierre manual de la ruta', () => {
  const montar = (pedidos: any[]) => {
    const { db, ruta } = fake(pedidos);
    db.parametro = { findMany: jest.fn().mockResolvedValue([]) };
    const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
    return { service: new RepartosService(db, auditoria, new RutaService()), db, ruta, pedidos };
  };

  it('con un EN_CAMINO sin resolver responde 409 con la lista y no cierra', async () => {
    const { service, ruta } = montar([ped(1n, 'ENTREGADO'), ped(2n, 'ANULADO'), ped(110n, 'EN_CAMINO')]);
    await expect(service.cerrarRuta(undefined, rep)).rejects.toMatchObject({
      response: {
        codigo: 'RUTA_CON_PENDIENTES',
        mensaje: 'Te falta resolver: CP-W110 (en camino)',
        pedidos: [{ id: '110', codigo: 'CP-W110', estado: 'EN_CAMINO' }],
      },
    });
    expect(ruta.estado).toBe('EN_CURSO');
  });

  it('los anulados no cuentan: sin EN_CAMINO la ruta se cierra con un toque, en cualquier orden', async () => {
    const { service, ruta } = montar([ped(1n, 'ENTREGADO'), ped(2n, 'ANULADO'), ped(3n, 'RECHAZADO')]);
    await expect(service.cerrarRuta(undefined, rep)).resolves.toMatchObject({ ok: true, cerrada: true, liberados: 0 });
    expect(ruta.estado).toBe('TERMINADA');
  });

  it('un LISTO que aún no salió no bloquea: vuelve a disponibles y la ruta se cierra', async () => {
    const { service, ruta, pedidos } = montar([ped(1n, 'ENTREGADO'), ped(4n, 'LISTO')]);
    await expect(service.cerrarRuta(undefined, rep)).resolves.toMatchObject({ cerrada: true, liberados: 1 });
    expect(pedidos[1]).toMatchObject({ repartidor_party_id: null, ruta_reparto_id: null });
    expect(ruta.estado).toBe('TERMINADA');
  });

  it('Caja/Admin cierra la ruta de un repartidor; sin repartidor pide cuál', async () => {
    const { service, ruta } = montar([ped(1n, 'ENTREGADO')]);
    await expect(service.cerrarRuta(undefined, admin)).rejects.toMatchObject({ response: { codigo: 'REPARTIDOR_REQUERIDO' } });
    await expect(service.cerrarRuta('10', admin)).resolves.toMatchObject({ cerrada: true });
    expect(ruta.estado).toBe('TERMINADA');
  });

  it('devolver al local un EN_CAMINO: vuelve a LISTO sin repartidor y permite cerrar la ruta', async () => {
    const { service, db, ruta, pedidos } = montar([ped(1n, 'ENTREGADO'), ped(2n, 'EN_CAMINO')]);
    db.pedido.findUnique = jest.fn(async ({ where }: any) => pedidos.find((p) => p.id === where.id));
    db.pedido.update = jest.fn(async ({ where, data }: any) => Object.assign(pedidos.find((p) => p.id === where.id), data));
    db.pedidoEstadoHistorial = { create: jest.fn() };
    await expect(service.devolverAlLocal('2', rep)).resolves.toMatchObject({ estado: 'LISTO' });
    expect(pedidos[1]).toMatchObject({ estado: 'LISTO', repartidor_party_id: null });
    expect(ruta.estado).toBe('TERMINADA');
  });
});

describe('liquidación: solo suma lo ENTREGADO', () => {
  it('pedidosRepartoDelDia filtra estado ENTREGADO (no EN_CAMINO, ANULADO ni no entregados)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    await pedidosRepartoDelDia({ pedido: { findMany } } as any, '2026-11-08');
    expect(findMany.mock.calls[0][0].where).toMatchObject({ modalidad: 'DELIVERY', estado: 'ENTREGADO' });
  });
});
