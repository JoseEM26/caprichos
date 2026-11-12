jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { register: jest.fn().mockReturnValue({ module: class {} }), registerAsync: jest.fn().mockReturnValue({ module: class {} }) } }));

import { BadRequestException } from '@nestjs/common';
import { EquipoService, MAX_FILAS_HUECOS } from './equipo.service';

const AHORA = new Date('2026-11-11T20:00:00Z');
const t = (min: number) => new Date(AHORA.getTime() + min * 60000);

function servicio(opts: { jornadas?: Array<{ estado: string; tardanza?: number; entrada?: boolean }>; mozo?: any[]; cobros?: any[]; entregados?: any[]; sinCobrar?: any[]; sinTerminar?: any[] } = {}) {
  const prisma: any = {
    pedido: { findMany: jest.fn(async (a: any) => (a.where.estado === 'ENTREGADO' ? (opts.entregados ?? []) : (opts.mozo ?? []))) },
    cobro: { findMany: jest.fn(async () => opts.cobros ?? []) },
    person: { findMany: jest.fn(async () => [{ party_id: 5n, nombres: 'Ana', apellidos: 'Mozo' }, { party_id: 6n, nombres: 'Caro', apellidos: 'Caja' }]) },
  };
  const js = opts.jornadas ?? [];
  const asistencia: any = {
    obtenerConfig: jest.fn(async () => ({})),
    cargarContexto: jest.fn(async () => ({})),
    partesConActividad: jest.fn(() => new Set([5n])),
    evaluarDia: jest.fn(() => {
      const j = js.shift();
      if (!j) return { turno: null, interp: { marcas: [], entrada: null }, resultado: { estado: 'DESCANSO', tardanzaMin: 0, trabajadaMin: 0 } };
      return { turno: {}, interp: { marcas: [{}], entrada: j.entrada === false ? null : {} }, resultado: { estado: j.estado, tardanzaMin: j.tardanza ?? 0, trabajadaMin: 480 } };
    }),
  };
  const correcciones: any = { rolesPorPersona: jest.fn(async () => new Map([[5n, ['MOZO']]])) };
  const cierre: any = {
    listarPendientesDeCobro: jest.fn(async () => opts.sinCobrar ?? []),
    pedidosSinTerminar: jest.fn(async () => opts.sinTerminar ?? []),
  };
  return { s: new EquipoService(prisma, asistencia, correcciones, cierre), prisma, cierre };
}

const pedMozo = (quien: bigint | null, total: number, min: number) => ({
  total,
  creado_en: t(-120),
  entregado_mesa_en: t(-120 + min),
  entregado_en: null,
  historial: quien == null ? [] : [{ por_party_id: quien }],
});

