import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  argsDeLinea, cerrarCopiasPrevias, describirCopias, detenerTodo, esCopiaServicio, listarCopias, noCerrarOtras, parsearPowerShell,
  parsearTasklist, parsearWmic,
} from '../copias';
import type { DepsCopias, ProcLinux } from '../copias';
import { lineasExtraEstado } from '../cli';
import { formatearEstado, reunirEstado } from '../estadoPrograma';
import { reemplazable, rutaBloqueo, rutaParada, tomarBloqueo } from '../segundoPlano';

const EXE = 'C:\\Caprichos\\agente-impresion-windows.exe';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cap-cp-'));

const SALIDA_PS = [
  `100|2026-11-11T10:00:00.0000000-05:00|${EXE}|"${EXE}" --segundo-plano`,
  `200|2026-11-11T09:00:00.1234567-05:00|D:\\Descargas\\agente-impresion-windows.exe|"D:\\Descargas\\agente-impresion-windows.exe"`,
  `300|2026-11-11T09:30:00.0000000-05:00|${EXE}|"${EXE}" --estado`,
  `400|2026-11-11T08:00:00.0000000-05:00||`,
  'basura',
].join('\r\n');

/** Equipo simulado: «PowerShell» devuelve la salida de arriba. */
const win = (extra: Partial<DepsCopias> = {}): DepsCopias => ({
  plataforma: 'win32',
  yo: { pid: 100, ppid: 400, exe: EXE },
  dir: tmp(),
  ejecutar: async (cmd) => {
    if (cmd === 'powershell.exe') return SALIDA_PS;
    throw new Error('no');
  },
  ...extra,
});

describe('parsing de procesos', () => {
  it('PowerShell: pid, hora, ruta y argumentos; ignora líneas raras', () => {
    const r = parsearPowerShell(SALIDA_PS);
    expect(r.map((c) => c.pid)).toEqual([100, 200, 300, 400]);
    expect(r[0]).toMatchObject({ ruta: EXE, args: ['--segundo-plano'] });
    expect(r[1].args).toEqual([]);
    expect(r[1].inicioMs).toBe(Date.parse('2026-11-11T09:00:00.1234567-05:00'));
    expect(r[3].ruta).toBeUndefined();
    expect(r[3].args).toBeUndefined();
  });

  it('wmic CSV: la línea de comandos puede llevar comas', () => {
    const txt = `\r\r\nNode,CommandLine,CreationDate,ExecutablePath,ProcessId\r\r\nPC1,"C:\\a b\\x.exe" --segundo-plano,20261111100000.500000-300,C:\\a b\\x.exe,4321\r\r\nPC1,"C:\\x.exe" --a,b,20261111090000.000000-300,C:\\x.exe,55\r\r\n`;
    const r = parsearWmic(txt);
    expect(r).toHaveLength(2);
    expect(r[0]).toMatchObject({ pid: 4321, ruta: 'C:\\a b\\x.exe', args: ['--segundo-plano'] });
    expect(r[0].inicioMs).toBe(Date.UTC(2026, 10, 11, 10, 0, 0) + 300 * 60000);
    expect(r[1].args).toEqual(['--a,b']);
  });

  it('tasklist CSV: solo pid; «INFO: No tasks» no es un proceso', () => {
    expect(parsearTasklist('"a.exe","1234","Console","1","12,345 K"\r\n"a.exe","55","Console","1","9 K"\r\n').map((c) => c.pid)).toEqual([1234, 55]);
    expect(parsearTasklist('INFO: No tasks are running which match the specified criteria.')).toEqual([]);
  });

  it('argsDeLinea y qué cuenta como copia', () => {
    expect(argsDeLinea('"C:\\a b\\x.exe" --estado --json')).toEqual(['--estado', '--json']);
    expect(argsDeLinea('x.exe')).toEqual([]);
    expect(argsDeLinea('')).toBeUndefined();
    expect(esCopiaServicio([])).toBe(true);
    expect(esCopiaServicio(['--segundo-plano', '--no-cerrar-otras'])).toBe(true);
    expect(esCopiaServicio(['--no-cerrar-otras'])).toBe(true);
    expect(esCopiaServicio(['--estado'])).toBe(false);
    expect(esCopiaServicio(['copias'])).toBe(false);
    expect(esCopiaServicio(undefined)).toBe(true);
  });
});

