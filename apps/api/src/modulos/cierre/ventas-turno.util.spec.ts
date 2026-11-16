import { detallarVentasTurno, idsDePersonas, serviciosLibresDelTurno, programadosDelTurnoDe, CobroConDetalle } from './ventas-turno.util';

const cobro = (o: Partial<CobroConDetalle> & { pedido?: CobroConDetalle['pedido'] } = {}): CobroConDetalle => ({
  pedido_id: 5n,
  cobrado_por: 11n,
  credito_personal: false,
  anulado_en: null,
  pagos: [
    { medio: 'efectivo', monto: 30, propina: 2 },
    { medio: 'yape', monto: 20, propina: 0 },
  ],
  pedido: {
    modalidad: 'DELIVERY',
    canal: 'MOZO',
    estado: 'ENTREGADO',
    mesa_nombre: null,
    creado_en: new Date('2026-11-02T15:00:00Z'),
    party_id: 12n,
    repartidor_party_id: 13n,
    cobro_mozo_party_id: null,
    lineas: [
      { producto: { categoria: { nombre: 'Donas' } } },
      { producto: { categoria: { nombre: 'Donas' } } },
      { producto: { categoria: { nombre: 'Bebidas' } } },
      { producto: null },
    ],
    comprobante: [
      { tipo: 'BOLETA', numero_texto: 'B001-8', emision: 'EMITIDO', facturacion_estado: null, anulado_en: new Date() },
      { tipo: 'BOLETA', numero_texto: 'B001-9', emision: 'EMITIDO', facturacion_estado: 'EMITIDO_SUNAT', anulado_en: null },
    ],
  },
  ...o,
});

const nombres = new Map([
  ['11', 'Lucia Prueba'],
  ['12', 'Mario Prueba'],
  ['13', 'Rita Reparto'],
]);

describe('detallarVentasTurno', () => {
  it('arma quién, tipo, categorías sin repetir, medios, propina y comprobante vigente', () => {
    const [v] = detallarVentasTurno([cobro()], nombres);
    expect(v).toMatchObject({
      pedidoId: '5',
      modalidad: 'DELIVERY',
      registradoPor: 'Mario Prueba',
      cobradoPor: 'Lucia Prueba',
      repartidor: 'Rita Reparto',
      categorias: ['Donas', 'Bebidas'],
      propina: 2,
      comprobante: { tipo: 'BOLETA', numero: 'B001-9', estado: 'EMITIDO_SUNAT' },
    });
    expect(v.pagos).toEqual([
      { medio: 'EFECTIVO', monto: 30 },
      { medio: 'YAPE', monto: 20 },
    ]);
  });

  it('en canales de clientes no hay «registrado por» y lo que falta sale vacío sin romper', () => {
    const [v] = detallarVentasTurno([cobro({ pedido: { canal: 'BOT', party_id: 99n } })], nombres);
    expect(v.registradoPor).toBeNull();
    expect(v.repartidor).toBeNull();
    expect(v.categorias).toEqual([]);
    expect(v.comprobante).toBeNull();
  });

  it('deja fuera los cobros anulados, igual que la lista cobrados del cierre', () => {
    expect(detallarVentasTurno([cobro({ anulado_en: new Date() })], nombres)).toEqual([]);
    expect(idsDePersonas([cobro({ anulado_en: new Date() })])).toEqual([]);
  });

  it('pide los nombres de cobrador, repartidor y mozo (solo si es canal de la casa)', () => {
    expect(idsDePersonas([cobro()]).map(String).sort()).toEqual(['11', '12', '13']);
  });
});

