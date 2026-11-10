import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { asegurarInicio, comandoAutoinicio, comandoEstadoPrograma, leerArchivoConfiguracion } from '../cli';
import { rutaRegistrada } from '../autoarranque';
import type { EjecutarReg } from '../autoarranque';
import { formatearEstado, reunirEstado } from '../estadoPrograma';
import type { DepsEstado } from '../estadoPrograma';
import { guardarEstado, rutaBloqueo } from '../segundoPlano';
import type { CandidataLocal } from '../candidatas';

const EXE = 'C:\\Caprichos\\agente.exe';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cap-ai-'));

/** Registro falso de Windows: nada toca la máquina real. */
function regFalso() {
  let valor: string | undefined;
  const llamadas: string[][] = [];
  const ejecutar: EjecutarReg = async (args) => {
    llamadas.push(args);
    if (args[0] === 'add') valor = args[args.indexOf('/d') + 1];
    else if (args[0] === 'delete') {
      if (valor === undefined) throw new Error('no existe');
      valor = undefined;
    } else if (valor === undefined) throw new Error('no existe');
    else return `\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\r\n    CaprichosImpresion    REG_SZ    ${valor}\r\n`;
    return '';
  };
  return { ejecutar, llamadas, valor: () => valor };
}

function entorno(ejecutable = EXE) {
  const reg = regFalso();
  const dir = tmp();
  const rutaConfig = path.join(dir, 'config.json');
  const o = { plataforma: 'win32' as const, ejecutable, ejecutar: reg.ejecutar, rutaConfig };
  return { reg, dir, rutaConfig, o };
}

describe('inicio con Windows', () => {
  it('se registra solo la primera vez y es idempotente', async () => {
    const { reg, dir, o } = entorno();
    await asegurarInicio(() => undefined, dir, o);
    expect(reg.valor()).toBe(`"${EXE}" --segundo-plano`);
    await asegurarInicio(() => undefined, dir, o);
    expect(reg.llamadas.filter((a) => a[0] === 'add')).toHaveLength(1);
  });

  it('si el .exe cambió de ruta, actualiza la entrada', async () => {
    const { reg, dir, o } = entorno();
    await asegurarInicio(() => undefined, dir, o);
    const mensajes: string[] = [];
    await asegurarInicio((m) => mensajes.push(m), dir, { ...o, ejecutable: 'D:\\Nuevo\\agente.exe' });
    expect(reg.valor()).toBe('"D:\\Nuevo\\agente.exe" --segundo-plano');
    expect(mensajes.join()).toContain('actualizado');
    expect(await rutaRegistrada(o)).toBe('D:\\Nuevo\\agente.exe');
  });

  it('desactivar queda recordado: abrir el programa no lo reactiva', async () => {
    const { reg, dir, o, rutaConfig } = entorno();
    await asegurarInicio(() => undefined, dir, o);
    expect(await comandoAutoinicio('desactivar', () => undefined, dir, o)).toBe(0);
    expect(reg.valor()).toBeUndefined();
    expect(leerArchivoConfiguracion(rutaConfig).autoinicioDesactivado).toBe(true);
    await asegurarInicio(() => undefined, dir, o);
    expect(reg.valor()).toBeUndefined();
    // y «activar» lo vuelve a permitir
    expect(await comandoAutoinicio('activar', () => undefined, dir, o)).toBe(0);
    expect(reg.valor()).toBe(`"${EXE}" --segundo-plano`);
    expect(leerArchivoConfiguracion(rutaConfig).autoinicioDesactivado).toBeUndefined();
  });

  it('instalación vieja que ya lo había quitado (marca sin registro) no se reactiva', async () => {
    const { reg, dir, o, rutaConfig } = entorno();
    fs.writeFileSync(path.join(dir, 'inicio-configurado'), 'x');
    await asegurarInicio(() => undefined, dir, o);
    expect(reg.valor()).toBeUndefined();
    expect(leerArchivoConfiguracion(rutaConfig).autoinicioDesactivado).toBe(true);
  });

  it('sin .exe (node) o en Linux/mac no registra nada ni falla', async () => {
    const { reg, dir, o } = entorno();
    await asegurarInicio(() => undefined, dir, { ...o, ejecutable: undefined, plataforma: 'win32' });
    const mensajes: string[] = [];
    expect(await comandoAutoinicio('activar', (m) => mensajes.push(m), dir, { ...o, plataforma: 'darwin' })).toBe(1);
    expect(mensajes[0]).toContain('solo está disponible en Windows y Linux');
    expect(reg.llamadas).toHaveLength(0);
  });
});

