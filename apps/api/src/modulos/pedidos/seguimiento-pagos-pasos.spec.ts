import { pagosDelPedido, SeguimientoService } from './seguimiento.service';
import { generarTokenSeguimiento } from './seguimiento.tokens';

const T0 = new Date('2026-10-23T17:00:00Z');
const v = (extra: Record<string, unknown> = {}) => ({
  medio: 'YAPE' as string | null,
  semaforo: 'CONFIABLE',
  motivos: [] as string[],
  creado_en: T0,
  revisado_en: null as Date | null,
  ...extra,
});

describe('pagosDelPedido: un renglón por medio', () => {
  const plan = [
    { medio: 'YAPE', monto: 20 },
    { medio: 'PLIN', monto: 15 },
    { medio: 'EFECTIVO', monto: 7.5 },
  ];
  const base = { plan, medioPreferido: 'YAPE', total: 42.5, pagado: false, cobradoPorMozo: false };

  it('subir la captura de Yape no marca el Plin como pagado', () => {
    const r = pagosDelPedido({ ...base, vouchers: [v({ medio: 'YAPE', revisado_en: T0 })] });
    expect(r.map((f) => [f.medio, f.estado])).toEqual([
      ['YAPE', 'VERIFICADO'],
      ['PLIN', 'SIN_VOUCHER'],
      ['EFECTIVO', 'AL_RECIBIR'],
    ]);
  });

  it('cada medio con su propio estado: en revisión, rechazada (ilegible) y sin captura', () => {
    const r = pagosDelPedido({
      ...base,
      vouchers: [v({ medio: 'PLIN', semaforo: 'ILEGIBLE', motivos: ['Borrosa'] }), v({ medio: 'YAPE' })],
    });
    expect(r.find((f) => f.medio === 'YAPE')?.estado).toBe('EN_REVISION');
    expect(r.find((f) => f.medio === 'PLIN')).toMatchObject({ estado: 'RECHAZADO', motivo: 'Borrosa' });
  });

  it('una captura sin medio (WhatsApp) cubre al primer medio digital sin captura', () => {
    const r = pagosDelPedido({ ...base, vouchers: [v({ medio: null })] });
    expect(r.map((f) => f.estado)).toEqual(['EN_REVISION', 'SIN_VOUCHER', 'AL_RECIBIR']);
  });

  it('pedido PAGADO por Caja o cobrado por mozo', () => {
    expect(pagosDelPedido({ ...base, pagado: true, vouchers: [] }).map((f) => f.estado)).toEqual(['VERIFICADO', 'VERIFICADO', 'PAGADO']);
    expect(pagosDelPedido({ ...base, cobradoPorMozo: true, vouchers: [] }).map((f) => f.estado)).toEqual(['SIN_VOUCHER', 'SIN_VOUCHER', 'COBRADO_MOZO']);
  });

  it('sin plan: el medio del pedido por el total; efectivo no lleva captura', () => {
    expect(pagosDelPedido({ ...base, plan: [], vouchers: [] })).toMatchObject([{ medio: 'YAPE', monto: 42.5, estado: 'SIN_VOUCHER' }]);
    expect(pagosDelPedido({ ...base, plan: [], medioPreferido: 'EFECTIVO', vouchers: [] })).toMatchObject([{ digital: false, estado: 'AL_RECIBIR' }]);
  });
});

