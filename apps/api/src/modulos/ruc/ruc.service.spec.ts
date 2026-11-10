jest.mock('../acceso/acceso.guard', () => ({ AccesoGuard: class {} }));
import { RucService, RUC_TOPE_MENSUAL } from './ruc.service';
import { rucValido } from './ruc.util';
import { RucPublicoController } from './ruc.controller';

const RUC = '20131312955';
const API = {
  ruc: RUC,
  razon_social: 'SUNAT',
  estado: 'ACTIVO',
  condicion: 'HABIDO',
  direccion: 'AV X',
  ubigeo: '150101',
  source: 'SUNAT',
  as_of: '2026-11-09',
  _more: { publicidad: true },
};
const AHORA = new Date('2026-11-09T12:00:00Z');
const dias = (n: number) => new Date(AHORA.getTime() - n * 86_400_000);

function montar(fila: any = null, usadas = 0) {
  const prisma: any = {
    rucConsulta: {
      findUnique: jest.fn().mockResolvedValue(fila),
      count: jest.fn().mockResolvedValue(usadas),
      upsert: jest.fn().mockImplementation(async ({ create }: any) => ({ ...create })),
    },
  };
  return { prisma, svc: new RucService(prisma) };
}
const respuesta = (status: number, cuerpo: unknown) => ({ ok: status < 400, status, json: async () => cuerpo }) as any;
const filaCache = (edadDias: number, extra: any = {}) => ({
  ruc: RUC, razon_social: 'CACHE SAC', estado: 'ACTIVO', condicion: 'HABIDO', direccion: 'D', actualizado_en: dias(edadDias), ...extra,
});

describe('rucValido', () => {
  it.each(['20131312955', '20100047218', '20611290064'])('acepta %s', (r) => expect(rucValido(r)).toBe(true));
  it('rechaza dígito cambiado, prefijo o largo', () => {
    expect(rucValido('20131312956')).toBe(false);
    expect(rucValido('30131312955')).toBe(false);
    expect(rucValido('2013131295')).toBe(false);
    expect(rucValido(undefined)).toBe(false);
  });
});

describe('RucService', () => {
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it('rechaza dígito verificador sin llamar a la API', async () => {
    const { svc } = montar();
    await expect(svc.consultar('20131312956', AHORA)).rejects.toMatchObject({ response: { codigo: 'RUC_INVALIDO' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('acierto: llama a la API, guarda el JSON completo sin _more', async () => {
    fetchMock.mockResolvedValue(respuesta(200, API));
    const { svc, prisma } = montar();
    const r = await svc.consultar(RUC, AHORA);
    expect(r).toMatchObject({ razon_social: 'SUNAT', estado: 'ACTIVO', desactualizado: false });
    const { create } = prisma.rucConsulta.upsert.mock.calls[0][0];
    expect(create.respuesta._more).toBeUndefined();
    expect(create.respuesta.ubigeo).toBe('150101');
    expect(fetchMock.mock.calls[0][0]).toBe(`https://openruc.com/api/ruc/${RUC}`);
    expect(fetchMock.mock.calls[0][1].redirect).toBe('error');
  });

  it('caché vigente: no llama a la API', async () => {
    const { svc } = montar(filaCache(5));
    expect((await svc.consultar(RUC, AHORA)).razon_social).toBe('CACHE SAC');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('caché vencida: refresca desde la API', async () => {
    fetchMock.mockResolvedValue(respuesta(200, API));
    const { svc } = montar(filaCache(40));
    expect((await svc.consultar(RUC, AHORA)).razon_social).toBe('SUNAT');
  });

  it('API caída con caché vencida: devuelve la caché desactualizada', async () => {
    fetchMock.mockRejectedValue(new Error('red'));
    const { svc } = montar(filaCache(40));
    expect(await svc.consultar(RUC, AHORA)).toMatchObject({ razon_social: 'CACHE SAC', desactualizado: true });
  });

  it('5xx sin caché: RUC_NO_DISPONIBLE', async () => {
    fetchMock.mockResolvedValue(respuesta(503, {}));
    const { svc } = montar();
    await expect(svc.consultar(RUC, AHORA)).rejects.toMatchObject({ response: { codigo: 'RUC_NO_DISPONIBLE' } });
  });

  it('404: RUC_NO_ENCONTRADO y cachea el negativo; el negativo vigente no repite la llamada', async () => {
    fetchMock.mockResolvedValue(respuesta(404, { error: 'not_found' }));
    const { svc, prisma } = montar();
    await expect(svc.consultar(RUC, AHORA)).rejects.toMatchObject({ response: { codigo: 'RUC_NO_ENCONTRADO' } });
    expect(prisma.rucConsulta.upsert.mock.calls[0][0].create.razon_social).toBe('');
    fetchMock.mockClear();
    const { svc: svc2 } = montar(filaCache(0, { razon_social: '', actualizado_en: new Date(AHORA.getTime() - 3600_000) }));
    await expect(svc2.consultar(RUC, AHORA)).rejects.toMatchObject({ response: { codigo: 'RUC_NO_ENCONTRADO' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('tope mensual: no llama y responde RUC_NO_DISPONIBLE', async () => {
    const { svc } = montar(null, RUC_TOPE_MENSUAL);
    await expect(svc.consultar(RUC, AHORA)).rejects.toMatchObject({ response: { codigo: 'RUC_NO_DISPONIBLE' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['ruc distinto', { ...API, ruc: '20100047218' }],
    ['sin razón social', { ...API, razon_social: 5 }],
  ])('respuesta malformada (%s): no se guarda', async (_n, cuerpo) => {
    fetchMock.mockResolvedValue(respuesta(200, cuerpo));
    const { svc, prisma } = montar();
    await expect(svc.consultar(RUC, AHORA)).rejects.toMatchObject({ response: { codigo: 'RUC_NO_DISPONIBLE' } });
    expect(prisma.rucConsulta.upsert).not.toHaveBeenCalled();
  });
});

describe('RucPublicoController', () => {
  it('limita a 10 consultas por minuto por IP', async () => {
    let n = 0;
    const redis: any = { obtenerCliente: () => ({ incr: async () => ++n, expire: async () => 1 }) };
    const svc: any = { consultar: jest.fn().mockResolvedValue({ ruc: RUC }) };
    const ctrl = new RucPublicoController(svc, redis);
    for (let i = 0; i < 10; i++) await ctrl.consultar(RUC, { ip: '1.1.1.1' });
    await expect(ctrl.consultar(RUC, { ip: '1.1.1.1' })).rejects.toMatchObject({ status: 429 });
    expect(svc.consultar).toHaveBeenCalledTimes(10);
  });
});
