jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: { registerAsync: jest.fn().mockReturnValue({ module: class {} }) } }));

import { Reflector } from '@nestjs/core';
import { CLAVE_PERMISO, type PermisoRequerido } from '../../acceso/permiso.decorator';
import { DemandaController } from './demanda.controller';
import { VentasController } from '../ventas/ventas.controller';
import { DemandaService, MAX_PEDIDOS_DEMANDA, etapaDeAnulacion } from './demanda.service';

const AHORA = new Date('2026-11-11T20:00:00Z'); // 15:00 en Lima
const t = (min: number) => new Date(AHORA.getTime() + min * 60000);

function fila(id: number, extra: Record<string, unknown> = {}) {
  return {
    id: BigInt(id),
    estado: 'ENTREGADO',
    modalidad: 'RECOGER',
    creado_en: t(-120),
    eta_min: null,
    eta_max: null,
    salio_en: null,
    llego_en: null,
    entregado_en: t(-90),
    anulado_en: null,
    anulado_por: null,
    motivo_anulacion: null,
    pasa_cocina_en: t(-118),
    listo_en: t(-100),
    historial: [],
    ...extra,
  };
}

function servicio(filas: any[], comandas: any[] = [], areas: any[] = []) {
  const prisma: any = {
    pedido: { findMany: jest.fn(async () => filas) },
    person: { findMany: jest.fn(async () => [{ party_id: 7n, nombres: 'Ana', apellidos: 'Paz' }]) },
    areaCocina: { findMany: jest.fn(async () => areas) },
    comandaArea: { findMany: jest.fn(async () => comandas) },
  };
  const tiempos: any = { metas: jest.fn(async () => ({ cocina: 15 })) };
  return { s: new DemandaService(prisma, tiempos), prisma };
}

