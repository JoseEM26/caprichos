import { construirEtiquetaGeneral } from './constructor-etiquetas';

const base: any = {
  codigo: 'CP-9', modalidad: 'LLEVAR', cliente_nombre: 'Ana', canal: 'CAJA', creado_en: new Date('2026-11-08T15:00:00Z'),
  total: 30, descuento: 0, propina: 0, lineas: [{ cantidad: 1, nombre: 'Cafe', producto_id: 1n }],
};

describe('sticker general: bloque de pago', () => {
  it('sin plan: usa pago_metodo, vuelto con paga_con', () => {
    const g = construirEtiquetaGeneral({ ...base, pago_metodo: 'EFECTIVO', pago_estado: 'PENDIENTE', paga_con: 50 });
    expect(g.pago).toMatchObject({ estado: 'POR_COBRAR', medios: [{ medio: 'EFECTIVO', monto: 30 }], vuelto: 20, llevaVuelto: true, cobrarAlEntregar: null });
  });
  it('con planPago (dividido): un medio por linea ordenado', () => {
    const g = construirEtiquetaGeneral({ ...base, pago_estado: 'PAGADO', planPago: [{ medio: 'YAPE', monto: 10, orden: 2 }, { medio: 'EFECTIVO', monto: 20, orden: 1 }] });
    expect(g.pago?.medios).toEqual([{ medio: 'EFECTIVO', monto: 20 }, { medio: 'YAPE', monto: 10 }]);
    expect(g.pago?.estado).toBe('PAGADO');
  });
  it('personal', () => {
    expect(construirEtiquetaGeneral({ ...base, es_personal: true }).pago).toMatchObject({ esPersonal: true });
  });
  it('delivery sin pagar en efectivo: cobrarAlEntregar; cobrado por mozo: no', () => {
    const d = { ...base, modalidad: 'DELIVERY', pago_metodo: 'EFECTIVO', paga_con: 100 };
    expect(construirEtiquetaGeneral(d).pago).toMatchObject({ cobrarAlEntregar: 30, vuelto: 70 });
    expect(construirEtiquetaGeneral({ ...d, cobro_mozo_en: new Date() }).pago).toMatchObject({ estado: 'COBRADO_MOZO', cobrarAlEntregar: null });
  });
  it('sin total: no hay bloque (el payload anterior sigue igual) y el resto no cambia', () => {
    const g = construirEtiquetaGeneral({ ...base, total: null });
    expect(g.pago).toBeNull();
    expect(g).toMatchObject({ codigo: 'CP-9', who: 'Ana', total: null });
  });
  it('retrocompatible: un programa viejo ignora `pago` (los campos de siempre siguen)', () => {
    const { pago, ...resto } = construirEtiquetaGeneral({ ...base, pago_metodo: 'YAPE', pago_estado: 'PAGADO' });
    expect(pago).toBeDefined();
    expect(resto).toMatchObject({ tipo: 'ETIQUETA_GENERAL', codigo: 'CP-9', total: 30, printer: 'Etiquetera de caja' });
  });
});
