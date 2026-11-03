jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { AvisosPedidoService } from '../servicios/avisos-pedido.service';
import { CONFIG_ETA_DEFECTO } from '../../repartos/eta-entrega';

const LOCAL = CONFIG_ETA_DEFECTO.local;
const alNorte = (km: number) => ({ lat: LOCAL.lat + km / 111, lng: LOCAL.lng });

/** Pedidos del mismo repartidor en camino: cada uno con su zona y su punto. */
function construir(
  pedidos: Array<{ id: number; zona?: { minutos_min: number; minutos_max: number } | null; km: number | null; unidades?: number }>,
  salidaActiva = true,
) {
  const porId = new Map(pedidos.map((p) => [BigInt(p.id), p]));
  const fila = (p: (typeof pedidos)[number]) => {
    const pt = p.km == null ? { lat: null, lng: null } : alNorte(p.km);
    return {
      id: BigInt(p.id),
      codigo: `CP-${p.id}`,
      cliente_nombre: 'Marta',
      cliente_telefono: '987654321',
      modalidad: 'DELIVERY',
      total: 30,
      pago_metodo: 'EFECTIVO',
      pago_preferido: 'EFECTIVO',
      entrega_lat: pt.lat,
      entrega_lng: pt.lng,
      repartidor_party_id: BigInt(7),
      zona: p.zona ?? null,
      lineas: [{ cantidad: p.unidades ?? 1 }],
    };
  };
  const prisma: any = {
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
    pedido: {
      findUnique: jest.fn(async ({ where }: any) => fila(porId.get(where.id)!)),
      findMany: jest.fn(async () =>
        pedidos
          .filter((p) => p.km != null)
          .map((p) => ({ id: BigInt(p.id), entrega_lat: alNorte(p.km as number).lat, entrega_lng: alNorte(p.km as number).lng })),
      ),
    },
    parametro: {
      findUnique: jest.fn(async ({ where }: any) =>
        where.clave === 'whatsapp_aviso_salida_activo' ? { valor: salidaActiva ? 'si' : 'no' } : { valor: 30 },
      ),
      findMany: jest.fn(async () => []),
    },
    mensajeReparto: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async () => ({})),
    },
  };
  prisma.pedido.update = jest.fn(async () => ({}));
  const outbox: any = { encolar: jest.fn(async () => true), despertar: jest.fn() };
  return { servicio: new AvisosPedidoService(prisma, outbox), outbox, prisma };
}

const textoDe = (outbox: any) => outbox.encolar.mock.calls[0][0].carga.textoLibre as string;

describe('Aviso SALIDA con tiempo estimado propio', () => {
  it('usa el rango de la zona del pedido, no el 30 fijo', async () => {
    const { servicio, outbox } = construir([{ id: 1, zona: { minutos_min: 25, minutos_max: 30 }, km: 2 }]);
    await servicio.avisar(1, 'SALIDA');
    expect(textoDe(outbox)).toContain('Tiempo estimado: 25 a 30 minutos');
  });

  it('dos pedidos del mismo repartidor reciben estimados distintos', async () => {
    const zona = { minutos_min: 15, minutos_max: 20 };
    const { servicio, outbox } = construir([
      { id: 1, zona, km: 0.4 },
      { id: 2, zona, km: 0.4 },
    ]);
    await servicio.avisar(1, 'SALIDA');
    await servicio.avisar(2, 'SALIDA');
    const [primero, segundo] = outbox.encolar.mock.calls.map((c: any) => c[0].carga.textoLibre as string);
    expect(primero).toContain('Tiempo estimado: 15 a 20 minutos');
    expect(segundo).not.toEqual(primero);
    expect(segundo).toContain('Tiempo estimado: 20 a 25 minutos');
  });

  it('con el aviso SALIDA apagado no envía, pero guarda el tiempo prometido que usa el seguimiento', async () => {
    const { servicio, outbox, prisma } = construir([{ id: 4, zona: { minutos_min: 25, minutos_max: 30 }, km: 2 }], false);
    expect(await servicio.avisar(4, 'SALIDA')).toEqual({ estado: 'OMITIDO', motivo: 'DESACTIVADO' });
    expect(outbox.encolar).not.toHaveBeenCalled();
    expect(prisma.pedido.update).toHaveBeenCalledWith({ where: { id: BigInt(4) }, data: { eta_min: 25, eta_max: 30 } });
  });

  it('sin zona ni coordenadas cae al respaldo tiempo_prometido_min', async () => {
    const { servicio, outbox } = construir([{ id: 3, zona: null, km: null }]);
    await servicio.avisar(3, 'SALIDA');
    expect(textoDe(outbox)).toContain('Tiempo estimado: 30 minutos');
  });
});