describe('serviciosLibresDelTurno (Servicios y productos libres del cierre)', () => {
  const conCargo = (anulado: Date | null, monto: number, en: Date) =>
    cobro({
      anulado_en: anulado,
      pedido: {
        codigo: 'P-1',
        lineas: [
          { producto: null, cargo_libre: false, nombre: 'Brownie', subtotal: 12 },
          { producto: null, cargo_libre: true, nombre: 'Texto Feliz cumple Ana', subtotal: monto, cargo_libre_por: 7n, cargo_libre_en: en },
        ],
      },
    });

  it('lista cada cargo con pedido, medios y quién lo agregó, y suma el total al céntimo', () => {
    const r = serviciosLibresDelTurno([conCargo(null, 3.1, new Date('2027-03-09T15:00:00Z')), conCargo(null, 0.2, new Date('2027-03-09T16:00:00Z'))], new Map([['7', 'Rosa Mozo']]));
    expect(r.lista).toHaveLength(2);
    expect(r.lista[0]).toMatchObject({ pedidoCodigo: 'P-1', descripcion: 'Texto Feliz cumple Ana', monto: 3.1, medios: ['EFECTIVO', 'YAPE'], agregadoPor: 'Rosa Mozo' });
    expect(r.total).toBe(3.3);
  });

  it('un pedido solo con «Servicio o producto» (sin ningún producto) entra al cuadre: se lista, se suma y la venta no falla sin categorías', () => {
    const soloCargo = cobro({
      pagos: [{ medio: 'yape', monto: 29, propina: 0 }],
      pedido: { codigo: 'P-9', lineas: [{ producto: null, cargo_libre: true, nombre: 'Torta chocolate 10 cm corazón', subtotal: 29, cargo_libre_por: 7n, cargo_libre_en: new Date('2026-11-16T20:00:00Z') }] },
    });
    const r = serviciosLibresDelTurno([soloCargo], new Map([['7', 'Rosa Mozo']]));
    expect(r.lista).toHaveLength(1);
    expect(r.lista[0]).toMatchObject({ pedidoCodigo: 'P-9', descripcion: 'Torta chocolate 10 cm corazón', monto: 29, medios: ['YAPE'], agregadoPor: 'Rosa Mozo' });
    expect(r.total).toBe(29);
    const v = detallarVentasTurno([soloCargo], new Map());
    expect(v).toHaveLength(1);
    expect(v[0].categorias).toEqual([]);
    expect(v[0].pagos).toEqual([{ medio: 'YAPE', monto: 29 }]);
  });

  it('un cobro anulado no cuenta', () => {
    expect(serviciosLibresDelTurno([conCargo(new Date(), 5, new Date())], new Map())).toEqual({ lista: [], total: 0 });
  });

  it('idsDePersonas incluye a quien agregó el cargo', () => {
    expect(idsDePersonas([conCargo(null, 5, new Date())])).toContain(7n);
  });
});

describe('programadosDelTurnoDe (dinero de pedidos programados recibido hoy)', () => {
  const programado = new Date('2026-11-17T22:00:00Z');
  it('identifica el adelanto y el cobro completo de un programado; deja fuera pedidos sin fecha pactada y cobros anulados', () => {
    const r = programadosDelTurnoDe(
      [
        { pedido_id: 1n, anulado_en: null, pagos: [{ medio: 'EFECTIVO', monto: 29 }], pedido: { codigo: 'CP-0001', programado_para: programado } },
        { pedido_id: 2n, anulado_en: null, pagos: [{ medio: 'YAPE', monto: 10 }], pedido: { codigo: 'CP-0002', programado_para: null } },
        { pedido_id: 3n, anulado_en: new Date(), pagos: [{ medio: 'YAPE', monto: 5 }], pedido: { codigo: 'CP-0003', programado_para: programado } },
      ],
      [{ pedido_id: 4n, medio: 'TARJETA', monto: 12.5, pedido: { codigo: 'CP-0004', programado_para: programado } }],
    );
    expect(r.lista.map((x) => [x.pedidoCodigo, x.tipo, x.monto])).toEqual([['CP-0004', 'ADELANTO', 12.5], ['CP-0001', 'COBRO', 29]]);
    expect(r.total).toBe(41.5);
  });
});
