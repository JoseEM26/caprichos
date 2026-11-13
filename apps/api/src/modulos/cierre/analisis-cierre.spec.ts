jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn() } }));

import { analizarCaja, combinaciones, DatosAnalisis } from './analisis-cierre';
import { AnalisisCierreService } from './analisis-cierre.service';
import { CierreController } from './cierre.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';

const inicio = new Date('2026-10-20T05:00:00.000Z');
const medio = (m: string, sistema: number, visto: number) => ({ medio: m, sistema, visto, diferencia: Math.round((visto - sistema) * 100) / 100 });
const base = (o: Partial<DatosAnalisis> = {}): DatosAnalisis => ({
  medios: [medio('EFECTIVO', 100, 100), medio('YAPE', 50, 50), medio('PLIN', 0, 0), medio('TRANSFERENCIA', 0, 0), medio('TARJETA', 0, 0)],
  conteoTotal: null,
  cobros: [],
  anuladosPagados: [],
  movimientos: [],
  delivery: { pendientes: [], liquidaciones: [], repartidoresPorLiquidar: 0 },
  credito: [],
  inicioDia: inicio,
  ...o,
});
const codigos = (d: DatosAnalisis) => analizarCaja(d).patrones.map((p) => p.codigo);

describe('analizarCaja: ejemplo sintético (sobra en todos los medios)', () => {
  const d = base({
    medios: [medio('EFECTIVO', 621.9, 643.5), medio('YAPE', 1604.2, 1637.8), medio('PLIN', 0, 0), medio('TRANSFERENCIA', 0, 0), medio('TARJETA', 451.8, 495.8)],
    anuladosPagados: [{ codigo: 'P-001', pagoEstado: 'PAGADO', pagoMetodo: 'YAPE', total: 32, cobros: [] }],
    cobros: [
      { pedidoCodigo: 'P-002', pedidoCreadoEn: inicio, en: new Date('2026-10-20T19:00:00Z'), anuladoEn: new Date('2026-10-20T20:00:00Z'), pagos: [{ medio: 'YAPE', monto: 15, propina: 0 }] },
      { pedidoCodigo: 'P-002', pedidoCreadoEn: inicio, en: new Date('2026-10-20T20:05:00Z'), anuladoEn: null, pagos: [{ medio: 'YAPE', monto: 15.5, propina: 0 }] },
    ],
    movimientos: [{ tipo: 'EGRESO', monto: 20, motivo: 'Hielo', anulado: false }, { tipo: 'EGRESO', monto: 5, motivo: 'Bolsas', anulado: true }],
  });
  const r = analizarCaja(d);

  it('total de diferencias +99.20 y patrón de sobrante en todos los medios', () => {
    expect(r.totalDiferencia).toBe(99.2);
    expect(r.patrones.map((p) => p.codigo)).toEqual(expect.arrayContaining(['DINERO_SIN_COBRO', 'ANULADOS_CON_PAGO', 'COBROS_ANULADOS', 'MOVIMIENTOS']));
    expect(r.patrones.map((p) => p.codigo)).not.toContain('MALA_CLASIFICACION');
  });
  it('lista el pedido anulado pagado por Yape con su monto', () => {
    const a = r.patrones.find((p) => p.codigo === 'ANULADOS_CON_PAGO')!;
    expect(a.pedidos).toEqual([expect.objectContaining({ codigo: 'P-001', monto: 32 })]);
    expect(a.pedidos![0].detalle).toContain('Yape');
    expect(a.explicacion).toContain('posible causa');
  });
  it('lista el cobro anulado de 15.00 con su hora de Lima', () => {
    const c = r.patrones.find((p) => p.codigo === 'COBROS_ANULADOS')!;
    expect(c.pedidos).toEqual([expect.objectContaining({ codigo: 'P-002', monto: 15 })]);
    expect(c.pedidos![0].detalle).toContain('15:00');
  });
  it('trae ayuda general por medio', () => {
    expect(r.ayudaGeneral.map((a) => a.medio)).toEqual(expect.arrayContaining(['EFECTIVO', 'YAPE / PLIN']));
  });
});

