import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  describirEstado, detenerEnMarcha, guardarEstado, pidEnMarcha, relanzarOculto, rutaBloqueo, rutaMarcaInicio, rutaParada,
  soltarBloqueo, tomarBloqueo,
} from '../segundoPlano';
import { activarAutoarranque, autoarranqueActivo, desactivarAutoarranque, NOMBRE_DESKTOP } from '../autoarranque';
import { asegurarInicio } from '../cli';
import { registrarLog } from '../arranque';
import { AgenteLocalServicio } from '../agente/bucle';
import { ErrorRespuestaApi } from '../api/clienteApi';
import { ImpresoraMemoria } from '../impresora/impresoraMemoria';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cap-sp-'));

describe('instancia única', () => {
  it('la segunda instancia no toma el bloqueo; uno viejo de un proceso muerto sí se reemplaza', () => {
    const dir = tmp();
    expect(tomarBloqueo(dir, 111, () => true)).toBe(true);
    expect(tomarBloqueo(dir, 222, () => true)).toBe(false);
    expect(pidEnMarcha(dir, () => true)).toBe(111);
    expect(tomarBloqueo(dir, 333, () => false)).toBe(true); // 111 ya no existe
    expect(pidEnMarcha(dir, () => true)).toBe(333);
    soltarBloqueo(dir, 999); // otro pid: no borra
    expect(fs.existsSync(rutaBloqueo(dir))).toBe(true);
    soltarBloqueo(dir, 333);
    expect(fs.existsSync(rutaBloqueo(dir))).toBe(false);
  });

  it('--detener: sin programa dice que no corría; con programa pide la parada y espera el cierre ordenado', async () => {
    const dir = tmp();
    expect(await detenerEnMarcha(dir)).toBe('no-corria');
    tomarBloqueo(dir, 111, () => true);
    let vivo = true;
    const matar = vi.fn();
    const r = await detenerEnMarcha(dir, {
      vivo: () => vivo,
      matar,
      dormir: async () => {
        expect(fs.existsSync(rutaParada(dir))).toBe(true);
        vivo = false; // el programa vio el archivo y salió
      },
    });
    expect(r).toBe('ordenado');
    expect(matar).not.toHaveBeenCalled();
  });

  it('--detener fuerza el cierre si no responde', async () => {
    const dir = tmp();
    tomarBloqueo(dir, 111, () => true);
    const matar = vi.fn();
    expect(await detenerEnMarcha(dir, { vivo: () => true, matar, esperaMs: 500, dormir: async () => undefined })).toBe('forzado');
    expect(matar).toHaveBeenCalledWith(111);
  });

  it('--estado muestra última conexión y avisa si necesita vincularse', () => {
    const dir = tmp();
    expect(describirEstado(dir, () => true)).toContain('NO está corriendo');
    tomarBloqueo(dir, 111, () => true);
    guardarEstado({ pid: 111, inicio: 'x', ultimaConexionOk: '2026-11-08T10:00:00Z', roles: [{ rol: 'TICKETERA', estado: 'lista' }] }, dir);
    const t = describirEstado(dir, () => true);
    expect(t).toContain('2026-11-08T10:00:00Z');
    expect(t).toContain('Ticketera: lista');
    guardarEstado({ pid: 111, inicio: 'x', necesitaVincular: true }, dir);
    expect(describirEstado(dir, () => true)).toContain('vincularse de nuevo');
  });

  it('relanza oculto y desacoplado', () => {
    const unref = vi.fn();
    const lanzar = vi.fn().mockReturnValue({ unref });
    relanzarOculto(['--segundo-plano'], lanzar as any);
    expect(lanzar.mock.calls[0][2]).toMatchObject({ detached: true, stdio: 'ignore', windowsHide: true });
    expect(lanzar.mock.calls[0][1]).toContain('--segundo-plano');
    expect(unref).toHaveBeenCalled();
  });
});

