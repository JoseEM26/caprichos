import { Logger } from '@nestjs/common';
import { DniService } from './dni.service';

const TOKEN = 'tok-de-prueba-ABC123';
const DNI = '12345678';
const REAL = { success: true, dni: DNI, nombres: 'MARIA LUISA', apellidoPaterno: 'PEREZ', apellidoMaterno: 'GOMEZ', codVerifica: 4, codVerificaLetra: 'K' };
const respuesta = (status: number, cuerpo: unknown) => ({ ok: status < 400, status, json: async () => cuerpo }) as any;

function montar() {
  const almacen = new Map<string, string>();
  const cliente = {
    get: jest.fn(async (k: string) => almacen.get(k) ?? null),
    set: jest.fn(async (k: string, v: string) => {
      almacen.set(k, v);
      return 'OK';
    }),
    incr: jest.fn(async (k: string) => {
      const n = Number(almacen.get(k) ?? 0) + 1;
      almacen.set(k, String(n));
      return n;
    }),
    expire: jest.fn(async () => 1),
  };
  return { cliente, almacen, svc: new DniService({ obtenerCliente: () => cliente } as any) };
}

describe('DniService', () => {
  let fetchMock: jest.Mock;
  beforeEach(() => {
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
    process.env.DNIRUC_TOKEN = TOKEN;
    delete process.env.DNIRUC_TOPE_MENSUAL;
  });
  afterAll(() => {
    delete process.env.DNIRUC_TOKEN;
    delete process.env.DNIRUC_TOPE_MENSUAL;
  });

  it.each(['1234567', '123456789', 'abcdefgh', ''])('DNI inválido %p: 400 sin llamar', async (d) => {
    const { svc } = montar();
    await expect(svc.consultarDni(d)).rejects.toMatchObject({ status: 400, response: { codigo: 'DNI_INVALIDO' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sin token: servicio no disponible sin llamar', async () => {
    delete process.env.DNIRUC_TOKEN;
    const { svc } = montar();
    await expect(svc.consultarDni(DNI)).rejects.toMatchObject({ status: 503, response: { codigo: 'DNI_NO_DISPONIBLE' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('éxito: arma el nombre como boleta, token en header y no en la URL', async () => {
    fetchMock.mockResolvedValue(respuesta(200, REAL));
    const { svc } = montar();
    expect(await svc.consultarDni(DNI)).toEqual({
      dni: DNI,
      nombre_completo: 'MARIA LUISA PEREZ GOMEZ',
      nombres: 'MARIA LUISA',
      apellido_paterno: 'PEREZ',
      apellido_materno: 'GOMEZ',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://dniruc.apisperu.com/api/v1/dni/${DNI}`);
    expect(String(url)).not.toContain(TOKEN);
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  it('sin apellido materno no deja espacios de más', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { ...REAL, apellidoMaterno: '' }));
    const { svc } = montar();
    expect((await svc.consultarDni(DNI)).nombre_completo).toBe('MARIA LUISA PEREZ');
  });

  it('no encontrado (HTTP 200 con success:false): 404 DNI_NO_ENCONTRADO', async () => {
    fetchMock.mockResolvedValue(respuesta(200, { success: false, message: 'No se encontraron resultados.' }));
    const { svc } = montar();
    await expect(svc.consultarDni(DNI)).rejects.toMatchObject({ status: 404, response: { codigo: 'DNI_NO_ENCONTRADO' } });
  });

  it.each([401, 403, 429, 503])('HTTP %i: 503 DNI_NO_DISPONIBLE', async (st) => {
    fetchMock.mockResolvedValue(respuesta(st, {}));
    const { svc } = montar();
    await expect(svc.consultarDni(DNI)).rejects.toMatchObject({ status: 503, response: { codigo: 'DNI_NO_DISPONIBLE' } });
  });

  it('timeout y respuesta malformada: 503', async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error('t'), { name: 'TimeoutError' }));
    const { svc } = montar();
    await expect(svc.consultarDni(DNI)).rejects.toMatchObject({ status: 503 });
    fetchMock.mockResolvedValue(respuesta(200, { ...REAL, dni: '87654321' }));
    await expect(svc.consultarDni(DNI)).rejects.toMatchObject({ status: 503 });
    fetchMock.mockResolvedValue(respuesta(200, { success: true, dni: DNI }));
    await expect(svc.consultarDni(DNI)).rejects.toMatchObject({ status: 503 });
  });

  it('caché Redis 24 h: la segunda consulta no llama a la API', async () => {
    fetchMock.mockResolvedValue(respuesta(200, REAL));
    const { svc, cliente } = montar();
    await svc.consultarDni(DNI);
    await svc.consultarDni(DNI);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(cliente.set).toHaveBeenCalledWith(`dni:c:${DNI}`, expect.any(String), 'EX', 86400);
  });

  it('tope mensual configurable: pasado el tope no llama', async () => {
    process.env.DNIRUC_TOPE_MENSUAL = '1';
    fetchMock.mockResolvedValue(respuesta(200, REAL));
    const { svc } = montar();
    await svc.consultarDni(DNI);
    await expect(svc.consultarDni('11111111')).rejects.toMatchObject({ status: 503, response: { codigo: 'DNI_NO_DISPONIBLE' } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('sin Redis igual consulta', async () => {
    fetchMock.mockResolvedValue(respuesta(200, REAL));
    const svc = new DniService({
      obtenerCliente: () => {
        throw new Error('sin redis');
      },
    } as any);
    expect((await svc.consultarDni(DNI)).dni).toBe(DNI);
  });

  it('nunca registra DNI, nombre ni token en los logs', async () => {
    const espias = [jest.spyOn(Logger.prototype, 'warn'), jest.spyOn(Logger.prototype, 'log'), jest.spyOn(Logger.prototype, 'error')].map((e) => e.mockImplementation());
    for (const r of [respuesta(401, REAL), respuesta(200, { ...REAL, dni: '87654321' }), respuesta(200, { success: false, message: 'Token inválido' })]) {
      fetchMock.mockResolvedValueOnce(r);
      await montar().svc.consultarDni(DNI).catch(() => {});
    }
    fetchMock.mockRejectedValueOnce(new Error('fallo de red'));
    await montar().svc.consultarDni(DNI).catch(() => {});
    const log = JSON.stringify(espias.flatMap((e) => e.mock.calls));
    for (const secreto of [DNI, 'MARIA', 'PEREZ', TOKEN]) expect(log).not.toContain(secreto);
    espias.forEach((e) => e.mockRestore());
  });
});