describe('analizarCaja: detectores', () => {
  it('mala clasificación: efectivo −71.50 y digitales +72.50', () => {
    const d = base({ medios: [medio('EFECTIVO', 200, 128.5), medio('YAPE', 100, 172.5)] });
    expect(codigos(d)).toContain('MALA_CLASIFICACION');
    expect(codigos(d)).not.toContain('DINERO_SIN_COBRO');
  });
  it('no es mala clasificación si no se compensan', () => {
    expect(codigos(base({ medios: [medio('EFECTIVO', 200, 128.5), medio('YAPE', 100, 120)] }))).not.toContain('MALA_CLASIFICACION');
  });
  it('un cierre cuadrado no genera hallazgos de diferencia', () => {
    expect(codigos(base())).toEqual([]);
  });
  it('propinas por medio', () => {
    const d = base({ cobros: [{ pedidoCodigo: 'P-1', pedidoCreadoEn: inicio, en: inicio, anuladoEn: null, pagos: [{ medio: 'YAPE', monto: 10, propina: 2 }] }] });
    const p = analizarCaja(d).patrones.find((x) => x.codigo === 'PROPINAS')!;
    expect(p.montoRelacionado).toBe(2);
  });
  it('delivery, crédito del personal, corte de hora, redondeo y conteo', () => {
    const d = base({
      medios: [medio('EFECTIVO', 100, 99.5)],
      conteoTotal: 98,
      delivery: { pendientes: [{ codigo: 'D-1', monto: 30 }], liquidaciones: [{ esperado: 20, entregado: 18 }], repartidoresPorLiquidar: 1 },
      credito: [{ codigo: 'C-1', monto: 12 }],
      cobros: [{ pedidoCodigo: 'V-1', pedidoCreadoEn: new Date('2026-10-19T12:00:00Z'), en: new Date('2026-10-20T15:00:00Z'), anuladoEn: null, pagos: [{ medio: 'EFECTIVO', monto: 8, propina: 0 }] }],
    });
    expect(codigos(d)).toEqual(expect.arrayContaining(['DELIVERY', 'CREDITO_PERSONAL', 'CORTE_DE_HORA', 'VUELTO_REDONDEO', 'CONTEO_DISTINTO']));
  });
  it('pedido anulado sin pago ni cobro no se acusa', () => {
    expect(codigos(base({ anuladosPagados: [{ codigo: 'A-1', pagoEstado: 'PENDIENTE', pagoMetodo: null, total: 10, cobros: [] }] }))).not.toContain('ANULADOS_CON_PAGO');
  });
  it('sugerencias: un anulado de 32.00 explica el sobrante de Yape 32.05', () => {
    const d = base({
      medios: [medio('YAPE', 100, 132.05)],
      anuladosPagados: [{ codigo: 'P-9', pagoEstado: 'PAGADO', pagoMetodo: 'YAPE', total: 32, cobros: [] }],
    });
    const r = analizarCaja(d);
    expect(r.sugerencias[0].texto).toContain('coincide con el pedido anulado P-9');
    expect(r.patrones.find((p) => p.codigo === 'ANULADOS_CON_PAGO')!.pedidos![0].detalle).toContain('coincide con la diferencia');
  });
  it('combinaciones de hasta 3, deterministas', () => {
    const items = [10, 20, 5.5, 7].map((v, i) => ({ etiqueta: `i${i}`, c: Math.round(v * 100) }));
    expect(combinaciones(items, 3550)).toEqual([['i0', 'i1', 'i2']]);
    expect(combinaciones(items, 3550)).toEqual(combinaciones(items, 3550));
    expect(combinaciones(items, 99999)).toEqual([]);
  });
});

