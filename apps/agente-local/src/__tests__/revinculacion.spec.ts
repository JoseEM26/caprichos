import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { crearReenlace } from '../revinculacion';
import { ClienteApiImpresion, ErrorRespuestaApi } from '../api/clienteApi';
import { migrarConfigJuntoExe } from '../cli';

function deps(over: any = {}) {
  const log = vi.fn();
  return {
    log,
    d: {
      leer: () => ({ agenteKey: 'vieja' }),
      interactivo: true,
      preguntar: vi.fn(),
      canjear: vi.fn().mockResolvedValue({ apiUrl: 'https://x.pe', llave: 'nueva' }),
      guardar: vi.fn(),
      log,
      ahora: () => 0,
      ...over,
    },
  };
}

describe('revinculación ante 401', () => {
  it('interactivo + S: pide el código, canjea, guarda y devuelve la llave nueva', async () => {
    const { d, log } = deps();
    d.preguntar.mockResolvedValueOnce('s').mockResolvedValueOnce('ABCD@x.pe');
    const r = await crearReenlace(d, 'vieja')();
    expect(r).toEqual({ apiUrl: 'https://x.pe', agenteKey: 'nueva' });
    expect(d.guardar).toHaveBeenCalledWith('https://x.pe', 'nueva');
    expect(d.preguntar.mock.calls[0][0]).toContain('¿Quieres vincularlo de nuevo ahora? (S/N)');
    expect(log.mock.calls[0][0]).toContain('Este equipo ya no está vinculado');
  });

  it('interactivo + N: no canjea y no vuelve a preguntar dentro del silencio', async () => {
    const { d } = deps();
    d.preguntar.mockResolvedValue('n');
    const re = crearReenlace(d, 'vieja');
    expect(await re()).toBeUndefined();
    expect(await re()).toBeUndefined();
    expect(d.preguntar).toHaveBeenCalledTimes(1);
    expect(d.canjear).not.toHaveBeenCalled();
  });

  it('sin TTY: avisa una sola vez y no pregunta', async () => {
    const { d, log } = deps({ interactivo: false });
    const re = crearReenlace(d, 'vieja');
    await re();
    await re();
    expect(d.preguntar).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it('si el config trae una llave distinta (programa descargado de nuevo) la usa sin preguntar', async () => {
    const { d } = deps({ leer: () => ({ agenteKey: 'otra', apiUrl: 'https://y.pe' }) });
    expect(await crearReenlace(d, 'vieja')()).toEqual({ apiUrl: 'https://y.pe', agenteKey: 'otra' });
    expect(d.preguntar).not.toHaveBeenCalled();
  });
});

describe('cliente API con 401', () => {
  it('reintenta con la llave nueva y el mensaje de 401 es claro', async () => {
    const usadas: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (_u: string, o: any) => {
        usadas.push(o.headers.Authorization);
        return o.headers.Authorization === 'Bearer nueva'
          ? new Response(JSON.stringify({ trabajos: [] }), { status: 200 })
          : new Response('{}', { status: 401 });
      })
    );
    const c = new ClienteApiImpresion('http://a', 'vieja', 1000, async () => ({ agenteKey: 'nueva' }));
    expect(await c.tomarTrabajos()).toEqual([]);
    expect(usadas).toEqual(['Bearer vieja', 'Bearer nueva']);
    const sin = new ClienteApiImpresion('http://a', 'vieja');
    await expect(sin.tomarTrabajos()).rejects.toThrow('Este equipo ya no está vinculado');
    expect(new ErrorRespuestaApi(401, 'x').status).toBe(401);
    vi.unstubAllGlobals();
  });
});

describe('config.json junto al .exe', () => {
  it('se migra a la ruta normal conservando lo demás y no pisa un vínculo más nuevo', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cfg-'));
    const normal = path.join(dir, 'n', 'config.json');
    const junto = path.join(dir, 'config.json');
    fs.mkdirSync(path.dirname(normal));
    fs.writeFileSync(normal, JSON.stringify({ ticketera: 'T1' }));
    fs.writeFileSync(junto, JSON.stringify({ apiUrl: 'https://z.pe', agenteKey: 'k1' }));
    migrarConfigJuntoExe(normal, junto);
    const tras = JSON.parse(fs.readFileSync(normal, 'utf8'));
    expect(tras).toMatchObject({ ticketera: 'T1', apiUrl: 'https://z.pe', agenteKey: 'k1' });
    fs.writeFileSync(normal, JSON.stringify({ ...tras, agenteKey: 'k2' }));
    migrarConfigJuntoExe(normal, junto);
    expect(JSON.parse(fs.readFileSync(normal, 'utf8')).agenteKey).toBe('k2');
  });
});