describe('--copias', () => {
  it('Windows: excluye a la propia, a su lanzador y a los comandos de control; versión desconocida', async () => {
    const d = win();
    const r = await listarCopias(d);
    expect(r.map((c) => c.pid)).toEqual([200]);
    expect(r[0].version).toBeUndefined();
    const txt = describirCopias(r, 'x.exe').join('\n');
    expect(txt).toContain('Hay 1 copia');
    expect(txt).toContain('versión desconocida');
    expect(txt).toContain('D:\\Descargas\\agente-impresion-windows.exe');
    expect(txt).toContain('x.exe --detener-todo');
  });

  it('usa la versión del bloqueo si la copia es la registrada', async () => {
    const d = win();
    fs.writeFileSync(rutaBloqueo(d.dir!), JSON.stringify({ pid: 200, version: '0.1.62' }));
    expect((await listarCopias(d))[0]).toMatchObject({ pid: 200, version: '0.1.62' });
  });

  it('cae a wmic y luego a tasklist si PowerShell no existe', async () => {
    const llamadas: string[] = [];
    const wmic = '\r\nNode,CommandLine,CreationDate,ExecutablePath,ProcessId\r\nPC,"C:\\x.exe",20261111100000.000000-300,C:\\x.exe,100\r\nPC,"C:\\y.exe",20261111090000.000000-300,C:\\y.exe,200\r\n';
    let r = await listarCopias(win({ ejecutar: async (c) => { llamadas.push(c); if (c === 'wmic') return wmic; throw new Error('no'); } }));
    expect(llamadas).toEqual(['powershell.exe', 'wmic']);
    expect(r.map((c) => c.pid)).toEqual([200]);
    r = await listarCopias(win({ ejecutar: async (c) => { if (c === 'tasklist') return '"a.exe","100","Console","1","1 K"\r\n"a.exe","201","Console","1","1 K"'; throw new Error('no'); } }));
    expect(r.map((c) => c.pid)).toEqual([201]);
    expect(r[0].ruta).toBeUndefined();
  });

  it('si ninguna herramienta sirve, avisa en vez de decir «no hay copias»', async () => {
    await expect(listarCopias(win({ ejecutar: async () => { throw new Error('no'); } }))).rejects.toThrow(/No se pudo consultar/);
  });

  it('Linux: /proc, mismo nombre de ejecutable, sin la propia', async () => {
    const proc: ProcLinux[] = [
      { pid: 10, exe: '/opt/agente-impresion-linux', args: ['--segundo-plano'], inicioMs: 5 },
      { pid: 11, exe: '/home/u/Descargas/agente-impresion-linux', args: [], inicioMs: 4 },
      { pid: 12, exe: '/usr/bin/node', args: ['x.js'] },
      { pid: 13, exe: '/opt/agente-impresion-linux', args: ['--version'] },
    ];
    const r = await listarCopias({ plataforma: 'linux', yo: { pid: 10, ppid: 1, exe: '/opt/agente-impresion-linux' }, procLinux: () => proc, dir: tmp() });
    expect(r.map((c) => c.pid)).toEqual([11]);
  });

  it('en modo desarrollo (sin .exe) no toca nada', async () => {
    expect(await listarCopias({ plataforma: 'linux', yo: { pid: 1, ppid: 0 }, procLinux: () => { throw new Error('no debe llamarse'); } })).toEqual([]);
  });
});

describe('--detener-todo', () => {
  it('cierra todas menos a sí misma, limpia lock y flag huérfanos y lo cuenta', async () => {
    const d = win();
    fs.writeFileSync(rutaBloqueo(d.dir!), JSON.stringify({ pid: 9999 })); // muerto
    fs.writeFileSync(rutaParada(d.dir!), '1');
    const muertos = new Set<number>();
    const terminar = vi.fn(async (pid: number) => { muertos.add(pid); return true; });
    const r = await detenerTodo({ ...d, terminar, vivo: (p) => !muertos.has(p) && p !== 9999 }, 'x.exe');
    expect(terminar).toHaveBeenCalledTimes(1);
    expect(terminar).toHaveBeenCalledWith(200);
    expect(terminar).not.toHaveBeenCalledWith(100);
    expect(r.codigo).toBe(0);
    expect(r.lineas.join('\n')).toContain('Cerré 1 copia: pid 200.');
    expect(fs.existsSync(rutaBloqueo(d.dir!))).toBe(false);
    expect(fs.existsSync(rutaParada(d.dir!))).toBe(false);
  });

  it('la registrada se para primero con el archivo de parada y las demás se cierran a la fuerza', async () => {
    const d = win({ ejecutar: async () => `${SALIDA_PS}\r\n500|2026-11-11T07:00:00.0000000-05:00|${EXE}|"${EXE}"` });
    expect(tomarBloqueo(d.dir!, 500, () => true)).toBe(true);
    const vivos = new Set([100, 200, 500]);
    const terminar = vi.fn(async (pid: number) => { vivos.delete(pid); return true; });
    const r = await detenerTodo({
      ...d, terminar, vivo: (p) => vivos.has(p),
      dormir: async () => { expect(fs.existsSync(rutaParada(d.dir!))).toBe(true); vivos.delete(500); }, // la 500 vio el archivo y salió sola
    });
    expect(terminar.mock.calls.map((c) => c[0])).toEqual([200]);
    expect(r.lineas.join('\n')).toContain('Cerré 2 copias: pid 200, 500.');
  });

  it('avisa si una copia no se deja cerrar (otro usuario o permisos) y sale con 1', async () => {
    const d = win({ ejecutar: async () => `${SALIDA_PS}\r\n600|2026-11-11T07:00:00.0000000-05:00|${EXE}|"${EXE}" --segundo-plano` });
    const r = await detenerTodo({ ...d, terminar: async (p) => p !== 600, vivo: () => true }, 'x.exe');
    expect(r.codigo).toBe(1);
    const t = r.lineas.join('\n');
    expect(t).toContain('Cerré 1 copia: pid 200.');
    expect(t).toContain('✘ No pude cerrar la copia pid 600');
    expect(t).toContain('otro usuario');
  });

  it('sin otras copias lo dice', async () => {
    const d = win({ ejecutar: async () => SALIDA_PS.split('\r\n')[0] });
    const r = await detenerTodo({ ...d, terminar: vi.fn(), vivo: () => true });
    expect(r).toMatchObject({ codigo: 0, lineas: ['No había otras copias del programa corriendo.'] });
  });
});

