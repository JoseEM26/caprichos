// El gateway y el salón importan módulos ESM: en estas pruebas bastan dobles (igual que pedidos-estado.service.spec)
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { PedidosEstadoService } from './pedidos-estado.service';

describe('PedidosEstadoService.listarNoEntregados', () => {
  let prisma: { pedido: { findMany: jest.Mock }; party: { findMany: jest.Mock } };
  let service: PedidosEstadoService;

  const base = (extra: Record<string, unknown>) => ({
    id: 10n,
    codigo: 'CP-N001',
    cliente_nombre: 'Ana',
    cliente_telefono: '999111222',
    total: '30.50',
    pago_estado: 'PENDIENTE',
    motivo_anulacion: null,
    incidentes: [{ en: new Date('2026-10-28T10:00:00Z') }],
    mensajesReparto: [],
    ...extra,
  });

  beforeEach(() => {
    prisma = { pedido: { findMany: jest.fn() }, party: { findMany: jest.fn().mockResolvedValue([]) } };
    service = new PedidosEstadoService(prisma as any, {} as any, {} as any);
  });

  it('consulta LISTO sin repartidor por NO_CONTESTA, excluyendo los ya reenviados', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.listarNoEntregados();

    const where = prisma.pedido.findMany.mock.calls[0][0].where;
    expect(where).toEqual({
      estado: 'LISTO',
      motivo_falla: 'NO_CONTESTA',
      repartidor_party_id: null,
      NOT: { mensajesReparto: { some: { numero: 5, estado: 'REPROGRAMADO' } } },
    });
  });

  it('consulta ANULADO solo con pregunta de cancelación (dijo no, sin respuesta o tope)', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await service.listarNoEntregados();

    const where = prisma.pedido.findMany.mock.calls[1][0].where;
    expect(where.estado).toBe('ANULADO');
    expect(where.mensajesReparto.some.numero).toBe(5);
    expect(where.mensajesReparto.some.estado.in).toEqual(['NO_REPROGRAMAR', 'SIN_RESPUESTA', 'TOPE_ALCANZADO']);
  });

  it('agrupa por reprogramar y cancelados, con pregunta, hora del retiro y total numérico', async () => {
    prisma.pedido.findMany
      .mockResolvedValueOnce([
        base({ id: 1n, codigo: 'CP-A', mensajesReparto: [{ estado: 'ENVIADO' }] }),
        base({ id: 2n, codigo: 'CP-B', mensajesReparto: [{ estado: 'REPROGRAMAR' }] }),
        base({ id: 3n, codigo: 'CP-C', mensajesReparto: [], incidentes: [] }),
      ])
      .mockResolvedValueOnce([
        base({
          id: 4n,
          codigo: 'CP-D',
          estado: 'ANULADO',
          pago_estado: 'PAGADO',
          motivo_anulacion: 'Cliente no quiso reprogramar la entrega tras la espera agotada',
          mensajesReparto: [{ estado: 'NO_REPROGRAMAR' }],
        }),
        base({
          id: 5n,
          codigo: 'CP-E',
          estado: 'ANULADO',
          pago_estado: 'PENDIENTE',
          motivo_anulacion: 'Sin respuesta del cliente sobre reprogramar (tiempo agotado)',
          mensajesReparto: [{ estado: 'SIN_RESPUESTA' }],
        }),
      ]);

    const res = await service.listarNoEntregados();

    expect(res.reprogramar.map((f) => [f.codigo, f.pregunta])).toEqual([
      ['CP-A', 'ESPERANDO'],
      ['CP-B', 'SI'],
      ['CP-C', 'SIN_PREGUNTA'],
    ]);
    expect(res.reprogramar[0]).toMatchObject({
      id: '1',
      total: 30.5,
      cliente_telefono: '999111222',
      motivo: 'No contestó al repartidor (retiro por espera agotada)',
      revisar_devolucion: false,
    });
    expect(res.reprogramar[0].retirado_en).toEqual(new Date('2026-10-28T10:00:00Z'));
    expect(res.reprogramar[2].retirado_en).toBeNull();

    expect(res.cancelados.map((f) => [f.codigo, f.pregunta])).toEqual([
      ['CP-D', 'NO'],
      ['CP-E', 'SIN_RESPUESTA'],
    ]);
    expect(res.cancelados[0].motivo).toBe('Cliente no quiso reprogramar la entrega tras la espera agotada');
    expect(res.cancelados[0].revisar_devolucion).toBe(true);
    expect(res.cancelados[1].revisar_devolucion).toBe(false);
    expect(res.total).toBe(5);
  });

  it('marca revisar devolución también con pago coordinado', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      base({ estado: 'ANULADO', pago_estado: 'COORDINADO', mensajesReparto: [{ estado: 'NO_REPROGRAMAR' }] }),
    ]);

    const res = await service.listarNoEntregados();

    expect(res.cancelados[0].revisar_devolucion).toBe(true);
  });

  it('con devolución registrada quita la etiqueta y muestra el detalle', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([
      base({
        estado: 'ANULADO',
        pago_estado: 'PAGADO',
        mensajesReparto: [{ estado: 'NO_REPROGRAMAR' }],
        devolucion: {
          id: 3n,
          pedido_id: 1n,
          monto_devuelto: 25,
          medio: 'YAPE',
          motivo: 'Solo se cobró delivery',
          comprobante_baja_estado: null,
          por_party_id: 9n,
          autorizado_por_party_id: 4n,
          creado_en: new Date('2026-11-04T15:00:00Z'),
        },
      }),
    ]);

    const res = await service.listarNoEntregados();

    expect(res.cancelados[0].revisar_devolucion).toBe(false);
    expect(res.cancelados[0].devolucion).toMatchObject({ id: '3', montoDevuelto: 25, medio: 'YAPE' });
  });

  it('sin pedidos devuelve listas vacías y total 0', async () => {
    prisma.pedido.findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(service.listarNoEntregados()).resolves.toEqual({ reprogramar: [], cancelados: [], total: 0 });
  });
});
