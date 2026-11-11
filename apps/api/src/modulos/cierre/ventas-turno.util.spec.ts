import { detallarVentasTurno, idsDePersonas, CobroConDetalle } from './ventas-turno.util';

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