describe('SeguimientoService: pasos por modalidad y pago dividido', () => {
  let service: SeguimientoService;
  let prisma: any;
  const comanda = (estado: string) => ({ area_id: 1n, estado, area: { nombre: 'Cocina' } });
  const pedido = (extra: Record<string, unknown> = {}) => ({
    id: 7n,
    codigo: 'CAP-0007',
    estado: 'PREPARANDO',
    modalidad: 'DELIVERY',
    total: { toString: () => '42.50' },
    subtotal: { toString: () => '40.00' },
    descuento: { toString: () => '0' },
    envio: null,
    creado_en: T0,
    pasa_cocina_en: T0,
    listo_en: null,
    despachado_en: null,
    entregado_en: null,
    historial: [],
    pago_preferido: 'YAPE',
    pago_estado: 'PENDIENTE',
    comandas: [comanda('DESPEJADA')],
    lineas: [{ nombre: 'Waffle', cantidad: 1, nota: 'Sin crema', area_id: 1n }],
    planPago: [
      { medio: 'YAPE', monto: 20 },
      { medio: 'PLIN', monto: 22.5 },
    ],
    ...extra,
  });
  const obtener = (p: Record<string, unknown>, vouchers: unknown[] = []) => {
    prisma.pedido.findUnique.mockResolvedValue(p);
    prisma.voucherPago.findMany.mockResolvedValue(vouchers);
    return service.obtener('CAP-0007', generarTokenSeguimiento(7n));
  };
  const actual = (r: { pasos: { clave: string; actual: boolean }[] }) => r.pasos.find((p) => p.actual)?.clave;

  beforeEach(() => {
    prisma = { pedido: { findUnique: jest.fn() }, voucherPago: { findMany: jest.fn() } };
    service = new SeguimientoService(prisma);
  });

  it('delivery con todas las áreas listas pero sin el aviso LISTO: sigue en preparación y el progreso lo marca 100 %', async () => {
    const r = await obtener(pedido());
    expect(actual(r)).toBe('cocina');
    expect(r.progreso.listasDe).toBe(r.progreso.totalAreas);
  });

  it('con estado LISTO el paso actual es «Listo, esperando repartidor»', async () => {
    const r = await obtener(pedido({ estado: 'LISTO' }));
    expect(actual(r)).toBe('listo');
    expect(r.pasos.find((p) => p.clave === 'listo')?.etiqueta).toBe('Listo, esperando repartidor');
  });

  it('lo que ve el cliente coincide con el admin: mismo progreso y pago según pago_estado', async () => {
    const { progresoDelPedido } = await import('./progreso-pedido');
    for (const modalidad of ['DELIVERY', 'RECOGER', 'COMER_LOCAL']) {
      for (const estado of ['COLA', 'PREPARANDO', 'LISTO', 'ANULADO']) {
        for (const pagoEstado of ['PENDIENTE', 'PAGADO']) {
          for (const vs of [[], [v({ medio: 'YAPE' })], [v({ medio: 'YAPE', semaforo: 'ILEGIBLE' })], [v({ medio: 'YAPE', revisado_en: T0 })]]) {
            const p = pedido({ modalidad, estado, pago_estado: pagoEstado, pago_preferido: 'YAPE', planPago: [] });
            const r = await obtener(p, vs);
            expect(r.progreso.etapa).toBe(progresoDelPedido(p as never, { ahora: new Date() }).etapa);
            const pagoYape = r.resumenPago!.pagos[0];
            if (pagoEstado === 'PAGADO') expect(pagoYape.estado).toBe('VERIFICADO');
            if (pagoEstado === 'PENDIENTE' && vs.length === 0) expect(pagoYape.estado).toBe('SIN_VOUCHER');
            if (vs.length && (vs[0] as { semaforo: string }).semaforo === 'ILEGIBLE' && pagoEstado === 'PENDIENTE') expect(pagoYape.estado).toBe('RECHAZADO');
          }
        }
      }
    }
  });

  it('delivery con cocina a medias sigue en preparación', async () => {
    const r = await obtener(pedido({ comandas: [comanda('DESPEJADA'), { ...comanda('PENDIENTE'), area_id: 2n }] }));
    expect(actual(r)).toBe('cocina');
  });

  it('recoger: Listo para recoger y Recogido', async () => {
    const r = await obtener(pedido({ modalidad: 'RECOGER', estado: 'LISTO' }));
    expect(r.pasos.map((p) => p.etiqueta)).toEqual(['Pedido recibido', 'En preparación', 'Listo para recoger', 'Recogido']);
    expect(actual(r)).toBe('listo');
  });

  it('comer en el local: servido en tu mesa al marcar entregado_mesa_en, sin retroceder', async () => {
    const mesa = pedido({ modalidad: 'COMER_LOCAL', estado: 'LISTO' });
    expect((await obtener(mesa)).pasos.map((p) => p.etiqueta)).toEqual(['Pedido recibido', 'En preparación', 'Listo para servir', 'Servido en tu mesa']);
    const servido = await obtener({ ...mesa, entregado_mesa_en: new Date('2026-10-23T17:30:00Z') });
    expect(actual(servido)).toBe('entregado');
    expect(servido.pasos.every((p) => p.hecho)).toBe(true);
    expect(servido.pasos[3].hora).toBe('12:30');
  });

  it('pago dividido: Yape validado y Plin sin captura, resumen «pagado 20 de 42.50», voucher agregado sin verificar', async () => {
    const r = await obtener(pedido(), [v({ medio: 'YAPE', revisado_en: T0 })]);
    expect(r.resumenPago?.pagado).toBe(20);
    expect(r.resumenPago?.total).toBe(42.5);
    expect(r.resumenPago?.pagos.map((f) => [f.medio, f.monto, f.estado])).toEqual([
      ['YAPE', 20, 'VERIFICADO'],
      ['PLIN', 22.5, 'SIN_VOUCHER'],
    ]);
    expect(r.voucher?.estado).toBe('SIN_VOUCHER');
    expect(r.detalle?.lineas).toEqual([{ nombre: 'Waffle', cantidad: 1, nota: 'Sin crema' }]);
  });

  it('pedido en efectivo: resumen sin captura y sin bloque voucher', async () => {
    const r = await obtener(pedido({ pago_preferido: 'EFECTIVO', planPago: [] }));
    expect(r.voucher).toBeUndefined();
    expect(r.resumenPago?.pagos).toMatchObject([{ medio: 'EFECTIVO', estado: 'AL_RECIBIR', monto: 42.5 }]);
  });
});