describe('AnalisisCierreService', () => {
  const admin = { partyId: 1n, rol: 'ADMIN' } as any;
  const cajero = { partyId: 2n, rol: 'CAJERO' } as any;
  const caja = { id: 7n, fecha: new Date('2026-10-20T00:00:00Z'), apertura: 100 };

  it('el análisis es solo para el administrador', async () => {
    const svc = new AnalisisCierreService({} as any, {} as any);
    await expect(svc.analizar('7', cajero)).rejects.toMatchObject({ response: { codigo: 'SOLO_ADMIN' } });
  });

  it('analiza un cierre guardado con datos sintéticos', async () => {
    const prisma: any = {
      caja: {
        findUnique: jest.fn().mockResolvedValue({
          ...caja,
          cierre: {
            conteo: { '100': 2 },
            medios: [
              { medio: 'EFECTIVO', sistema: 150, visto: 200, diferencia: 50 },
              { medio: 'YAPE', sistema: 40, visto: 72, diferencia: 32 },
            ],
          },
        }),
      },
      cobro: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: {
        findMany: jest.fn().mockImplementation(async (a: any) =>
          a.where.estado === 'ANULADO' ? [{ codigo: 'A-1', pago_estado: 'PAGADO', pago_metodo: 'YAPE', total: 32, monto_credito: 0, cobros: [] }] : [],
        ),
      },
      movimientoCaja: { findMany: jest.fn().mockResolvedValue([]) },
      liquidacion: { findMany: jest.fn().mockResolvedValue([]) },
      conteoCierre: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const r: any = await new AnalisisCierreService(prisma, {} as any).analizar('7', admin);
    expect(r.cerrada).toBe(true);
    expect(r.totalDiferencia).toBe(82);
    expect(r.patrones.map((p: any) => p.codigo)).toEqual(expect.arrayContaining(['ANULADOS_CON_PAGO', 'DINERO_SIN_COBRO']));
  });

  describe('guía para quien cierra (DT-61)', () => {
    const prisma: any = {
      pedido: { findMany: jest.fn().mockResolvedValue([{ codigo: 'A-1', pago_estado: 'PAGADO', pago_metodo: 'YAPE', total: 32, monto_credito: 0, cobros: [] }]) },
      cobro: { findMany: jest.fn().mockResolvedValue([{ pedido: { codigo: 'P-2' }, pagos: [{ medio: 'yape', monto: 15, propina: 0 }], anulado_en: new Date('2026-10-20T20:00:00Z') }]) },
      movimientoCaja: { findMany: jest.fn().mockResolvedValue([{ tipo: 'EGRESO', monto: 10, motivo: 'Hielo', anulado_en: null }]) },
      cobroPago: { groupBy: jest.fn().mockResolvedValue([{ medio: 'YAPE', _count: { _all: 3 } }]) },
    };
    const cierre: any = {
      obtenerCajaAbierta: jest.fn().mockResolvedValue(caja),
      listarPendientesDeCobro: jest.fn().mockResolvedValue([{ codigo: 'Q-1', estado: 'LISTO', total: 20 }]),
      listarRepartidoresPorLiquidar: jest.fn().mockResolvedValue([{ nombre: 'Rep Uno', pedidos: [{}, {}], totalCobrado: 80, totalLiquidado: 0, pendiente: 80 }]),
    };

    it('devuelve solo operaciones propias, cantidades y la lista fija', async () => {
      const r: any = await new AnalisisCierreService(prisma, cierre).guiaRevision();
      expect(r.anuladosConPago).toEqual([{ codigo: 'A-1', medio: 'YAPE', monto: 32 }]);
      expect(r.cobrosAnulados[0]).toMatchObject({ codigo: 'P-2', monto: 15 });
      expect(r.propinasPorMedio).toEqual([{ medio: 'YAPE', cantidad: 3 }]);
      expect(r.repartidoresPorLiquidar).toEqual([{ nombre: 'Rep Uno', pedidos: 2 }]);
      expect(r.lista.length).toBeGreaterThanOrEqual(7);
    });

    it('nunca filtra esperado, sistema, visto, diferencia ni montos del repartidor', async () => {
      const r = await new AnalisisCierreService(prisma, cierre).guiaRevision();
      const json = JSON.stringify(r).toLowerCase();
      for (const prohibido of ['esperado', 'sistema', 'visto', 'diferencia', 'sobrante', 'faltante', 'totalcobrado']) {
        expect(json).not.toContain(prohibido);
      }
      expect(Object.keys(r).sort()).toEqual(['anuladosConPago', 'cajaId', 'cobrosAnulados', 'lista', 'movimientos', 'pendientesDeCobro', 'propinasPorMedio', 'repartidoresPorLiquidar']);
    });
  });
});

describe('permisos del controlador', () => {
  const permiso = (metodo: string) => Reflect.getMetadata(CLAVE_PERMISO, (CierreController.prototype as any)[metodo]);
  it('la guía la usa quien cierra (caja/cerrar); el análisis pide caja/ver y el servicio exige ADMIN', () => {
    expect(permiso('guiaRevision')).toEqual({ modulo: 'caja', accion: 'cerrar' });
    expect(permiso('analizar')).toEqual({ modulo: 'caja', accion: 'ver' });
  });
});
