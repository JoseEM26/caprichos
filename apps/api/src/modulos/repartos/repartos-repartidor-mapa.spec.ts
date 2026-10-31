jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { RepartosService } from './repartos.service';
import { RutaService } from './ruta.service';

const rep = (id: bigint) => ({ partyId: id, rol: 'REPARTIDOR', debeCambiar: false }) as any;
const base = (o: any) => ({
  modalidad: 'DELIVERY', estado: 'LISTO', repartidor_party_id: null, anulado_en: null, motivo_falla: null,
  entrega_lat: -12.01, entrega_lng: -77.0, creado_en: new Date(Date.now() - 5 * 60000), zona: null,
  pago_estado: 'PAGADO', pago_metodo: 'EFECTIVO', pago_preferido: null, es_personal: false,
  cliente_nombre: 'Ana', cliente_telefono: '999', entrega_direccion: 'Calle 1', entrega_referencia: 'ref',
  nota: 'sin ají', total: 50, orden_ruta: null,
  lineas: [{ cantidad: 2, nombre: 'Pizza' }, { cantidad: 1, nombre: 'Chicha' }], ...o,
});

function montar(pedidos: any[], maxPedidos = 3) {
  const tx: any = {
    $queryRaw: jest.fn(async () => pedidos.map((p) => ({ ...p }))),
    pedido: {
      findMany: jest.fn(async (a: any) =>
        a.where.repartidor_party_id !== undefined
          ? pedidos.filter((p) => p.repartidor_party_id === a.where.repartidor_party_id)
          : [...pedidos]),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const ok = pedidos.filter((p) => where.id.in.includes(p.id) && p.estado === 'LISTO' && p.repartidor_party_id === null);
        ok.forEach((p) => Object.assign(p, data));
        return { count: ok.length };
      }),
      update: jest.fn(async ({ where, data }: any) => Object.assign(pedidos.find((p) => p.id === where.id), data)),
    },
    pedidoEstadoHistorial: { create: jest.fn() },
  };
  const prisma: any = {
    parametro: { findMany: jest.fn().mockResolvedValue([{ clave: 'rep_max_pedidos', valor: maxPedidos }]) },
    pedido: {
      findMany: jest.fn(async ({ where }: any) =>
        pedidos.filter((p) => where.estado.in.includes(p.estado) && p.modalidad === where.modalidad
          && p.entrega_lat != null && p.repartidor_party_id === null)),
      findUnique: jest.fn(async ({ where }: any) => pedidos.find((p) => p.id === where.id) ?? null),
      count: jest.fn(async ({ where }: any) => pedidos.filter((p) => p.repartidor_party_id === where.repartidor_party_id).length),
    },
    $transaction: jest.fn((fn: any) => fn(tx)),
  };
  const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
  const gateway: any = { emitirAdmin: jest.fn() };
  return { service: new RepartosService(prisma, auditoria, new RutaService(), gateway), auditoria, gateway, pedidos };
}

describe('listarProximos', () => {
  it('solo próximos con datos mínimos y estados correctos', async () => {
    const { service } = montar([
      base({ id: 1n, codigo: 'A', estado: 'PREPARANDO' }),
      base({ id: 2n, codigo: 'B', estado: 'COLA', pago_estado: 'PENDIENTE', pago_metodo: 'YAPE' }),
      base({ id: 3n, codigo: 'C', estado: 'LISTO' }),
      base({ id: 4n, codigo: 'D', estado: 'COLA', modalidad: 'MESA' }),
      base({ id: 5n, codigo: 'E', estado: 'COLA', entrega_lat: null }),
    ]);
    const r = await service.listarProximos(rep(9n));
    expect(r.map((x) => [x.codigo, x.estado, x.estadoTexto])).toEqual([
      ['A', 'EN_COCINA', 'En cocina'],
      ['B', 'POR_VALIDAR', 'Por validar pago'],
    ]);
    expect(Object.keys(r[0]).sort()).toEqual(
      ['cantidadProductos', 'clienteNombre', 'codigo', 'creadoEn', 'estado', 'estadoTexto', 'id', 'lat', 'lng', 'minutosEspera', 'zona'],
    );
    expect(r[0].cantidadProductos).toBe(3);
  });
});

