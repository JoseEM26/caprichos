import { Logger } from '@nestjs/common';
import { ResenasGoogleService } from '../resenas-google.service';

const CLAVE = 'CLAVE-SECRETA-PRUEBA-123';
const AHORA = new Date('2026-10-31T15:00:00Z'); // 10:00 en Lima
const LARGO = 'Excelente café y la atención fue muy amable, volveremos pronto.'; // > 30 caracteres

function fakePrisma() {
  const params = new Map<string, any>();
  let filas: any[] = [];
  let seq = 1n;
  const visibleDe = (w?: any) => (w?.where?.visible === undefined ? filas : filas.filter((f) => f.visible === w.where.visible));
  return {
    params,
    get filas() {
      return filas;
    },
    set filas(v: any[]) {
      filas = v;
    },
    prisma: {
      parametro: {
        findUnique: jest.fn(async ({ where }: any) => (params.has(where.clave) ? { clave: where.clave, valor: params.get(where.clave) } : null)),
        upsert: jest.fn(async ({ where, update, create }: any) => {
          params.set(where.clave, params.has(where.clave) ? update.valor : create.valor);
          return {};
        }),
      },
      resenaGoogle: {
        findUnique: jest.fn(async ({ where }: any) =>
          filas.find((f) => (where.id !== undefined ? f.id === where.id : f.google_review_id === where.google_review_id)) ?? null,
        ),
        upsert: jest.fn(async ({ where, create, update }: any) => {
          const i = filas.findIndex((f) => f.google_review_id === where.google_review_id);
          if (i >= 0) {
            // update nunca toca visible
            filas[i] = { ...filas[i], ...update };
            return filas[i];
          }
          const nueva = { id: seq++, ...create };
          filas.push(nueva);
          return nueva;
        }),
        count: jest.fn(async (w?: any) => visibleDe(w).length),
        findMany: jest.fn(async (w?: any) => (w?.where?.id?.in ? filas.filter((f) => w.where.id.in.includes(f.id)).map((f) => ({ ...f })) : visibleDe(w))),
        update: jest.fn(async ({ where, data }: any) => {
          const f = filas.find((x) => x.id === where.id);
          Object.assign(f, data);
          return f;
        }),
        updateMany: jest.fn(async ({ where, data }: any) => {
          const afectadas = filas.filter((f) => where.id.in.includes(f.id));
          afectadas.forEach((f) => Object.assign(f, data));
          return { count: afectadas.length };
        }),
      },
    },
  };
}

const config = (env: Record<string, string | undefined>) => ({ get: (k: string) => env[k] });
const redis = { obtenerCliente: () => ({ set: jest.fn().mockResolvedValue('OK'), eval: jest.fn().mockResolvedValue(1) }) };
const respuesta = (status: number, body: any) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const resena = (id: string, rating: number, texto = LARGO, extra: any = {}) => ({
  review_id: id,
  rating,
  review_text: texto,
  author_name: `Autor ${id}`,
  review_datetime_utc: '2026-10-20T12:00:00Z',
  review_link: `https://g.co/${id}`,
  ...extra,
});

function crear(opts: { env?: Record<string, string | undefined>; params?: Record<string, any>; filas?: any[] } = {}) {
  const fp = fakePrisma();
  for (const [k, v] of Object.entries(opts.params ?? { resenas_negocio: { businessId: 'biz-1', nombre: 'Caprichos Campoy' } })) fp.params.set(k, v);
  fp.filas = opts.filas ?? [];
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const env = { OPENWEBNINJA_API_KEY: CLAVE, RESENAS_TOPE_MENSUAL: '40', RESENAS_CARGA_MAX: '200', ...(opts.env ?? {}) };
  const svc = new ResenasGoogleService(fp.prisma as any, redis as any, config(env) as any, auditoria as any);
  (svc as any).esperar = jest.fn().mockResolvedValue(undefined);
  const fetchMock = jest.fn();
  (global as any).fetch = fetchMock;
  return { svc, fp, auditoria, fetchMock };
}

const mesActual = '202610';