describe('inicio automático', () => {
  it('Linux: crea y quita el .desktop con --segundo-plano, idempotente', async () => {
    const dir = tmp();
    const o = { plataforma: 'linux' as const, ejecutable: '/opt/caprichos/agente', dirAutostart: dir };
    expect((await activarAutoarranque(o)).ok).toBe(true);
    expect((await activarAutoarranque(o)).ok).toBe(true);
    expect(fs.readFileSync(path.join(dir, NOMBRE_DESKTOP), 'utf-8')).toContain('Exec="/opt/caprichos/agente" --segundo-plano');
    expect(await autoarranqueActivo(o)).toBe(true);
    expect((await desactivarAutoarranque(o)).ok).toBe(true);
    expect((await desactivarAutoarranque(o)).ok).toBe(true);
    expect(await autoarranqueActivo(o)).toBe(false);
  });

  it('asegurarInicio no instala si se corre con node (sin .exe) y respeta la marca', async () => {
    const dir = tmp();
    await asegurarInicio(() => undefined, dir); // sin process.pkg: no hace nada
    expect(fs.existsSync(rutaMarcaInicio(dir))).toBe(false);
  });
});

describe('log rotativo', () => {
  it('pasado el máximo guarda el viejo como .1', () => {
    const ruta = path.join(tmp(), 'agente.log');
    registrarLog('a'.repeat(50), ruta, 10);
    registrarLog('nuevo', ruta, 10);
    expect(fs.readFileSync(`${ruta}.1`, 'utf-8')).toContain('aaaa');
    expect(fs.readFileSync(ruta, 'utf-8')).toContain('nuevo');
  });
});

describe('reconexión y vínculo perdido', () => {
  const config = { apiUrl: 'http://x', agenteKey: 'k', impresoraRuta: 'memoria://', intervaloConsultaMs: 3000, intervaloLatidoMs: 20000, maxTrabajosPorLote: 10, version: '0' };
  const crear = (cliente: any, extra = {}) => new AgenteLocalServicio({ config, clienteApi: cliente, impresora: new ImpresoraMemoria(), logger: () => undefined, ...extra });

  it('servidor caído: espera 3, 4, 8, 16, 32, 60, 60 s y nunca lanza', async () => {
    const cliente = { enviarLatido: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')), tomarTrabajos: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')), reportarResultado: vi.fn() };
    const a = crear(cliente);
    const esperas: number[] = [];
    for (let i = 0; i < 7; i++) {
      await a.ejecutarCiclo();
      esperas.push(a.obtenerEsperaActualMs());
    }
    expect(esperas).toEqual([3000, 4000, 8000, 16000, 32000, 60000, 60000]);
  });

  it('401: espera 5 minutos, queda marcado "necesita vincularse" y se recupera solo', async () => {
    const e401 = new ErrorRespuestaApi(401, 'LLAVE_INVALIDA');
    const cliente = { enviarLatido: vi.fn().mockRejectedValue(e401), tomarTrabajos: vi.fn().mockRejectedValue(e401), reportarResultado: vi.fn() };
    const estados: any[] = [];
    const a = crear(cliente, { alEstado: (e: any) => estados.push(e) });
    await a.ejecutarCiclo();
    expect(a.obtenerEsperaActualMs()).toBe(5 * 60 * 1000);
    expect(a.obtenerEstadoConexion().necesitaVincular).toBe(true);
    expect(estados.at(-1).ultimoError).toContain('vincularse');
    cliente.tomarTrabajos.mockResolvedValue([]);
    cliente.enviarLatido.mockResolvedValue({});
    a.forzarTiempoUltimoLatido(0);
    await a.ejecutarCiclo();
    expect(a.obtenerEstadoConexion().necesitaVincular).toBe(false);
    expect(a.obtenerEsperaActualMs()).toBe(3000);
  });

  it('cierre ordenado: detener() despierta la espera y el bucle termina sin esperar', async () => {
    const cliente = { enviarLatido: vi.fn().mockResolvedValue({}), tomarTrabajos: vi.fn().mockResolvedValue([]), reportarResultado: vi.fn() };
    const a = new AgenteLocalServicio({ config, clienteApi: cliente as any, impresora: new ImpresoraMemoria(), logger: () => undefined, temporizador: () => new Promise(() => undefined) });
    const corrida = a.iniciar();
    await new Promise((r) => setTimeout(r, 20));
    a.detener();
    await expect(corrida).resolves.toBeUndefined();
  });
});