describe('resumenRepartidor', () => {
  it('oculta dirección y teléfono si no es suyo y los da si es suyo', async () => {
    const { service } = montar([
      base({ id: 1n, codigo: 'A' }),
      base({ id: 2n, codigo: 'B', repartidor_party_id: 9n }),
    ]);
    const ajeno = await service.resumenRepartidor('1', rep(9n));
    expect(ajeno).not.toHaveProperty('direccion');
    expect(ajeno).not.toHaveProperty('telefono');
    expect(ajeno).toMatchObject({ puedeTomar: true, motivoNoTomar: null, productos: [{ cantidad: 2, nombre: 'Pizza' }, { cantidad: 1, nombre: 'Chicha' }] });
    const mio = await service.resumenRepartidor('2', rep(9n));
    expect(mio).toMatchObject({ direccion: 'Calle 1', telefono: '999', puedeTomar: false });
  });

  it('próximo no se puede tomar; 404 si es de otro, no delivery o inexistente', async () => {
    const { service } = montar([
      base({ id: 1n, estado: 'PREPARANDO' }),
      base({ id: 2n, repartidor_party_id: 5n }),
      base({ id: 3n, modalidad: 'MESA' }),
    ]);
    expect(await service.resumenRepartidor('1', rep(9n))).toMatchObject({ estado: 'EN_COCINA', puedeTomar: false, motivoNoTomar: 'Aún no está disponible' });
    for (const id of ['2', '3', '99']) {
      await expect(service.resumenRepartidor(id, rep(9n))).rejects.toBeInstanceOf(NotFoundException);
    }
  });
});

describe('tomarRuta', () => {
  const tres = () => [1n, 2n, 3n].map((id) => base({ id, codigo: `CP-${id}` }));

  it('toma en orden, guarda orden_ruta, audita y emite eventos', async () => {
    const { service, pedidos, auditoria, gateway } = montar(tres());
    const r = await service.tomarRuta({ ids: ['3', '1', '2'] }, rep(9n));
    expect(pedidos.map((p) => [p.id, p.orden_ruta])).toEqual([[1n, 2], [2n, 3], [3n, 1]]);
    expect(r.tomados.map((t) => t.codigo)).toEqual(['CP-3', 'CP-1', 'CP-2']);
    expect(r.tomados[0].ordenRuta).toBe(1);
    expect(auditoria.registrar).toHaveBeenCalledTimes(3);
    expect(gateway.emitirAdmin).toHaveBeenCalledTimes(3);
  });

  it('409 AUN_NO_DISPONIBLE y no toma ninguno', async () => {
    const { service, pedidos } = montar([...tres().slice(0, 2), base({ id: 3n, codigo: 'CP-3', estado: 'PREPARANDO' })]);
    const e: any = await service.tomarRuta({ ids: ['1', '2', '3'] }, rep(9n)).catch((x) => x);
    expect(e).toBeInstanceOf(ConflictException);
    expect(e.getResponse()).toMatchObject({ codigo: 'AUN_NO_DISPONIBLE', pedido: 'CP-3' });
    expect(pedidos.every((p) => p.repartidor_party_id === null)).toBe(true);
  });

  it('409 YA_TOMADO si otro repartidor lo tiene', async () => {
    const { service } = montar([base({ id: 1n, codigo: 'CP-1' }), base({ id: 2n, codigo: 'CP-2', repartidor_party_id: 5n })]);
    const e: any = await service.tomarRuta({ ids: ['1', '2'] }, rep(9n)).catch((x) => x);
    expect(e.getResponse()).toMatchObject({ codigo: 'YA_TOMADO', pedido: 'CP-2' });
  });

  it('409 LIMITE_PEDIDOS contando lo que ya lleva', async () => {
    const { service, pedidos } = montar([...tres(), base({ id: 4n, codigo: 'CP-4', repartidor_party_id: 9n, estado: 'EN_CAMINO' })], 3);
    const e: any = await service.tomarRuta({ ids: ['1', '2', '3'] }, rep(9n)).catch((x) => x);
    expect(e.getResponse()).toMatchObject({ codigo: 'LIMITE_PEDIDOS' });
    expect(pedidos.filter((p) => p.repartidor_party_id === 9n)).toHaveLength(1);
  });
});
