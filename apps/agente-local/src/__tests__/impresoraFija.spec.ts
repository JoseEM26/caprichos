import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgenteLocalServicio } from '../agente/bucle';
import type { EquipoLocal } from '../agente/bucle';
import { ImpresoraMemoria } from '../impresora/impresoraMemoria';
import { obtenerConfiguracion } from '../config';
import {
  candidatasDeLinux,
  candidatasDeWindows,
  esImpresoraVirtual,
  filtrarImpresorasWindows,
  idGuardado,
  paraServidor,
} from '../candidatas';
import type { CandidataLocal } from '../candidatas';
import { guardarImpresoraElegida, crearEquipoLocal } from '../cli';
import { generarPruebaEtiqueta, generarPruebaTicket } from '../pruebaImpresora';
import { activarAutoarranque, autoarranqueActivo, desactivarAutoarranque } from '../autoarranque';

describe('lista de impresoras candidatas', () => {
  const win = [
    { nombre: 'Microsoft Print to PDF', driver: 'Microsoft Print To PDF', puerto: 'PORTPROMPT:' },
    { nombre: 'OneNote (Desktop)', puerto: 'nul:' },
    { nombre: 'Fax', puerto: 'SHRFAX:' },
    { nombre: 'Microsoft XPS Document Writer', puerto: 'PORTPROMPT:' },
    { nombre: 'TSC TTP-247', driver: 'TSC TTP-247', puerto: 'USB001' },
    { nombre: 'XP-80C', driver: 'XP-80C', puerto: 'USB002' },
    { nombre: 'XP-80C (Copiar 1)', driver: 'XP-80C', puerto: 'USB003' },
    { nombre: 'HP LaserJet (Copiar 2)', puerto: 'IP_1' },
  ];

  it('quita PDF, OneNote, Fax y XPS', () => {
    expect(esImpresoraVirtual(win[0])).toBe(true);
    expect(esImpresoraVirtual(win[1])).toBe(true);
    expect(esImpresoraVirtual(win[2])).toBe(true);
    expect(esImpresoraVirtual(win[3])).toBe(true);
    expect(esImpresoraVirtual(win[4])).toBe(false);
  });

  it('quita el duplicado (Copiar 1) solo si la original está; si no, lo deja', () => {
    expect(filtrarImpresorasWindows(win).map((i) => i.nombre)).toEqual(['TSC TTP-247', 'XP-80C', 'HP LaserJet (Copiar 2)']);
  });

  it('en Windows el id estable es el nombre exacto del spooler y sugiere el rol por el nombre', () => {
    const c = candidatasDeWindows(win);
    expect(c[0]).toMatchObject({ id: 'TSC TTP-247', destino: 'TSC TTP-247', sugerido: 'ETIQUETERA', detalle: 'TSC TTP-247 · puerto USB001' });
  });

  it('en Linux el id es modelo|serie, y la ruta si dos impresoras son idénticas', () => {
    const c = candidatasDeLinux([
      { destino: '/dev/usb/lp0', modelo: 'TSC 4B', identidad: 'TSC 4B|1', sugerido: 'ETIQUETERA' },
      { destino: '/dev/usb/lp1', modelo: 'POS', identidad: 'POS' },
      { destino: '/dev/usb/lp2', modelo: 'POS', identidad: 'POS' },
    ]);
    expect(c.map((x) => x.id)).toEqual(['TSC 4B|1', '/dev/usb/lp1', '/dev/usb/lp2']);
  });

  it('al servidor no viaja la ruta ni la identidad interna', () => {
    const c = candidatasDeWindows(win)[0];
    expect(Object.keys(paraServidor(c)).sort()).toEqual(['detalle', 'id', 'nombre', 'sugerido']);
  });

  it('idGuardado usa la identidad si existe', () => {
    expect(idGuardado('/dev/usb/lp3', 'TSC 4B|1')).toBe('TSC 4B|1');
    expect(idGuardado('XP-80C')).toBe('XP-80C');
    expect(idGuardado(undefined)).toBeUndefined();
  });
});