describe('estado', () => {
  const impresora = (id: string, estadoSpooler = 'Normal'): CandidataLocal =>
    ({ id, nombre: id, destino: id, estadoSpooler }) as unknown as CandidataLocal;

  function deps(extra: Partial<DepsEstado> = {}, archivo: DepsEstado['archivo'] = {}) {
    const { reg, o } = entorno();
    void reg.ejecutar(['add', 'k', '/v', 'v', '/d', `"${EXE}" --segundo-plano`]);
    const dir = tmp();
    const d: DepsEstado = {
      ...o,
      dir,
      archivo: { apiUrl: 'https://demo.test', agenteKey: 'SECRETO-123', etiquetera: 'Etiq', ticketera: 'Tick', ...archivo },
      vivo: () => true,
      listar: async () => [impresora('Etiq'), impresora('Tick')],
      verificarRed: async () => ({ ok: true }),
      consultarVersion: async () => '0.1.9999',
      ...extra,
    };
    fs.writeFileSync(rutaBloqueo(dir), JSON.stringify({ pid: 4242 }));
    guardarEstado({ pid: 4242, inicio: 'x', ultimaConexionOk: '2026-11-10T10:00:00Z' }, dir);
    return d;
  }

  it('todo bien: salida 0 y ✔ en cada línea', async () => {
    const e = await reunirEstado(deps());
    expect(e.ok).toBe(true);
    expect(e.hayVersionNueva).toBe(true); // informativo, no cuenta como fallo
    const txt = formatearEstado(e).join('\n');
    expect(txt).toContain('✔ Iniciar con Windows: registrado');
    expect(txt).toContain('último latido 2026-11-10T10:00:00Z');
    expect(txt).toContain('Todo en orden');
  });

  it('sin vincular', async () => {
    const e = await reunirEstado(deps({}, { agenteKey: undefined }));
    expect(e.ok).toBe(false);
    expect(e.vinculado.ok).toBe(false);
    expect(formatearEstado(e).join('\n')).toContain('✘ Vinculado');
  });

  it('sin conexión con el sistema muestra el error legible', async () => {
    const e = await reunirEstado(deps({ consultarVersion: async () => { throw new Error('ECONNREFUSED'); } }));
    expect(e.ok).toBe(false);
    expect(e.conexion.error).toContain('ECONNREFUSED');
  });

  it('impresora no encontrada o sin conexión en Windows', async () => {
    let e = await reunirEstado(deps({ listar: async () => [impresora('Tick')] }));
    expect(e.ok).toBe(false);
    expect(e.impresoras[0]).toMatchObject({ rol: 'ETIQUETERA', ok: false });
    e = await reunirEstado(deps({ listar: async () => [impresora('Etiq', 'Offline'), impresora('Tick')] }));
    expect(e.impresoras[0].detalle).toContain('Offline');
  });

  it('impresora por red (IP fija) usa la comprobación de red', async () => {
    const e = await reunirEstado(deps({ verificarRed: async () => ({ ok: false, detalle: 'sin respuesta' }) }, { etiquetera: 'tcp://10.0.0.5:9100' }));
    expect(e.impresoras[0]).toMatchObject({ ok: false, detalle: 'sin respuesta' });
  });

  it('ruta registrada distinta, y ya hay otra instancia corriendo', async () => {
    const d = deps({ ejecutable: 'D:\\otra\\agente.exe' });
    const e = await reunirEstado(d);
    expect(e.autoinicio.ok).toBe(false);
    expect(e.instancia).toEqual({ corriendo: true, pid: 4242 });
    const sin = await reunirEstado({ ...d, vivo: () => false });
    expect(sin.instancia.corriendo).toBe(false);
  });

  it('--json no trae la llave y el código de salida refleja el resultado', async () => {
    const salida: string[] = [];
    const codigo = await comandoEstadoPrograma(true, (m) => salida.push(m), deps());
    expect(codigo).toBe(0);
    expect(salida.join('')).not.toContain('SECRETO-123');
    expect(JSON.parse(salida.join('')).ok).toBe(true);
    const mal = await comandoEstadoPrograma(true, () => undefined, deps({}, { agenteKey: undefined }));
    expect(mal).toBe(1);
  });

  it('en Linux el inicio con Windows no aplica y no falla', async () => {
    const e = await reunirEstado(deps({ plataforma: 'linux', ejecutable: undefined, dirAutostart: tmp() }));
    expect(e.autoinicio).toMatchObject({ aplica: false, ok: true });
    expect(formatearEstado(e)[0]).toContain('no aplica');
  });
});
