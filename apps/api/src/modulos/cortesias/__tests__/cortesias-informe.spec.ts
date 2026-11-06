import { resumenCortesias, FilaCortesia } from '../cortesias-informe';

const fila = (o: Partial<FilaCortesia>): FilaCortesia => ({
  id: '1',
  creadoEn: new Date('2026-11-05T15:00:00Z'),
  productoId: '10',
  producto: 'Frappe Oreo',
  sabor: null,
  cantidad: 1,
  valorLista: 12,
  motivo: 'RECLAMO_CLIENTE',
  nota: null,
  pedido: 'CP-W001',
  pedidoReferencia: null,
  dadaPorId: '5',
  dadaPor: 'Caja Uno',
  autorizadaPor: null,
  ...o,
});

describe('resumenCortesias', () => {
  it('suma cantidad y valor de lista, sin ingresos', () => {
    const r = resumenCortesias([
      fila({ id: 'a', cantidad: 2, valorLista: 24 }),
      fila({ id: 'b', cantidad: 1, valorLista: 8.1, motivo: 'OTRO', productoId: '11', producto: 'Waffle', dadaPorId: '6', dadaPor: 'Caja Dos' }),
    ]);
    expect(r.resumen).toEqual({ registros: 2, unidades: 3, valorLista: 32.1 });
  });

  it('desglosa por motivo, producto y quién la dio (el de mayor valor primero)', () => {
    const r = resumenCortesias([
      fila({ id: 'a', valorLista: 12 }),
      fila({ id: 'b', valorLista: 30, motivo: 'OTRO', productoId: '11', producto: 'Waffle', dadaPorId: '6', dadaPor: 'Caja Dos' }),
      fila({ id: 'c', valorLista: 5, motivo: 'OTRO', productoId: '11', producto: 'Waffle', dadaPorId: '6', dadaPor: 'Caja Dos' }),
    ]);
    expect(r.porMotivo.map((m) => [m.codigo, m.registros, m.valorLista])).toEqual([
      ['OTRO', 2, 35],
      ['RECLAMO_CLIENTE', 1, 12],
    ]);
    expect(r.porProducto[0]).toMatchObject({ producto: 'Waffle', registros: 2, valorLista: 35 });
    expect(r.porQuien.map((q) => q.nombre)).toEqual(['Caja Dos', 'Caja Uno']);
  });

  it('sin cortesías devuelve todo en cero', () => {
    expect(resumenCortesias([])).toEqual({
      resumen: { registros: 0, unidades: 0, valorLista: 0 },
      porMotivo: [],
      porProducto: [],
      porQuien: [],
    });
  });
});