describe('arranque que cierra copias anteriores', () => {
  it('cierra solo las que arrancaron antes, con el mensaje claro; no toca a la propia, al lanzador ni a otros programas', async () => {
    const d = win();
    const log: string[] = [];
    const terminar = vi.fn(async () => true);
    // 200 (09:00) es anterior a 100 (10:00); 300 es --estado (no cuenta); 400 es el lanzador
    const r = await cerrarCopiasPrevias((m) => log.push(m), { ...d, terminar });
    expect(r.cerradas).toEqual([200]);
    expect(terminar.mock.calls.map((c) => c[0])).toEqual([200]);
    expect(log).toEqual(['Había 1 copia del programa; cerré las anteriores (pid 200).']);
  });

  it('carrera: la más nueva cierra a la más vieja y nunca al revés', async () => {
    const ps = `1|2026-11-11T10:00:00.0000000-05:00|${EXE}|"${EXE}" --segundo-plano\r\n2|2026-11-11T10:00:00.0500000-05:00|${EXE}|"${EXE}" --segundo-plano`;
    const mk = (pid: number) => ({ ...win({ yo: { pid, ppid: 0, exe: EXE }, ejecutar: async () => ps }), terminar: vi.fn(async () => true) });
    const a = mk(1);
    const b = mk(2);
    await cerrarCopiasPrevias(() => undefined, a);
    await cerrarCopiasPrevias(() => undefined, b);
    expect(a.terminar).not.toHaveBeenCalled();
    expect(b.terminar).toHaveBeenCalledWith(1);
  });

  it('empate exacto de hora: desempata el pid', async () => {
    const ps = `1|2026-11-11T10:00:00.0000000-05:00|${EXE}|"${EXE}"\r\n2|2026-11-11T10:00:00.0000000-05:00|${EXE}|"${EXE}"`;
    const t1 = vi.fn(async () => true);
    const t2 = vi.fn(async () => true);
    await cerrarCopiasPrevias(() => undefined, win({ yo: { pid: 1, ppid: 0, exe: EXE }, ejecutar: async () => ps, terminar: t1 }));
    await cerrarCopiasPrevias(() => undefined, win({ yo: { pid: 2, ppid: 0, exe: EXE }, ejecutar: async () => ps, terminar: t2 }));
    expect(t1).not.toHaveBeenCalled();
    expect(t2).toHaveBeenCalledWith(1);
  });

  it('una copia que no se deja cerrar queda en el log y el arranque sigue', async () => {
    const log: string[] = [];
    const r = await cerrarCopiasPrevias((m) => log.push(m), win({ terminar: async () => false }));
    expect(r.fallidas).toEqual([200]);
    expect(log[0]).toContain('AVISO: no pude cerrar la copia pid 200');
  });

  it('si no se puede listar procesos, no falla: solo avisa', async () => {
    const log: string[] = [];
    await expect(cerrarCopiasPrevias((m) => log.push(m), win({ ejecutar: async () => { throw new Error('no'); } }))).resolves.toBeTruthy();
    expect(log[0]).toContain('no se pudo revisar');
  });

  it('--no-cerrar-otras y la variable de entorno lo evitan', () => {
    expect(noCerrarOtras(['node', 'x', '--segundo-plano'], {})).toBe(false);
    expect(noCerrarOtras(['node', 'x', '--segundo-plano', '--no-cerrar-otras'], {})).toBe(true);
    expect(noCerrarOtras(['node', 'x'], { CAPRICHOS_NO_CERRAR_OTRAS: '1' })).toBe(true);
    expect(noCerrarOtras(['node', 'x'], { CAPRICHOS_NO_CERRAR_OTRAS: '0' })).toBe(false);
  });
});