describe('ResenasGoogleService', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('actualizar filtra calificacion menor a 4 y textos cortos', async () => {
    const { svc, fp, fetchMock } = crear();
    fetchMock.mockResolvedValueOnce(
      respuesta(200, { status: 'OK', data: [resena('a', 5), resena('b', 3), resena('c', 4, 'corto'), resena('d', 4)] }),
    );
    const r = await svc.actualizar({ manual: true, ahora: AHORA });
    expect(r).toMatchObject({ ok: true, recibidas: 4, guardadas: 2 });
    expect(fp.filas.map((f) => f.google_review_id)).toEqual(['a', 'd']);
  });

  it('upsert no cambia visible: lo que el admin ocultó sigue oculto', async () => {
    const { svc, fp, fetchMock } = crear({ filas: [{ id: 9n, google_review_id: 'a', visible: false, texto: 'viejo', calificacion: 5 }] });
    fetchMock.mockResolvedValueOnce(respuesta(200, { status: 'OK', data: [resena('a', 5, LARGO + ' nuevo')] }));
    const r = await svc.actualizar({ manual: true, ahora: AHORA });
    expect(r).toMatchObject({ ok: true, actualizadas: 1, nuevas: 0 });
    expect(fp.filas).toHaveLength(1);
    expect(fp.filas[0].visible).toBe(false);
    expect(fp.filas[0].texto).toContain('nuevo');
  });

  it('el tope mensual impide llamar a la API y responde motivo claro', async () => {
    const { svc, fetchMock } = crear({ params: { resenas_negocio: { businessId: 'biz-1', nombre: 'X' }, [`resenas_consumo_${mesActual}`]: 40 } });
    const r = await svc.actualizar({ manual: false, ahora: AHORA });
    expect(r).toMatchObject({ ok: false, motivo: 'TOPE_MENSUAL' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('la actualizacion manual solo una vez al dia', async () => {
    const { svc, fetchMock } = crear({ params: { resenas_negocio: { businessId: 'biz-1', nombre: 'X' }, resenas_ultima_manual: '2026-10-31' } });
    expect(await svc.actualizar({ manual: true, ahora: AHORA })).toMatchObject({ ok: false, motivo: 'LIMITE_DIARIO' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('error 403 no borra nada, devuelve motivo y nunca muestra la clave', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { svc, fp, fetchMock } = crear({ filas: [{ id: 1n, google_review_id: 'a', visible: true, texto: LARGO, calificacion: 5 }] });
    fetchMock.mockResolvedValueOnce(respuesta(403, { status: 'ERROR', error: { message: 'You are not subscribed to this API', code: 403 } }));
    const r = await svc.actualizar({ manual: false, ahora: AHORA });
    expect(r).toMatchObject({ ok: false, motivo: 'NO_AUTORIZADO' });
    expect(fp.filas).toHaveLength(1);
    expect(JSON.stringify(r)).not.toContain(CLAVE);
    expect(JSON.stringify(warn.mock.calls)).not.toContain(CLAVE);
  });

  it('429 da LIMITE_API y error de red da ERROR_RED, sin borrar', async () => {
    const { svc, fetchMock, fp } = crear({ filas: [{ id: 1n, google_review_id: 'a', visible: true, texto: LARGO, calificacion: 5 }] });
    fetchMock.mockResolvedValueOnce(respuesta(429, { status: 'ERROR' }));
    expect(await svc.actualizar({ manual: false, ahora: AHORA })).toMatchObject({ motivo: 'LIMITE_API' });
    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    expect(await svc.actualizar({ manual: false, ahora: AHORA })).toMatchObject({ motivo: 'ERROR_RED' });
    expect(fp.filas).toHaveLength(1);
  });

  it('sin clave configurada no llama a la API', async () => {
    const { svc, fetchMock } = crear({ env: { OPENWEBNINJA_API_KEY: '' } });
    expect(await svc.buscarNegocio('caprichos campoy')).toMatchObject({ ok: false, motivo: 'SIN_CLAVE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('buscar cuenta 3 unidades y no guarda el negocio; reviews cuenta 1', async () => {
    const { svc, fp, fetchMock } = crear({ params: {} });
    fetchMock.mockResolvedValueOnce(
      respuesta(200, {
        status: 'OK',
        data: [
          {
            business_id: 'biz-9',
            name: 'Caprichos Campoy',
            full_address: 'Av. X',
            rating: 4.8,
            review_count: 778,
            reviews_link: 'https://www.google.com/maps/place/Caprichos/reviews',
          },
        ],
      }),
    );
    const r: any = await svc.buscarNegocio('caprichos campoy', AHORA);
    expect(r.ok).toBe(true);
    expect(r.candidatos[0]).toEqual({
      businessId: 'biz-9',
      nombre: 'Caprichos Campoy',
      direccion: 'Av. X',
      rating: 4.8,
      total: 778,
      enlaceLocal: 'https://www.google.com/maps/place/Caprichos/reviews',
    });
    expect(fp.params.get(`resenas_consumo_${mesActual}`)).toBe(3);
    expect(fp.params.has('resenas_negocio')).toBe(false);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/search');
    expect(url).toContain('limit=3');

    fp.params.set('resenas_negocio', { businessId: 'biz-9', nombre: 'Caprichos Campoy' });
    fetchMock.mockResolvedValueOnce(respuesta(200, { status: 'OK', data: [] }));
    await svc.actualizar({ manual: true, ahora: AHORA });
    expect(fp.params.get(`resenas_consumo_${mesActual}`)).toBe(4);
  });

  it('actualizacion semanal pide una pagina con sort_by=newest', async () => {
    const { svc, fetchMock } = crear();
    fetchMock.mockResolvedValueOnce(respuesta(200, { status: 'OK', data: [] }));
    await svc.actualizar({ manual: false, ahora: AHORA });
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('sort_by')).toBe('newest');
    expect(url.searchParams.get('offset')).toBe('0');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('carga inicial pagina con offset 0, 20, 40 y para con una pagina corta', async () => {
    const { svc, fetchMock } = crear();
    const pagina = (n: number, base: number) =>
      respuesta(200, { status: 'OK', data: Array.from({ length: n }, (_, i) => resena(`r${base + i}`, 5)) });
    fetchMock.mockResolvedValueOnce(pagina(20, 0)).mockResolvedValueOnce(pagina(20, 20)).mockResolvedValueOnce(pagina(5, 40));
    const r = await svc.cargaInicial({ repetir: false, ahora: AHORA });
    expect(r).toMatchObject({ ok: true, paginas: 3, guardadas: 45 });
    const offsets = fetchMock.mock.calls.map((c: any[]) => new URL(String(c[0])).searchParams.get('offset'));
    expect(offsets).toEqual(['0', '20', '40']);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('sort_by')).toBe('highest_ranking');
  });

  it('carga inicial se corta al llegar a RESENAS_CARGA_MAX', async () => {
    const { svc, fetchMock } = crear({ env: { RESENAS_CARGA_MAX: '20' } });
    fetchMock.mockResolvedValueOnce(respuesta(200, { status: 'OK', data: Array.from({ length: 20 }, (_, i) => resena(`m${i}`, 5)) }));
    const r = await svc.cargaInicial({ repetir: false, ahora: AHORA });
    expect(r).toMatchObject({ ok: true, paginas: 1, totalGuardadas: 20 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('carga inicial se corta con una pagina vacia', async () => {
    const { svc, fetchMock } = crear();
    fetchMock.mockResolvedValueOnce(respuesta(200, { status: 'OK', data: Array.from({ length: 20 }, (_, i) => resena(`v${i}`, 5)) }));
    fetchMock.mockResolvedValueOnce(respuesta(200, { status: 'OK', data: [] }));
    const r = await svc.cargaInicial({ repetir: false, ahora: AHORA });
    expect(r).toMatchObject({ ok: true, paginas: 2, guardadas: 20 });
  });

  it('carga inicial respeta el tope mensual y reporta TOPE_MENSUAL', async () => {
    const { svc, fetchMock } = crear({ env: { RESENAS_TOPE_MENSUAL: '2' } });
    fetchMock.mockResolvedValueOnce(respuesta(200, { status: 'OK', data: Array.from({ length: 20 }, (_, i) => resena(`t${i}`, 5)) }));
    fetchMock.mockResolvedValueOnce(respuesta(200, { status: 'OK', data: Array.from({ length: 20 }, (_, i) => resena(`u${i}`, 5)) }));
    const r = await svc.cargaInicial({ repetir: false, ahora: AHORA });
    expect(r).toMatchObject({ ok: false, motivo: 'TOPE_MENSUAL', guardadas: 40 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('repetir la carga no duplica reseñas', async () => {
    const { svc, fp, fetchMock } = crear();
    const data = [resena('x1', 5), resena('x2', 4)];
    fetchMock.mockResolvedValue(respuesta(200, { status: 'OK', data }));
    await svc.cargaInicial({ repetir: false, ahora: AHORA });
    expect(fp.filas).toHaveLength(2);
    expect(await svc.cargaInicial({ repetir: false, ahora: AHORA })).toMatchObject({ motivo: 'CARGA_YA_HECHA', ok: false });
    await svc.cargaInicial({ repetir: true, ahora: AHORA });
    expect(fp.filas).toHaveLength(2);
  });

  it('falla parcial: guarda lo ya traido y reporta cuantas', async () => {
    const { svc, fp, fetchMock } = crear();
    fetchMock.mockResolvedValueOnce(respuesta(200, { status: 'OK', data: Array.from({ length: 20 }, (_, i) => resena(`p${i}`, 5)) }));
    fetchMock.mockResolvedValueOnce(respuesta(500, { status: 'ERROR' }));
    const r = await svc.cargaInicial({ repetir: false, ahora: AHORA });
    expect(r).toMatchObject({ ok: false, motivo: 'ERROR_API', guardadas: 20, paginas: 2 });
    expect(fp.filas).toHaveLength(20);
  });

  it('la tarea semanal solo corre con RESENAS_ACTUALIZAR_AUTO=si y con mas de 7 dias', async () => {
    const apagada = crear({ env: { RESENAS_ACTUALIZAR_AUTO: 'no' } });
    expect(await apagada.svc.revisarSemanal(AHORA)).toEqual({ actualizado: false, motivo: 'DESACTIVADA' });
    expect(apagada.fetchMock).not.toHaveBeenCalled();

    const reciente = crear({
      env: { RESENAS_ACTUALIZAR_AUTO: 'si' },
      params: { resenas_negocio: { businessId: 'biz-1', nombre: 'X' }, resenas_ultima_actualizacion: '2026-10-28T10:00:00Z' },
    });
    expect(await reciente.svc.revisarSemanal(AHORA)).toEqual({ actualizado: false, motivo: 'RECIENTE' });
    expect(reciente.fetchMock).not.toHaveBeenCalled();

    const vieja = crear({
      env: { RESENAS_ACTUALIZAR_AUTO: 'si' },
      params: { resenas_negocio: { businessId: 'biz-1', nombre: 'X' }, resenas_ultima_actualizacion: '2026-10-01T10:00:00Z' },
    });
    vieja.fetchMock.mockResolvedValueOnce(respuesta(200, { status: 'OK', data: [] }));
    expect(await vieja.svc.revisarSemanal(AHORA)).toEqual({ actualizado: true });
    expect(new URL(String(vieja.fetchMock.mock.calls[0][0])).searchParams.get('sort_by')).toBe('newest');
  });

  it('cambiar visible audita y no borra', async () => {
    const { svc, fp, auditoria } = crear({ filas: [{ id: 5n, google_review_id: 'a', visible: true, texto: LARGO, calificacion: 5, autor_nombre: 'Ana' }] });
    const r = await svc.cambiarVisible('5', false, { partyId: 1n, rol: 'ADMIN', debeCambiar: false } as any, '1.2.3.4');
    expect(r.visible).toBe(false);
    expect(fp.filas).toHaveLength(1);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ modulo: 'resenas', accion: 'VISIBILIDAD' }));
  });

  it('cambio en lote oculta varias, no borra, audita cada una y acepta ids repetidos una sola vez', async () => {
    const { svc, fp, auditoria } = crear({
      filas: [
        { id: 5n, google_review_id: 'a', visible: true, texto: LARGO, calificacion: 5, autor_nombre: 'Ana' },
        { id: 6n, google_review_id: 'b', visible: true, texto: LARGO, calificacion: 4, autor_nombre: 'Luis' },
        { id: 7n, google_review_id: 'c', visible: true, texto: LARGO, calificacion: 5, autor_nombre: 'Rosa' },
      ],
    });
    const r = await svc.cambiarVisibleLote(['5', '6', '5'], false, { partyId: 1n, rol: 'ADMIN', debeCambiar: false } as any, '1.2.3.4');
    expect(r).toEqual({ cambiadas: 2, visible: false });
    expect(fp.filas.map((f: any) => [f.id, f.visible])).toEqual([
      [5n, false],
      [6n, false],
      [7n, true],
    ]);
    expect(fp.filas).toHaveLength(3);
    expect(auditoria.registrar).toHaveBeenCalledTimes(2);
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: 'resenas', accion: 'VISIBILIDAD', entidadId: 5n, antes: { visible: true }, despues: { visible: false } }),
    );
  });

  it('cambio en lote con un id que no existe responde 404 y no cambia nada', async () => {
    const { svc, fp, auditoria } = crear({ filas: [{ id: 5n, google_review_id: 'a', visible: true, texto: LARGO, calificacion: 5, autor_nombre: 'Ana' }] });
    await expect(svc.cambiarVisibleLote(['5', '99'], false)).rejects.toMatchObject({ status: 404 });
    expect(fp.filas[0].visible).toBe(true);
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('listarPublico solo devuelve visibles y el resumen si existe', async () => {
    const { svc } = crear({
      params: { resenas_resumen: { rating: 4.8, total: 778 } },
      filas: [
        { id: 1n, google_review_id: 'a', visible: true, autor_nombre: 'Ana', autor_foto_url: null, calificacion: 5, texto: LARGO, publicada_en: new Date('2026-10-01T00:00:00Z'), enlace_resena: 'https://g.co/L' },
        { id: 2n, google_review_id: 'b', visible: false, autor_nombre: 'Luis', calificacion: 5, texto: LARGO, publicada_en: null, enlace_resena: null },
      ],
    });
    const r: any = await svc.listarPublico();
    expect(r.resenas.map((x: any) => x.id)).toEqual(['1']);
    expect(r.resenas[0]).toEqual({ id: '1', autor: 'Ana', foto: null, estrellas: 5, texto: LARGO, fecha: '2026-10-01T00:00:00.000Z', enlace: 'https://g.co/L' });
    expect(r.resumen).toEqual({ rating: 4.8, total: 778 });
    expect(r.enlaceLocal).toBeNull();
  });

  it('listarPublico: review_link válido se usa tal cual', async () => {
    const { svc } = crear({
      params: { resenas_negocio: { businessId: 'biz-1', nombre: 'X', enlaceLocal: 'https://www.google.com/maps/place/local' } },
      filas: [{ id: 1n, google_review_id: 'a', visible: true, autor_nombre: 'Ana', calificacion: 5, texto: LARGO, enlace_resena: 'https://maps.google.com/?cid=1' }],
    });
    const r: any = await svc.listarPublico();
    expect(r.resenas[0].enlace).toBe('https://maps.google.com/?cid=1');
    expect(r.enlaceLocal).toBe('https://www.google.com/maps/place/local');
  });

  it('listarPublico: review_link inválido cae al enlace del local', async () => {
    const { svc } = crear({
      params: { resenas_negocio: { businessId: 'biz-1', nombre: 'X', enlaceLocal: 'https://www.google.com/maps/place/local' } },
      filas: [
        { id: 1n, google_review_id: 'a', visible: true, autor_nombre: 'Ana', calificacion: 5, texto: LARGO, enlace_resena: 'http://google.com/maps/x' },
        { id: 2n, google_review_id: 'b', visible: true, autor_nombre: 'Luis', calificacion: 5, texto: LARGO, enlace_resena: 'https://evil.com/google.com' },
      ],
    });
    const r: any = await svc.listarPublico();
    expect(r.resenas.map((x: any) => x.enlace)).toEqual(['https://www.google.com/maps/place/local', 'https://www.google.com/maps/place/local']);
  });

  it('listarPublico: sin review_link válido ni enlace del local, enlace null', async () => {
    const { svc } = crear({
      params: { resenas_negocio: { businessId: 'biz-1', nombre: 'X' } },
      filas: [{ id: 1n, google_review_id: 'a', visible: true, autor_nombre: 'Ana', calificacion: 5, texto: LARGO, enlace_resena: null }],
    });
    const r: any = await svc.listarPublico();
    expect(r.resenas[0].enlace).toBeNull();
    expect(r.enlaceLocal).toBeNull();
  });

  it('guardarNegocio guarda el enlace del local solo si es de Google', async () => {
    const { svc, fp } = crear({ params: {} });
    await svc.guardarNegocio('biz-9', 'Caprichos Campoy', undefined, undefined, 4.8, 778, 'https://www.google.com/maps/place/local');
    expect(fp.params.get('resenas_negocio')).toEqual({ businessId: 'biz-9', nombre: 'Caprichos Campoy', enlaceLocal: 'https://www.google.com/maps/place/local' });

    const otro = crear({ params: {} });
    await otro.svc.guardarNegocio('biz-9', 'Caprichos Campoy', undefined, undefined, 4.8, 778, 'https://evil.com/x');
    expect(otro.fp.params.get('resenas_negocio')).toEqual({ businessId: 'biz-9', nombre: 'Caprichos Campoy', enlaceLocal: null });
  });
});

describe('ResenasGoogleService: carga inicial masiva y periodicidad en días', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  const pagina = (n: number, base: number, rating = 5) =>
    respuesta(200, { status: 'OK', data: Array.from({ length: n }, (_, i) => resena(`q${base + i}`, rating)) });

  it('la carga se detiene en la primera página entera por debajo de 4 estrellas', async () => {
    const { svc, fp, fetchMock } = crear();
    fetchMock.mockResolvedValueOnce(pagina(20, 0, 5)).mockResolvedValueOnce(pagina(20, 20, 3)).mockResolvedValueOnce(pagina(20, 40, 5));
    const r = await svc.cargaInicial({ repetir: false, ahora: AHORA });
    expect(r).toMatchObject({ ok: true, paginas: 2, guardadas: 20 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fp.filas).toHaveLength(20);
  });

  it('una página mixta (algún 4 o 5) no detiene la carga', async () => {
    const { svc, fetchMock } = crear();
    const mixta = respuesta(200, {
      status: 'OK',
      data: [...Array.from({ length: 19 }, (_, i) => resena(`m${i}`, 2)), resena('buena', 4)],
    });
    fetchMock.mockResolvedValueOnce(mixta).mockResolvedValueOnce(pagina(20, 100, 2));
    const r = await svc.cargaInicial({ repetir: false, ahora: AHORA });
    expect(r).toMatchObject({ ok: true, paginas: 2, guardadas: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('por defecto el tope mensual es 80: con 80 usadas no llama a la API', async () => {
    const { svc, fetchMock } = crear({ env: { RESENAS_TOPE_MENSUAL: undefined }, params: { resenas_negocio: { businessId: 'biz-1', nombre: 'X' }, [`resenas_consumo_${mesActual}`]: 80 } });
    expect(await svc.actualizar({ manual: false, ahora: AHORA })).toMatchObject({ ok: false, motivo: 'TOPE_MENSUAL' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('por defecto la carga llega a 1000 reseñas (50 páginas de 20) y se corta ahí', async () => {
    const { svc, fp, fetchMock } = crear({ env: { RESENAS_CARGA_MAX: undefined, RESENAS_TOPE_MENSUAL: undefined } });
    for (let p = 0; p < 51; p++) fetchMock.mockResolvedValueOnce(pagina(20, p * 20, 5));
    const r = await svc.cargaInicial({ repetir: false, ahora: AHORA });
    expect(r).toMatchObject({ ok: true, paginas: 50, totalGuardadas: 1000 });
    expect(fetchMock).toHaveBeenCalledTimes(50);
    expect(fp.filas).toHaveLength(1000);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('limit')).toBe('20');
  });

  it('la actualización automática cada RESENAS_ACTUALIZAR_DIAS días, no cada 7 fijos', async () => {
    const params = { resenas_negocio: { businessId: 'biz-1', nombre: 'X' }, resenas_ultima_actualizacion: '2026-10-30T10:00:00Z' };
    const tresDias = crear({ env: { RESENAS_ACTUALIZAR_AUTO: 'si', RESENAS_ACTUALIZAR_DIAS: '2' }, params });
    expect(await tresDias.svc.revisarSemanal(AHORA)).toEqual({ actualizado: false, motivo: 'RECIENTE' });
    expect(tresDias.fetchMock).not.toHaveBeenCalled();

    const cuatroDias = crear({ env: { RESENAS_ACTUALIZAR_AUTO: 'si', RESENAS_ACTUALIZAR_DIAS: '2' }, params: { ...params, resenas_ultima_actualizacion: '2026-10-28T10:00:00Z' } });
    cuatroDias.fetchMock.mockResolvedValueOnce(respuesta(200, { status: 'OK', data: [] }));
    expect(await cuatroDias.svc.revisarSemanal(AHORA)).toEqual({ actualizado: true });
    expect(new URL(String(cuatroDias.fetchMock.mock.calls[0][0])).searchParams.get('sort_by')).toBe('newest');
  });

  it('RESENAS_ACTUALIZAR_DIAS fuera de 1 a 60 o no entero cae a 7 días', async () => {
    const hace5Dias = { resenas_negocio: { businessId: 'biz-1', nombre: 'X' }, resenas_ultima_actualizacion: '2026-10-26T10:00:00Z' };
    for (const valor of ['0', '61', '2.5', 'abc']) {
      const { svc, fetchMock } = crear({ env: { RESENAS_ACTUALIZAR_AUTO: 'si', RESENAS_ACTUALIZAR_DIAS: valor }, params: hace5Dias });
      expect(await svc.revisarSemanal(AHORA)).toEqual({ actualizado: false, motivo: 'RECIENTE' });
      expect(fetchMock).not.toHaveBeenCalled();
    }
  });
});
