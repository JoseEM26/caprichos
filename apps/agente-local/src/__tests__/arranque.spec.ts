import { describe, it, expect, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { arrancarProtegido, registrarLog, rutaArchivoLog, describirError } from '../arranque';
import { ejecutarAsistente } from '../cli';

describe('arranque protegido (doble clic en Windows)', () => {
  afterEach(() => {
    delete process.env.AGENTE_LOG;
    process.removeAllListeners('uncaughtException');
    process.removeAllListeners('unhandledRejection');
    vi.restoreAllMocks();
  });

  it('ante un error lo muestra en español, lo guarda en el log y sale con 1', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-log-'));
    process.env.AGENTE_LOG = path.join(dir, 'sub', 'agente.log');
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const salir = vi.fn();

    await arrancarProtegido(async () => {
      throw new Error('falla de prueba');
    }, salir);

    expect(salir).toHaveBeenCalledWith(1);
    expect(err.mock.calls.flat().join('\n')).toContain('no pudo seguir');
    expect(err.mock.calls.flat().join('\n')).toContain('falla de prueba');
    const log = fs.readFileSync(process.env.AGENTE_LOG, 'utf-8');
    expect(log).toContain('Inicio');
    expect(log).toContain('falla de prueba');
  });

  it('el log va junto a la configuración por defecto y registrarLog nunca lanza', () => {
    expect(rutaArchivoLog({ APPDATA: 'C:\\U\\AppData' } as any).replace(/\\/g, '/')).toMatch(/CaprichosAgente.agente\.log$/);
    expect(() => registrarLog('x', path.join(__filename, 'no-es-carpeta', 'agente.log'))).not.toThrow();
  });

  it('describirError incluye el código de red de la causa', () => {
    expect(describirError(Object.assign(new Error('fetch failed'), { cause: { code: 'ENOTFOUND' } }))).toBe('fetch failed (ENOTFOUND)');
  });

  it('el asistente no se cierra con un código malo: avisa y vuelve a pedirlo', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cap-asis-'));
    process.env.AGENTE_CONFIG = path.join(dir, 'config.json');
    const llamadas: string[] = [];
    vi.stubGlobal('fetch', async (url: string, init: any) => {
      llamadas.push(JSON.parse(init.body).codigo);
      if (llamadas.length === 1) throw Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
      return { ok: true, json: async () => ({ llave: 'k-1' }) };
    });
    const logs: string[] = [];
    const resp = ['MALO@x.pe', 'BUENO@x.pe', '', ''];
    const cfg = await ejecutarAsistente(async () => resp.shift() ?? '', (m) => logs.push(m));
    vi.unstubAllGlobals();
    expect(llamadas).toEqual(['MALO', 'BUENO']);
    expect(logs.join('\n')).toContain('No se pudo vincular');
    expect(cfg.agenteKey).toBe('k-1');
  });
});
