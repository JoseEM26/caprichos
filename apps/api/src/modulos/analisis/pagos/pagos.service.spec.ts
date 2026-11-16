import { PagosAnalisisService, armarPagos, type FilaDia, type FilaMedio } from './pagos.service';

const medios: FilaMedio[] = [
  { canal: null, medio: 'TARJETA_CULQI', pedidos: 3, clientes: 2, monto: 90 },
  { canal: null, medio: 'YAPE', pedidos: 5, clientes: 4, monto: 100 },
  { canal: null, medio: 'DIVIDIDO', pedidos: 2, clientes: 2, monto: 60 },
  { canal: 'CARTA', medio: 'TARJETA_CULQI', pedidos: 3, clientes: 2, monto: 90 },
  { canal: 'CAJA', medio: 'YAPE', pedidos: 5, clientes: 4, monto: 100 },
];
const dias: FilaDia[] = [
  { dia: '2026-11-10', pedidos: 4, culqi: 1, montoCulqi: 30, montoResto: 90 },
  { dia: '2026-11-11', pedidos: 6, culqi: 2, montoCulqi: 60, montoResto: 120 },
];

describe('armarPagos', () => {
  const r = armarPagos(medios, dias, { total: 4.5, pagosCulqi: 3, porConfirmar: 1 }, { pedidos: 1, monto: 30 }, true);

  it('cuenta por medio separando Culqi y ordena', () => {
    expect(r.porMedio.map((f) => f.medio)).toEqual(['YAPE', 'TARJETA_CULQI', 'DIVIDIDO']);
    expect(r.porMedio[0]).toMatchObject({ pedidos: 5, clientes: 4, monto: 100, porcentaje: 50 });
    expect(r.porCanal.map((c) => c.canal)).toEqual(['CAJA', 'CARTA']);
  });
  it('adopción: % de la carta, ticket Culqi vs resto, comisión por confirmar', () => {
    expect(r.adopcion).toMatchObject({ pedidosCarta: 10, pedidosCulqi: 3, porcentaje: 30, ticketCulqi: 30, ticketResto: 30 });
    expect(r.adopcion.porDia[1]).toMatchObject({ porcentaje: 33.3 });
    expect(r.comision).toEqual({ total: 4.5, pagosCulqi: 3, porConfirmar: 1 });
    expect(r.devueltosCulqi).toEqual({ pedidos: 1, monto: 30 });
  });
  it('el supervisor no recibe dinero', () => {
    const s = armarPagos(medios, dias, { total: 4.5, pagosCulqi: 3, porConfirmar: 0 }, { pedidos: 1, monto: 30 }, false);
    expect(s.porMedio[0].monto).toBeNull();
    expect(s.adopcion.ticketCulqi).toBeNull();
    expect(s.comision.total).toBeNull();
    expect(s.adopcion.porcentaje).toBe(30);
  });
  it('sin pedidos de carta no hay porcentaje', () => {
    expect(armarPagos([], [], { total: 0, pagosCulqi: 0, porConfirmar: 0 }, { pedidos: 0, monto: 0 }, true).adopcion.porcentaje).toBeNull();
  });
});

describe('PagosAnalisisService', () => {
  it('excluye anulados y rechazados en las consultas de pedidos y convierte los conteos', async () => {
    const consultas: string[] = [];
    const prisma = {
      $queryRaw: jest.fn(async (q: { sql: string }) => {
        consultas.push(q.sql);
        if (q.sql.includes('GROUPING SETS')) return [{ canal: null, medio: 'YAPE_CULQI', pedidos: 2n, clientes: 1n, monto: '50.00' }];
        return [];
      }),
    };
    const r = await new PagosAnalisisService(prisma as never).resumen({ desde: '2026-11-10', hasta: '2026-11-11' }, true, new Date('2026-11-11T20:00:00Z'));
    expect(consultas).toHaveLength(4);
    expect(consultas.filter((s) => s.includes("NOT IN ('ANULADO','RECHAZADO')"))).toHaveLength(3);
    expect(r.porMedio[0]).toMatchObject({ medio: 'YAPE_CULQI', pedidos: 2, monto: 50 });
  });
});