describe('Análisis › Equipo', () => {
  it('puntualidad: tardanzas y faltas por día, agregado para el supervisor', async () => {
    const { s } = servicio({ jornadas: [{ estado: 'CUMPLIO' }, { estado: 'TARDANZA', tardanza: 12 }, { estado: 'FALTA', entrada: false }] });
    const r = await s.resumen({ desde: '2026-11-09', hasta: '2026-11-11' }, false, AHORA);
    expect(r.asistencia.porDia).toHaveLength(3);
    expect(r.asistencia.totales).toMatchObject({ presentes: 2, tardanzas: 1, faltas: 1, minutosTarde: 12, puntualidadPct: 50 });
    expect(r.personas).toBeNull();
    expect(r.porPersonaVisible).toBe(false);
  });

  it('sin asistencia: puntualidad null (no 100% inventado)', async () => {
    const { s } = servicio();
    const r = await s.resumen({}, true, AHORA);
    expect(r.asistencia.totales.puntualidadPct).toBeNull();
    expect(r.asistencia.porDia).toEqual([]);
  });

  it('productividad: pedidos, ticket promedio y minutos de mozos y cajeros', async () => {
    const { s } = servicio({
      mozo: [pedMozo(5n, 40, 30), pedMozo(5n, 60, 50), pedMozo(null, 99, 10)],
      cobros: [
        { cobrado_por: 6n, total: 30, en: t(-100), pedido: { creado_en: t(-110) } },
        { cobrado_por: 6n, total: 50, en: t(-60), pedido: { creado_en: t(-90) } },
      ],
    });
    const r = await s.resumen({}, true, AHORA);
    expect(r.productividad.mozos).toMatchObject({ personas: 1, pedidos: 2, ticketPromedio: 50, minutosPromedio: 40 });
    expect(r.productividad.cajeros).toMatchObject({ pedidos: 2, ticketPromedio: 40, minutosPromedio: 20 });
  });

  it('el admin ve nombres por persona; el supervisor no y ni se consultan', async () => {
    const datos = { mozo: [pedMozo(5n, 40, 30)], cobros: [{ cobrado_por: 6n, total: 30, en: t(-100), pedido: { creado_en: t(-110) } }], jornadas: [{ estado: 'TARDANZA', tardanza: 5 }] };
    const admin = servicio(datos);
    const ra = await admin.s.resumen({}, true, AHORA);
    expect((ra.personas as any).mozos[0].nombre).toBe('Ana Mozo');
    expect((ra.personas as any).cajeros[0].nombre).toBe('Caro Caja');
    expect((ra.personas as any).asistencia[0]).toMatchObject({ nombre: 'Ana Mozo', tardanzas: 1 });
    const sup = servicio(datos);
    const rs = await sup.s.resumen({}, false, AHORA);
    expect(JSON.stringify(rs)).not.toMatch(/Ana|Caro/);
    expect(sup.prisma.person.findMany).not.toHaveBeenCalled();
  });

  it('rango inválido → 400', async () => {
    const { s } = servicio();
    await expect(s.resumen({ desde: '2026-11-10', hasta: '2026-11-01' }, true, AHORA)).rejects.toBeInstanceOf(BadRequestException);
    await expect(s.resumen({ desde: '2026-01-01', hasta: '2026-11-11' }, true, AHORA)).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('tablero de huecos', () => {
    const hueco = (i: number) => ({ id: i, codigo: `CP-${i}`, canal: 'CAJA', modalidad: 'RECOGER', estado: 'LISTO', pagoEstado: 'PENDIENTE', total: 10, fecha: t(-i) });

    it('reutiliza las listas del Cierre y limita las filas con el total real', async () => {
      const muchos = Array.from({ length: MAX_FILAS_HUECOS + 5 }, (_, i) => hueco(i + 1));
      const { s, cierre } = servicio({ sinCobrar: muchos, sinTerminar: [hueco(1)] });
      const r = await s.huecos(AHORA);
      expect(cierre.listarPendientesDeCobro).toHaveBeenCalled();
      expect(cierre.pedidosSinTerminar).toHaveBeenCalled();
      expect(r.sinCobrar.total).toBe(MAX_FILAS_HUECOS + 5);
      expect(r.sinCobrar.items).toHaveLength(MAX_FILAS_HUECOS);
      expect(r.sinCobrar.antiguo).toEqual(t(-(MAX_FILAS_HUECOS + 5)));
      expect(r.sinTerminar.total).toBe(1);
    });

    it('entregados sin cobrar: solo los que la regla de cobro exige (recoger sí, mesa no, personal no)', async () => {
      const base = { canal: 'CAJA', estado: 'ENTREGADO', pago_estado: 'PENDIENTE', pago_metodo: null, es_personal: false, total: 20, creado_en: t(-300), planPago: [] };
      const { s } = servicio({
        entregados: [
          { id: 1n, codigo: 'A', modalidad: 'RECOGER', ...base },
          { id: 2n, codigo: 'B', modalidad: 'MESA', ...base },
          { id: 3n, codigo: 'C', modalidad: 'RECOGER', ...base, es_personal: true },
        ],
      });
      const r = await s.huecos(AHORA);
      expect(r.entregadosSinCobrar.items.map((x) => x.codigo)).toEqual(['A']);
    });

    it('todo en orden: listas vacías y sin fecha antigua', async () => {
      const { s } = servicio();
      const r = await s.huecos(AHORA);
      expect(r.sinCobrar).toEqual({ total: 0, antiguo: null, items: [] });
      expect(r.entregadosSinCobrar.total).toBe(0);
    });
  });
});