describe('reemplazo de la versión en marcha', () => {
  it('solo se reemplaza una versión anterior o sin versión; igual o más nueva se respeta', () => {
    const dir = tmp();
    expect(reemplazable(dir, () => true, '0.1.63')).toBe(false); // nada en marcha
    fs.writeFileSync(rutaBloqueo(dir), JSON.stringify({ pid: 7 })); // bloqueo de versión vieja: sin versión
    expect(reemplazable(dir, () => true, '0.1.63')).toBe(true);
    fs.writeFileSync(rutaBloqueo(dir), JSON.stringify({ pid: 7, version: '0.1.62' }));
    expect(reemplazable(dir, () => true, '0.1.63')).toBe(true);
    fs.writeFileSync(rutaBloqueo(dir), JSON.stringify({ pid: 7, version: '0.1.63' }));
    expect(reemplazable(dir, () => true, '0.1.63')).toBe(false); // dos nuevas a la vez: la segunda se va
    fs.writeFileSync(rutaBloqueo(dir), JSON.stringify({ pid: 7, version: '0.1.70' }));
    expect(reemplazable(dir, () => true, '0.1.63')).toBe(false);
    expect(reemplazable(dir, () => false, '0.1.63')).toBe(false); // el dueño del bloqueo ya no vive
  });

  it('el bloqueo nuevo guarda la versión', () => {
    const dir = tmp();
    tomarBloqueo(dir, 5, () => true);
    expect(JSON.parse(fs.readFileSync(rutaBloqueo(dir), 'utf-8'))).toMatchObject({ pid: 5, version: expect.any(String) });
  });
});

describe('--estado mejorado', () => {
  const copiasN = (n: number) => async () => Array.from({ length: n }, (_, i) => ({ pid: i + 1 }));

  it('sin red: «No se pudo consultar» y no falla', async () => {
    const l = await lineasExtraEstado({ archivo: { apiUrl: 'http://x' }, consultar: async () => { throw new Error('ECONNREFUSED'); }, copias: copiasN(1), auto: { plataforma: 'linux' } });
    expect(l[0]).toMatch(/^Versión en uso: /);
    expect(l).toContain('Última versión disponible: No se pudo consultar');
    expect(l).toContain('Copias corriendo: 1');
  });

  it('con red muestra la última; con 3 copias advierte con ✘ y el comando', async () => {
    const l = await lineasExtraEstado({ archivo: { apiUrl: 'http://x' }, consultar: async () => '0.1.63', copias: copiasN(3), auto: { plataforma: 'linux' } });
    expect(l).toContain('Última versión disponible: 0.1.63');
    const aviso = l.find((x) => x.includes('Copias corriendo'))!;
    expect(aviso).toContain('✘');
    expect(aviso).toContain('Hay 3 copias: usa --detener-todo y vuelve a abrir el programa');
  });

  it('sin vincular no consulta; muestra el inicio con Windows y su ruta', async () => {
    const consultar = vi.fn();
    const l = await lineasExtraEstado({
      archivo: {}, consultar, copias: copiasN(0),
      auto: { plataforma: 'win32', ejecutable: EXE, ejecutar: async () => `    CaprichosImpresion    REG_SZ    "${EXE}" --segundo-plano` },
    });
    expect(consultar).not.toHaveBeenCalled();
    expect(l).toContain('Última versión disponible: No se pudo consultar');
    expect(l).toContain(`Inicio con Windows: registrado desde ${EXE}`);
  });

  it('el informe completo (estado / --json) suma las copias sin romper lo anterior', async () => {
    const base: any = {
      archivo: { apiUrl: 'http://x', agenteKey: 'k', ticketera: 'tcp://1.1.1.1:9100' }, dir: tmp(), plataforma: 'linux', vivo: () => true,
      listar: async () => [], verificarRed: async () => ({ ok: true }), consultarVersion: async () => undefined,
    };
    tomarBloqueo(base.dir, 1, () => true);
    const uno = await reunirEstado({ ...base, copias: copiasN(1) });
    expect(uno.copias).toEqual({ cantidad: 1, pids: [1] });
    const tres = await reunirEstado({ ...base, copias: copiasN(3) });
    expect(tres.ok).toBe(false);
    expect(formatearEstado(tres).join('\n')).toContain('Hay 3 copias: usa --detener-todo');
    const sin = await reunirEstado(base);
    expect(sin.copias).toBeUndefined();
    expect(formatearEstado(sin).join('\n')).not.toContain('Copias corriendo');
  });
});