describe('elección guardada en config.json', () => {
  it('guarda destino e identidad conservando lo demás, y el equipo la reconoce como actual', () => {
    const ruta = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cap-')), 'config.json');
    fs.writeFileSync(ruta, JSON.stringify({ apiUrl: 'https://x', agenteKey: 'k', ticketera: 'POS' }));
    const c: CandidataLocal = { id: 'TSC 4B|1', nombre: 'TSC 4B', destino: '/dev/usb/lp5', identidad: 'TSC 4B|1' };
    const nuevo = guardarImpresoraElegida('ETIQUETERA', c, ruta);
    expect(nuevo).toMatchObject({ apiUrl: 'https://x', agenteKey: 'k', ticketera: 'POS', etiquetera: '/dev/usb/lp5', etiqueteraId: 'TSC 4B|1' });
    expect(JSON.parse(fs.readFileSync(ruta, 'utf-8')).etiqueteraId).toBe('TSC 4B|1');
    const equipo = crearEquipoLocal(nuevo, ruta);
    expect(equipo.idActual('ETIQUETERA')).toBe('TSC 4B|1');
    expect(equipo.idActual('TICKETERA')).toBe('POS');
  });
});

describe('bucle con elección y pruebas por impresora', () => {
  const cand = (id: string, nombre = id): CandidataLocal => ({ id, nombre, destino: id });

  function montar(candidatas: CandidataLocal[], actual: Record<string, string | undefined> = {}) {
    const guardadas: Array<[string, string]> = [];
    const creados: Record<string, ImpresoraMemoria> = {};
    const equipo: EquipoLocal = {
      listar: async () => candidatas,
      crear: (c) => (creados[c.id] ??= new ImpresoraMemoria()),
      idActual: (rol) => actual[rol],
      guardar: (rol, c) => {
        guardadas.push([rol, c.id]);
        actual[rol] = c.id;
      },
    };
    const cliente: any = {
      tomarTrabajos: vi.fn().mockResolvedValue([]),
      reportarResultado: vi.fn().mockResolvedValue(undefined),
      enviarLatido: vi.fn().mockResolvedValue({}),
    };
    const et = new ImpresoraMemoria();
    const agente = new AgenteLocalServicio({
      config: { ...obtenerConfiguracion({}), intervaloLatidoMs: 0 },
      clienteApi: cliente,
      impresoras: { ETIQUETERA: et },
      equipo,
      logger: () => undefined,
    });
    return { cliente, agente, guardadas, creados, et };
  }

  it('manda las candidatas y la impresora en uso en cada latido', async () => {
    const { cliente, agente } = montar([cand('A', 'Impresora A')], { ETIQUETERA: 'A' });
    await agente.ejecutarCiclo();
    const [, , , rep, lista] = cliente.enviarLatido.mock.calls[0];
    expect(rep[0]).toMatchObject({ rol: 'ETIQUETERA', id: 'A', nombre: 'Impresora A' });
    expect(lista).toEqual([{ id: 'A', nombre: 'Impresora A' }]);
  });

  it('aplica la elección del panel: la guarda y la usa; no repite si ya es la actual', async () => {
    const { cliente, agente, guardadas } = montar([cand('A'), cand('B')], { ETIQUETERA: 'A' });
    cliente.enviarLatido.mockResolvedValue({ seleccion: { ETIQUETERA: 'B' } });
    await agente.ejecutarCiclo();
    expect(guardadas).toEqual([['ETIQUETERA', 'B']]);
    await agente.ejecutarCiclo();
    expect(guardadas).toHaveLength(1);
  });

  it('si la elegida no está en el equipo, NO cambia a otra por su cuenta', async () => {
    const { cliente, agente, guardadas } = montar([cand('A')], { ETIQUETERA: 'A' });
    cliente.enviarLatido.mockResolvedValue({ seleccion: { ETIQUETERA: 'Z' } });
    await agente.ejecutarCiclo();
    expect(guardadas).toEqual([]);
  });

  it('con la impresora guardada ausente informa el motivo y sigue pidiendo pruebas', async () => {
    const { cliente, agente, et } = montar([], { ETIQUETERA: 'A' });
    et.establecerEstado({ estado: 'desconectada', detalle: 'Impresora guardada no encontrada: A' });
    await agente.ejecutarCiclo();
    expect(cliente.enviarLatido.mock.calls[0][3][0]).toMatchObject({ estado: 'desconectada', detalle: 'Impresora guardada no encontrada: A' });
    expect(cliente.tomarTrabajos).toHaveBeenCalledWith(10, [], true);
  });

  it('imprime una prueba dirigida en ESA impresora con su nombre, aunque la máquina no esté lista, y confirma', async () => {
    const { cliente, agente, creados, et } = montar([cand('B', 'POS-80')], { ETIQUETERA: 'A' });
    et.establecerEstado({ estado: 'desconectada' });
    cliente.tomarTrabajos.mockResolvedValueOnce([
      { id: '7', tipo: 'TICKET_PAGO', payload: { prueba: { impresoraId: 'B', nombre: 'POS-80' } }, copia: false, intentos: 0 },
    ]);
    await agente.ejecutarCiclo();
    expect(creados.B.obtenerTrabajosEscritos()).toHaveLength(1);
    expect(creados.B.obtenerTrabajosEscritos()[0].toString('latin1')).toContain('Impresora: POS-80');
    expect(et.obtenerTrabajosEscritos()).toHaveLength(0);
    expect(cliente.reportarResultado).toHaveBeenCalledWith('7', true);
  });

  it('prueba a una impresora que ya no está: reporta el motivo en español', async () => {
    const { cliente, agente } = montar([], { ETIQUETERA: 'A' });
    cliente.tomarTrabajos.mockResolvedValueOnce([
      { id: '8', tipo: 'ETIQUETA_GENERAL', payload: { prueba: { impresoraId: 'B', nombre: 'POS-80' } }, copia: false, intentos: 0 },
    ]);
    await agente.ejecutarCiclo();
    expect(cliente.reportarResultado).toHaveBeenCalledWith('8', false, 'Impresora no encontrada: POS-80');
  });
});

