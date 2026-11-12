import { BadRequestException } from '@nestjs/common';
import { ClientesAnalisisService, MAX_CLIENTES_ANALISIS } from './clientes.service';

const AHORA = new Date('2026-11-11T20:00:00Z');

/** $queryRaw se responde según un trozo del SQL (la clave); lo que no coincide devuelve una lista vacía. */
function servicio(respuestas: Record<string, any[]>, extra: Record<string, any> = {}) {
  const queryRaw = jest.fn(async (strings: TemplateStringsArray) => {
    const sql = strings.join('?');
    const clave = Object.keys(respuestas).find((k) => sql.includes(k));
    return clave ? respuestas[clave] : [];
  });
  const prisma: any = {
    $queryRaw: queryRaw,
    encuestaPosventa: { count: jest.fn(async () => extra.enviadas ?? 0) },
    resenaGoogle: { aggregate: jest.fn(async () => extra.google ?? { _avg: { calificacion: null }, _count: { _all: 0 } }) },
  };
  return { s: new ClientesAnalisisService(prisma), prisma };
}

describe('ClientesAnalisisService.resumen', () => {
  it('cuenta nuevos y recurrentes, separa los pedidos sin identificar y arma las semanas', async () => {
    const { s } = servicio({
      'MIN(creado_en) OVER': [
        { sin_id: false, nuevo: true, pedidos: 1, semana: '2026-11-09' },
        { sin_id: false, nuevo: false, pedidos: 2, semana: '2026-11-09' },
        { sin_id: false, nuevo: false, pedidos: 1, semana: '2026-11-02' },
        { sin_id: true, nuevo: true, pedidos: 4, semana: '2026-11-09' },
      ],
      percentile_cont: [{ n: 3, mediana: 6.04, p90: 20, t1: 2, t2: 0, t3: 1, t4: 0 }],
    });
    const r = await s.resumen({ desde: '2026-11-02', hasta: '2026-11-11' }, AHORA);
    expect(r.clientes).toEqual({ total: 3, nuevos: 1, recurrentes: 2, pctRecurrentes: 66.7, pedidosSinIdentificar: 4 });
    expect(r.semanas).toEqual([
      { semana: '2026-11-02', nuevos: 0, recurrentes: 1 },
      { semana: '2026-11-09', nuevos: 1, recurrentes: 1 },
    ]);
    expect(r.regreso).toMatchObject({ n: 3, medianaDias: 6, p90Dias: 20 });
    expect(r.regreso.tramos.map((t) => t.n)).toEqual([2, 0, 1, 0]);
    expect(r.truncado).toBe(false);
  });

  it('sin pedidos: ceros, porcentajes y medianas nulos (nunca un cero inventado)', async () => {
    const { s } = servicio({});
    const r = await s.resumen({}, AHORA);
    expect(r.clientes).toMatchObject({ total: 0, pctRecurrentes: null });
    expect(r.regreso).toMatchObject({ n: 0, medianaDias: null, p90Dias: null });
    expect(r.embudo.pasos.map((p) => p.n)).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(r.embudo.pasos[1].pctDelAnterior).toBeNull();
    expect(r.embudo.sinDatosAntesDe).toBeNull();
    expect(r.puntos).toMatchObject({ emitidos: 0, canjeados: 0, pctCanjeado: null, saldoVivo: 0 });
    expect(r.calificaciones.encuestas).toMatchObject({ enviadas: 0, respondidas: 0, promedio: null, pctRespuesta: null });
    expect(r.calificaciones.google).toEqual({ n: 0, promedio: null });
  });

  it('avisa cuando se pasa del tope de clientes', async () => {
    const filas = Array.from({ length: MAX_CLIENTES_ANALISIS + 1 }, () => ({ sin_id: false, nuevo: true, pedidos: 1, semana: '2026-11-09' }));
    const { s } = servicio({ 'MIN(creado_en) OVER': filas });
    const r = await s.resumen({}, AHORA);
    expect(r.truncado).toBe(true);
    expect(r.clientes.total).toBe(MAX_CLIENTES_ANALISIS);
  });

  it('el embudo de la carta: cada sesión cuenta en su etapa más alta y en las anteriores, con % y caída por etapa', async () => {
    const { s } = servicio({
      array_agg: [
        { dispositivo: 'MOVIL', con_sesion: false, rango: 1, n: 50 }, // solo visitó
        { dispositivo: 'MOVIL', con_sesion: true, rango: 2, n: 20 }, // llegó al carrito
        { dispositivo: 'ESCRITORIO', con_sesion: false, rango: 3, n: 10 },
        { dispositivo: 'ESCRITORIO', con_sesion: true, rango: 4, n: 20 },
      ],
      'LEFT JOIN carta_evento': [
        { dispositivo: 'MOVIL', con_sesion: true, medido: true, creados: 10, pagados: 8, entregados: 6, anulados: 1 },
        { dispositivo: 'ESCRITORIO', con_sesion: false, medido: true, creados: 5, pagados: 4, entregados: 4, anulados: 0 },
        { dispositivo: 'DESCONOCIDO', con_sesion: false, medido: false, creados: 7, pagados: 7, entregados: 7, anulados: 2 },
      ],
      'AS primero': [{ primero: new Date('2026-11-05T15:00:00Z') }],
    });
    const r = await s.resumen({ desde: '2026-11-02', hasta: '2026-11-11' }, AHORA);
    expect(r.embudo.pasos.map((p) => p.n)).toEqual([100, 50, 30, 20, 15, 12, 10]);
    expect(r.embudo.pasos[1]).toMatchObject({ id: 'carrito', pctDelAnterior: 50, pctDeVisitas: 50, caida: 50, pctCaida: 50 });
    expect(r.embudo.pasos[4]).toMatchObject({ id: 'creado', pctDelAnterior: 75, caida: 5, movil: 10, escritorio: 5, conSesion: 10, sinSesion: 5 });
    expect(r.embudo.pasos[0]).toMatchObject({ movil: 70, escritorio: 30, conSesion: 40, sinSesion: 60, caida: null, pctCaida: null });
    expect(r.embudo.pedidosSinMedir).toBe(7);
    expect(r.embudo.anulados).toBe(3);
    expect(r.embudo.sinDatosAntesDe).toBe('2026-11-05');
    expect(r.embudo.rangoParcial).toBe(true);
  });

  it('el embudo no es parcial si todo el rango es posterior al primer evento', async () => {
    const { s } = servicio({ 'AS primero': [{ primero: new Date('2026-10-01T15:00:00Z') }] });
    const r = await s.resumen({ desde: '2026-11-02', hasta: '2026-11-11' }, AHORA);
    expect(r.embudo.rangoParcial).toBe(false);
  });

  it('el embudo no expone celulares ni ids de sesión', async () => {
    const { s } = servicio({ array_agg: [{ dispositivo: 'MOVIL', con_sesion: false, rango: 1, n: 1 }] });
    const r = await s.resumen({}, AHORA);
    expect(JSON.stringify(r.embudo)).not.toMatch(/telefono|sesion_id/i);
  });

  it('puntos: emitidos y canjeados netos de reversas y devoluciones, saldo vivo y costo', async () => {
    const { s } = servicio({
      'GROUP BY tipo': [
        { tipo: 'SUMA', n: 10, puntos: 100 },
        { tipo: 'REVERSA', n: 1, puntos: 10 },
        { tipo: 'CANJE', n: 3, puntos: 30 },
        { tipo: 'DEVOLUCION_CANJE', n: 1, puntos: 5 },
      ],
      'FROM customer_detail': [{ saldo: 250.5, cuentas: 12 }],
      'GROUP BY 1, 2': [
        { semana: '2026-11-09', tipo: 'SUMA', puntos: 100 },
        { semana: '2026-11-09', tipo: 'CANJE', puntos: 30 },
      ],
    });
    const r = await s.resumen({}, AHORA);
    expect(r.puntos).toMatchObject({ emitidos: 90, canjeados: 25, pctCanjeado: 27.8, saldoVivo: 250.5, cuentasConSaldo: 12, costoCanjeadoPen: 25, costoPendientePen: 250.5 });
    expect(r.puntos.semanas).toEqual([{ semana: '2026-11-09', emitidos: 100, canjeados: 30 }]);
  });

  it('encuestas: promedio ponderado, tasa de respuesta, y puntaje con y sin demora', async () => {
    const { s } = servicio(
      {
        'GROUP BY 1 ORDER BY 1 LIMIT 20': [
          { semana: '2026-11-02', respuestas: 2, promedio: 4 },
          { semana: '2026-11-09', respuestas: 2, promedio: 5 },
        ],
        'GROUP BY puntaje': [
          { puntaje: 5, n: 2 },
          { puntaje: 4, n: 2 },
        ],
        'p.eta_max': [
          { demorado: true, n: 1, promedio: 3 },
          { demorado: false, n: 3, promedio: 4.7 },
        ],
      },
      { enviadas: 8, google: { _avg: { calificacion: 4.5 }, _count: { _all: 2 } } },
    );
    const r = await s.resumen({}, AHORA);
    expect(r.calificaciones.encuestas).toMatchObject({ enviadas: 8, respondidas: 4, pctRespuesta: 50, promedio: 4.5 });
    expect(r.calificaciones.encuestas.distribucion.find((d) => d.puntaje === 5)?.n).toBe(2);
    expect(r.calificaciones.demora).toEqual({ conDemora: { n: 1, promedio: 3 }, sinDemora: { n: 3, promedio: 4.7 } });
    expect(r.calificaciones.google).toEqual({ n: 2, promedio: 4.5 });
  });

  it('no devuelve ningún celular en la respuesta', async () => {
    const { s } = servicio({ 'MIN(creado_en) OVER': [{ sin_id: false, nuevo: true, pedidos: 1, semana: '2026-11-09' }] });
    expect(JSON.stringify(await s.resumen({}, AHORA))).not.toMatch(/\b9\d{8}\b/);
  });

  it.each([
    [{ desde: '2026-11-12' }],
    [{ desde: '2026-07-01', hasta: '2026-11-11' }],
    [{ desde: 'ayer' }],
    [{ modalidad: 'VOLAR' }],
    [{ turno: 'MADRUGADA' }],
  ])('rechaza filtros inválidos %j', async (filtros) => {
    const { s, prisma } = servicio({});
    await expect(s.resumen(filtros as any, AHORA)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });

  it('con 92 días exactos sí consulta', async () => {
    const { s } = servicio({});
    await expect(s.resumen({ desde: '2026-08-12', hasta: '2026-11-11' }, AHORA)).resolves.toMatchObject({ rango: { dias: 92 } });
  });
});