describe('Análisis › Demanda', () => {
  it('mapa de calor: cuenta por día de la semana (lunes primero) y hora de Lima, sin anulados', async () => {
    // 2026-11-11 es miércoles; 20:00Z = 15:00 Lima
    const { s } = servicio([fila(1, { creado_en: AHORA }), fila(2, { creado_en: AHORA }), fila(3, { creado_en: AHORA, estado: 'ANULADO' })]);
    const r = await s.resumen({}, AHORA);
    expect(r.mapa.dias[2]).toBe('Miércoles');
    expect(r.mapa.valores[2][15]).toBe(2);
    expect(r.mapa.pico).toEqual({ dia: 'Miércoles', hora: 15, pedidos: 2 });
    expect(r.pedidos).toEqual({ entran: 3, validos: 2 });
  });

  it('un pedido a las 23:30 de Lima cae en su día de Lima, no en el de UTC', async () => {
    const { s } = servicio([fila(1, { creado_en: new Date('2026-11-12T04:30:00Z') })]); // miércoles 23:30 Lima
    const r = await s.resumen({ desde: '2026-11-11', hasta: '2026-11-11' }, new Date('2026-11-12T10:00:00Z'));
    expect(r.mapa.valores[2][23]).toBe(1);
  });

  it('cumplimiento: delivery entregado dentro del máximo prometido cuenta; fuera no; sin promesa va aparte', async () => {
    const { s } = servicio([
      fila(1, { modalidad: 'DELIVERY', eta_min: 20, eta_max: 30, salio_en: t(-60), llego_en: t(-40) }), // 20 min: cumple
      fila(2, { modalidad: 'DELIVERY', eta_min: 20, eta_max: 30, salio_en: t(-60), llego_en: t(-20) }), // 40 min: tarde 10
      fila(3, { modalidad: 'DELIVERY' }), // sin promesa
      fila(4), // recoger: no se mide
      fila(5, { modalidad: 'DELIVERY', estado: 'EN_CAMINO', eta_max: 30, salio_en: t(-10) }), // aún no entregado
    ]);
    const r = await s.resumen({}, AHORA);
    expect(r.cumplimiento).toMatchObject({ evaluados: 2, cumplieron: 1, porcentaje: 50, retrasoPromedioMin: 10, deliverySinPromesa: 1, otrasModalidadesSinDato: 1, sinDato: false });
  });

  it('cumplimiento sin datos: porcentaje null y sinDato (nunca 0 inventado)', async () => {
    const { s } = servicio([fila(1)]);
    const r = await s.resumen({}, AHORA);
    expect(r.cumplimiento).toMatchObject({ evaluados: 0, porcentaje: null, sinDato: true, retrasoPromedioMin: null });
  });

  it('anulados: cantidad, %, motivos agrupados sin distinguir mayúsculas, etapa del historial y quién', async () => {
    const { s, prisma } = servicio([
      fila(1, { estado: 'ANULADO', motivo_anulacion: 'Cliente se arrepintió', anulado_por: 7n, anulado_en: t(-110), historial: [{ estado_anterior: 'PREPARANDO' }] }),
      fila(2, { estado: 'ANULADO', motivo_anulacion: ' cliente se arrepintió ', anulado_por: 7n, anulado_en: t(-100), historial: [{ estado_anterior: 'COLA' }] }),
      fila(3, { estado: 'ANULADO', motivo_anulacion: null, anulado_por: null, anulado_en: t(-100), listo_en: null, pasa_cocina_en: null }),
      fila(4),
    ]);
    const r = await s.resumen({}, AHORA);
    expect(r.anulados.n).toBe(3);
    expect(r.anulados.porcentaje).toBe(75);
    expect(r.anulados.motivos[0]).toMatchObject({ motivo: 'Cliente se arrepintió', n: 2 });
    expect(r.anulados.motivos[1]).toMatchObject({ motivo: 'Sin motivo escrito', n: 1 });
    expect(r.anulados.etapas.map((e) => e.etapa)).toEqual(expect.arrayContaining(['En preparación', 'En cola (antes de cocina)']));
    expect(r.anulados.quienes[0]).toEqual({ nombre: 'Ana Paz', n: 2 });
    expect(r.anulados.quienes[1]).toEqual({ nombre: 'Sin dato', n: 1 });
    expect(prisma.person.findMany).toHaveBeenCalledTimes(1);
  });

  it('etapa de anulación: sin historial se deduce de las horas guardadas', () => {
    expect(etapaDeAnulacion({ salio_en: t(-1) })).toBe('En camino');
    expect(etapaDeAnulacion({ listo_en: t(-1) })).toBe('Listo (sin entregar)');
    expect(etapaDeAnulacion({ pasa_cocina_en: t(-1) })).toBe('En preparación');
    expect(etapaDeAnulacion({})).toBe('En cola (antes de cocina)');
  });

  it('sin pedidos: todo vacío, sin porcentajes inventados y sin consultar personas', async () => {
    const { s, prisma } = servicio([]);
    const r = await s.resumen({}, AHORA);
    expect(r.anulados).toMatchObject({ n: 0, porcentaje: null, motivos: [], etapas: [], quienes: [] });
    expect(r.mapa.pico).toBeNull();
    expect(prisma.person.findMany).not.toHaveBeenCalled();
  });

  it('turno: usa la hora de Lima; truncado si pasa del tope', async () => {
    const { s } = servicio([fila(1, { creado_en: new Date('2026-11-11T14:00:00Z') }), fila(2, { creado_en: new Date('2026-11-11T23:30:00Z') })]);
    expect((await s.resumen({ turno: 'MANANA' }, AHORA)).pedidos.entran).toBe(1); // 09:00 Lima
    const muchas = Array.from({ length: MAX_PEDIDOS_DEMANDA + 1 }, (_, i) => fila(i + 1));
    const r = await servicio(muchas).s.resumen({}, AHORA);
    expect(r.truncado).toBe(true);
    expect(r.pedidos.entran).toBe(MAX_PEDIDOS_DEMANDA);
  });

  it('rechaza rangos inválidos: futuro, invertido y más de 92 días', async () => {
    const { s } = servicio([]);
    await expect(s.resumen({ desde: '2026-11-12', hasta: '2026-11-12' }, AHORA)).rejects.toMatchObject({ response: { codigo: 'FILTRO_INVALIDO' } });
    await expect(s.resumen({ desde: '2026-11-10', hasta: '2026-11-09' }, AHORA)).rejects.toMatchObject({ response: { codigo: 'FILTRO_INVALIDO' } });
    await expect(s.resumen({ desde: '2026-01-01', hasta: '2026-11-11' }, AHORA)).rejects.toMatchObject({ response: { codigo: 'FILTRO_INVALIDO' } });
  });

  it('carga en vivo: por área, con la más antigua y semáforo contra la meta de cocina; área sin cola = 0', async () => {
    const { s } = servicio(
      [],
      [
        { area_id: 1n, llego_en: t(-5) },
        { area_id: 1n, llego_en: t(-30) },
        { area_id: 2n, llego_en: t(-2) },
      ],
      [
        { id: 1n, nombre: 'Cocina' },
        { id: 2n, nombre: 'Barra' },
        { id: 3n, nombre: 'Postres' },
      ],
    );
    const r = await s.vivo(AHORA);
    expect(r.total).toBe(3);
    expect(r.areas.find((a) => a.nombre === 'Cocina')).toMatchObject({ enCola: 2, masAntiguaMin: 30, semaforo: 'rojo', meta: 15 });
    expect(r.areas.find((a) => a.nombre === 'Barra')).toMatchObject({ enCola: 1, semaforo: 'verde' });
    expect(r.areas.find((a) => a.nombre === 'Postres')).toMatchObject({ enCola: 0, masAntiguaMin: null });
  });
});

describe('Análisis › Demanda y Ventas: permisos', () => {
  const reflector = new Reflector();
  it.each([
    [DemandaController, 'resumen'],
    [DemandaController, 'vivo'],
    [VentasController, 'resumen'],
  ] as const)('%p.%s exige analisis/ver', (clase, metodo) => {
    expect(reflector.get<PermisoRequerido>(CLAVE_PERMISO, (clase.prototype as any)[metodo])).toEqual({ modulo: 'analisis', accion: 'ver' });
  });

  it('el controlador de Ventas pasa esAdmin según el rol del usuario', () => {
    const ventas: any = { resumen: jest.fn() };
    const c = new VentasController(ventas);
    c.resumen({}, { usuario: { rol: 'SUPERVISOR', roles: ['SUPERVISOR'] } });
    c.resumen({}, { usuario: { rol: 'ADMIN', roles: ['ADMIN'] } });
    c.resumen({}, {});
    expect(ventas.resumen.mock.calls.map((x: any[]) => x[1])).toEqual([false, true, false]);
  });
});