describe('hojas de prueba', () => {
  const fecha = new Date(2026, 10, 7, 9, 5);
  it('el ticket trae nombre, rol, fecha, caracteres, raya y corte', () => {
    const t = generarPruebaTicket('XP-80C', 'TICKETERA', 32, fecha).toString('latin1');
    for (const x of ['CAPRICHOS - PRUEBA DE IMPRESION', 'Impresora: XP-80C', 'Rol: Ticketera', '07/11/2026 09:05', 'ABCDEFGHIJ', '-'.repeat(32)]) {
      expect(t).toContain(x);
    }
    expect(t).not.toContain('-'.repeat(33));
    expect(t.endsWith('\x1dV\x42\x00')).toBe(true);
  });
  it('la etiqueta es TSPL con el tamaño configurado, marco y PRINT', () => {
    const t = generarPruebaEtiqueta('TSC 4B', 'ETIQUETERA', { anchoMm: 80, altoMm: 50 }, fecha).toString('latin1');
    expect(t).toContain('SIZE 80 mm,50 mm');
    expect(t).toContain('Impresora: TSC 4B');
    expect(t).toContain('BOX 8,8,632,392');
    expect(t).toContain('PRINT 1,1');
  });
});

describe('arranque automático (con funciones simuladas; sin probar en Windows real)', () => {
  it('activar registra el .exe en HKCU\\...\\Run con /f', async () => {
    const ejecutar = vi.fn().mockResolvedValue('');
    const r = await activarAutoarranque({ plataforma: 'win32', ejecutable: 'C:\\Caprichos\\agente.exe', ejecutar });
    expect(r.ok).toBe(true);
    expect(ejecutar).toHaveBeenCalledWith(['add', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', '/v', 'CaprichosImpresion', '/t', 'REG_SZ', '/d', '"C:\\Caprichos\\agente.exe"', '/f']);
  });
  it('no activa fuera de Windows ni ejecutando con node', async () => {
    const ejecutar = vi.fn();
    expect((await activarAutoarranque({ plataforma: 'linux', ejecutable: 'x', ejecutar })).ok).toBe(false);
    expect((await activarAutoarranque({ plataforma: 'win32', ejecutable: undefined, ejecutar })).mensaje).toContain('.exe');
    expect(ejecutar).not.toHaveBeenCalled();
  });
  it('estado: activo si reg query encuentra la entrada', async () => {
    expect(await autoarranqueActivo({ plataforma: 'win32', ejecutar: vi.fn().mockResolvedValue('ok') })).toBe(true);
    expect(await autoarranqueActivo({ plataforma: 'win32', ejecutar: vi.fn().mockRejectedValue(new Error('no')) })).toBe(false);
  });
  it('desactivar borra la entrada; si no existía, lo dice sin error', async () => {
    const ok = vi.fn().mockResolvedValue('');
    expect((await desactivarAutoarranque({ plataforma: 'win32', ejecutar: ok })).ok).toBe(true);
    const falla = vi.fn().mockRejectedValue(new Error('no existe'));
    const r = await desactivarAutoarranque({ plataforma: 'win32', ejecutar: falla });
    expect(r).toMatchObject({ ok: true, mensaje: expect.stringContaining('ya estaba desactivado') });
  });
});
