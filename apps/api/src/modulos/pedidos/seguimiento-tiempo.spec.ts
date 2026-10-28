import { SeguimientoService } from './seguimiento.service';

const minutosAtras = (m: number) => new Date(Date.now() - m * 60000);

/** Pedido de delivery con los campos que usa el seguimiento (sin datos personales). */
function pedido(extra: Record<string, unknown>) {
  return {
    id: 1n,
    codigo: 'CP-T1',
    estado: 'COLA',
    modalidad: 'DELIVERY',
    total: { toString: () => '20' },
    creado_en: minutosAtras(30),
    pasa_cocina_en: null,
    listo_en: null,
    despachado_en: null,
    entregado_en: null,
    eta_min: null,
    eta_max: null,
    entrega_lat: null,
    entrega_lng: null,
    zona: null,
    lineas: [{ cantidad: 1, nombre: 'Producto' }],
    historial: [],
    party_id: 9n,
    ...extra,
  };
}

function servicio(fila: Record<string, unknown>) {
  const prisma: any = {
    pedido: { findMany: jest.fn(async () => [fila]) },
    parametro: { findMany: jest.fn(async () => []) },
  };
  return new SeguimientoService(prisma);
}

describe('Tiempo que falta en el seguimiento', () => {
  it('en camino: resta lo transcurrido desde la salida al rango prometido', async () => {
    const s = servicio(pedido({ estado: 'EN_CAMINO', despachado_en: minutosAtras(10), eta_min: 25, eta_max: 30 }));
    const [res] = await s.pedidosDeCuenta(9n, 1).then((r) => r.pedidos);
    expect(res.tiempo).toMatchObject({ min: 15, max: 20, enCamino: true, texto: 'unos 15 a 20 minutos' });
  });

  it('en camino nunca muestra menos de 5 minutos ni negativo', async () => {
    const s = servicio(pedido({ estado: 'EN_CAMINO', despachado_en: minutosAtras(90), eta_min: 25, eta_max: 30 }));
    const [res] = (await s.pedidosDeCuenta(9n, 1)).pedidos;
    expect(res.tiempo!.min).toBe(5);
    expect(res.tiempo!.max).toBeGreaterThanOrEqual(5);
  });

  it('sin salir con zona: usa el rango de la zona (sin coordenadas)', async () => {
    const s = servicio(pedido({ zona: { minutos_min: 15, minutos_max: 20 } }));
    const [res] = (await s.pedidosDeCuenta(9n, 1)).pedidos;
    expect(res.tiempo).toMatchObject({ min: 15, max: 20, enCamino: false, texto: 'unos 15 a 20 minutos' });
  });

  it('sin zona ni coordenadas cae al respaldo tiempo_prometido_min', async () => {
    const s = servicio(pedido({}));
    const [res] = (await s.pedidosDeCuenta(9n, 1)).pedidos;
    expect(res.tiempo).toMatchObject({ min: 30, max: 30, texto: 'unos 30 minutos' });
  });

  it('recoger en local no muestra tiempo de entrega', async () => {
    const s = servicio(pedido({ modalidad: 'RECOGER', zona: { minutos_min: 15, minutos_max: 20 } }));
    expect((await s.pedidosDeCuenta(9n, 1)).pedidos[0].tiempo).toBeNull();
  });

  it('entregado o anulado: sin tiempo', async () => {
    const entregado = servicio(pedido({ estado: 'ENTREGADO', despachado_en: minutosAtras(40), entregado_en: minutosAtras(1) }));
    expect((await entregado.pedidosDeCuenta(9n, 1)).pedidos[0].tiempo).toBeNull();
    const anulado = servicio(pedido({ estado: 'ANULADO' }));
    expect((await anulado.pedidosDeCuenta(9n, 1)).pedidos[0].tiempo).toBeNull();
  });
});
