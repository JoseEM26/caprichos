import { cuponesDelTurno } from './cupones-turno';

const AHORA = new Date('2026-11-16T20:00:00Z');
const caja = { fecha: new Date('2026-11-16T00:00:00Z'), cerrada_en: null };
const dado = (o: any = {}) => ({
  codigo: 'D1', estado: 'VIGENTE', vence_en: new Date('2026-12-01T00:00:00Z'), creado_en: new Date('2026-11-16T15:00:00Z'), otorgado_por: 7n, canjeado_por: null,
  cupon: { codigo_base: 'GRACIAS10' }, pedidoOrigen: { codigo: 'P-1', estado: 'ENTREGADO', cliente_telefono: '987654321' }, ...o,
});
const canje = (o: any = {}) => ({
  codigo: 'C1', estado: 'CANJEADO', canjeado_en: new Date('2026-11-16T16:00:00Z'), canjeado_por: 8n, canjeado_canal: 'CAJA', otorgado_por: 7n,
  cupon: { codigo_base: 'GRACIAS10', modo: 'ASIGNADO_PERSONAL' }, pedidoOrigen: { codigo: 'P-1' },
  pedidoCanje: { codigo: 'P-2', estado: 'ENTREGADO', descuento: 5, descuento_detalle: null, cobros: [{ anulado_en: null }] }, ...o,
});
const prismaCon = (dados: any[], canjes: any[], compartidos: any[] = []) => ({
  cuponEmitido: { findMany: jest.fn().mockResolvedValueOnce(dados).mockResolvedValueOnce(canjes) },
  cuponCanjeCompartido: { findMany: jest.fn().mockResolvedValue(compartidos) },
  person: { findMany: jest.fn().mockResolvedValue([{ party_id: 7n, nombres: 'Ana', apellidos: 'Mozo' }, { party_id: 8n, nombres: 'Luis', apellidos: 'Caja' }]) },
});

describe('cuponesDelTurno', () => {
  it('agrupa por persona: dados y pendientes a quien dio, canjeados a quien canjeó, con descuento', async () => {
    const prisma = prismaCon([dado(), dado({ codigo: 'D2', estado: 'CANJEADO' })], [canje()]);
    const r = await cuponesDelTurno(prisma, caja, AHORA);
    const ana = r.porPersona.find((p) => p.nombre === 'Ana Mozo')!;
    const luis = r.porPersona.find((p) => p.nombre === 'Luis Caja')!;
    expect(ana.totales).toMatchObject({ dados: 2, pendientes: 1, canjeados: 0 });
    expect(ana.dados[0]).toMatchObject({ pedido: 'P-1', cliente: '9•••••321' });
    expect(luis.canjeados[0]).toMatchObject({ codigo: 'C1', pedido: 'P-2', descuento: 5, dioNombre: 'Ana Mozo', canal: 'CAJA' });
    expect(r.totales).toMatchObject({ dados: 2, canjeados: 1, pendientes: 1, descuento: 5 });
    expect(prisma.person.findMany).toHaveBeenCalledTimes(1); // sin N+1
  });

  it('excluye pedidos anulados y cobros anulados; los vencidos no son pendientes', async () => {
    const prisma = prismaCon(
      [dado({ pedidoOrigen: { codigo: 'P-9', estado: 'ANULADO', cliente_telefono: null } }), dado({ codigo: 'D3', vence_en: new Date('2026-11-15T00:00:00Z') })],
      [canje({ pedidoCanje: { codigo: 'P-4', estado: 'ANULADO', descuento: 5, cobros: [] } }), canje({ codigo: 'C3', pedidoCanje: { codigo: 'P-5', estado: 'ENTREGADO', descuento: 5, cobros: [{ anulado_en: new Date() }] } })],
    );
    const r = await cuponesDelTurno(prisma, caja, AHORA);
    expect(r.totales).toMatchObject({ dados: 1, canjeados: 0, pendientes: 0, descuento: 0 });
  });

  it('compartidos y de código único van en una línea aparte con su descuento; no entran a la persona', async () => {
    const unico = canje({ codigo: 'U1', cupon: { codigo_base: 'X', modo: 'UNICO_COMPROBANTE' }, pedidoCanje: { codigo: 'P-6', estado: 'ENTREGADO', descuento: 3, cobros: [] } });
    const prisma = prismaCon([], [unico], [{ pedido: { codigo: 'P-7', estado: 'ENTREGADO', descuento: 4.5, cobros: [] } }]);
    const r = await cuponesDelTurno(prisma, caja, AHORA);
    expect(r.otros).toEqual({ canjes: 2, descuento: 7.5 });
    expect(r.porPersona).toHaveLength(0);
  });

  it('consulta solo la ventana del día de la caja', async () => {
    const prisma = prismaCon([], []);
    await cuponesDelTurno(prisma, caja, AHORA);
    const donde = prisma.cuponEmitido.findMany.mock.calls[0][0].where.creado_en;
    expect(donde.gte.toISOString()).toBe('2026-11-16T05:00:00.000Z');
    expect(donde.lte).toEqual(AHORA);
  });
});
