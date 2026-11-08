import { describe, it, expect, vi } from 'vitest';
import type { RolImpresora } from '@caprichos/compartido';
import { candidatasDeWindows } from '../candidatas';
import type { CandidataLocal } from '../candidatas';
import { decidirAutomatica, elegirAutomatica, lineasDiagnostico, mensajeConexion } from '../autoUsb';
import { AgenteLocalServicio } from '../agente/bucle';
import type { EquipoLocal } from '../agente/bucle';
import { ImpresoraMemoria } from '../impresora/impresoraMemoria';
import { ImpresoraWindows } from '../impresora/impresoraWindows';
import { obtenerConfiguracion } from '../config';

const taller = () =>
  candidatasDeWindows([
    { nombre: 'Microsoft Print to PDF', driver: 'Microsoft Print To PDF', puerto: 'PORTPROMPT:' },
    { nombre: 'OneNote (Desktop)', puerto: 'nul:' },
    { nombre: '4BARCODE 3B-303B', driver: '4BARCODE 3B-303B', puerto: 'USB002', estado: 'Normal' },
    { nombre: 'POS-80C', driver: 'POS-80C', puerto: 'USB001', estado: 'Normal' },
    { nombre: 'HP LaserJet', driver: 'HP', puerto: 'IP_10.0.0.5' },
  ]);

describe('elección automática por USB', () => {
  it('una POS-80 en USB001 + una 4BARCODE + virtuales: ticketera y etiquetera', () => {
    const d = decidirAutomatica(taller(), () => undefined);
    expect(d.map((x) => [x.rol, x.candidata.nombre])).toEqual([
      ['TICKETERA', 'POS-80C'],
      ['ETIQUETERA', '4BARCODE 3B-303B'],
    ]);
    expect(mensajeConexion(d[0])).toBe('Conecté la ticketera POS-80C por USB001');
  });

  it('sin impresoras: no decide nada y no falla', () => {
    expect(decidirAutomatica([], () => undefined)).toEqual([]);
  });

  it('solo virtuales y una de red: nada que conectar', () => {
    const lista = candidatasDeWindows([
      { nombre: 'Microsoft Print to PDF', puerto: 'PORTPROMPT:' },
      { nombre: 'HP LaserJet', puerto: 'IP_1' },
    ]);
    expect(decidirAutomatica(lista, () => undefined)).toEqual([]);
  });

  it('respeta la guardada válida (también una de red)', () => {
    expect(decidirAutomatica(taller(), (r: RolImpresora) => (r === 'TICKETERA' ? 'POS-80C' : '4BARCODE 3B-303B'))).toEqual([]);
    expect(decidirAutomatica(taller(), (r: RolImpresora) => (r === 'TICKETERA' ? 'tcp://10.0.0.9:9100' : '4BARCODE 3B-303B'))).toEqual([]);
  });

  it('guardada ausente: toma la primera USB que sirve y lo avisa', () => {
    const d = decidirAutomatica(taller(), (r: RolImpresora) => (r === 'TICKETERA' ? 'POS-80 vieja' : '4BARCODE 3B-303B'));
    expect(d).toHaveLength(1);
    expect(d[0].reemplaza).toBe('POS-80 vieja');
    expect(mensajeConexion(d[0])).toContain('ya no aparece');
  });

  it('varias del mismo rol: la primera (la POS-80 de la casa antes que otras) y registra las demás', () => {
    const lista = candidatasDeWindows([
      { nombre: 'XPrinter XP-58', driver: 'XP-58', puerto: 'USB003' },
      { nombre: 'POS-80', driver: 'POS-80', puerto: 'USB001' },
    ]);
    const d = decidirAutomatica(lista, () => undefined);
    expect(d[0].candidata.nombre).toBe('POS-80');
    expect(mensajeConexion(d[0])).toContain('había más: XPrinter XP-58');
  });

  it('una ticketera que Windows ve sin conexión queda detrás de una en línea', () => {
    const lista = candidatasDeWindows([
      { nombre: 'POS-80 (Copiar 1)', driver: 'POS-80C', puerto: 'USB003', workOffline: true },
      { nombre: 'XPrinter XP-80', driver: 'XP-80', puerto: 'USB004', estado: 'Normal' },
    ]);
    expect(elegirAutomatica(lista, 'TICKETERA')?.nombre).toBe('XPrinter XP-80');
  });

  it('una ticketera por USB nunca se elige como etiquetera', () => {
    expect(elegirAutomatica(taller(), 'ETIQUETERA')?.nombre).toBe('4BARCODE 3B-303B');
    expect(decidirAutomatica(taller().filter((c) => c.nombre === 'POS-80C'), () => undefined).map((x) => x.rol)).toEqual(['TICKETERA']);
  });

  it('diagnóstico: lista puerto, driver, estado y qué elegiría', () => {
    const t = lineasDiagnostico(taller(), () => undefined).join('\n');
    expect(t).toContain('puerto: USB001');
    expect(t).toContain('ticketera: elegiría POS-80C (USB001)');
    expect(t).toContain('etiquetera: elegiría 4BARCODE 3B-303B (USB002)');
    expect(lineasDiagnostico([], () => undefined).join('\n')).toContain('No veo ninguna impresora');
  });
});

describe('bucle: conexión automática y hot-plug', () => {
  function montar(lista: () => CandidataLocal[], guardadas: Partial<Record<RolImpresora, string>> = {}) {
    const logs: string[] = [];
    const guardado = { ...guardadas };
    const equipo: EquipoLocal = {
      listar: async () => lista(),
      crear: () => new ImpresoraMemoria(),
      idActual: (rol) => guardado[rol],
      guardar: (rol, c) => {
        guardado[rol] = c.id;
      },
    };
    const cliente: any = {
      tomarTrabajos: vi.fn().mockResolvedValue([]),
      reportarResultado: vi.fn().mockResolvedValue(undefined),
      enviarLatido: vi.fn().mockResolvedValue({}),
    };
    const agente = new AgenteLocalServicio({
      config: { ...obtenerConfiguracion({}), intervaloLatidoMs: 0 },
      clienteApi: cliente,
      impresoras: {},
      equipo,
      logger: (n, m) => logs.push(`${n}: ${m}`),
    });
    return { agente, guardado, logs, cliente };
  }

  it('hot-plug: sin impresoras espera sin errores; al enchufar la USB se conecta sola y la guarda', async () => {
    let conectada = false;
    const { agente, guardado, logs, cliente } = montar(() => (conectada ? taller() : []));
    await agente.ejecutarCiclo();
    await agente.ejecutarCiclo();
    expect(guardado).toEqual({});
    expect(logs.filter((l) => l.startsWith('error') || l.startsWith('warn'))).toEqual([]);
    conectada = true;
    await agente.ejecutarCiclo();
    expect(guardado).toEqual({ TICKETERA: 'POS-80C', ETIQUETERA: '4BARCODE 3B-303B' });
    expect(logs).toContain('info: Conecté la ticketera POS-80C por USB001');
    expect(cliente.enviarLatido.mock.calls.at(-1)[3].map((r: any) => r.rol).sort()).toEqual(['ETIQUETERA', 'TICKETERA']);
  });

  it('al conectarse sola imprime una hoja de prueba en cada impresora (una sola vez)', async () => {
    const hojas: Buffer[] = [];
    const logs: string[] = [];
    const equipo: EquipoLocal = {
      listar: async () => taller(),
      crear: () => ({ escribir: async (b: Buffer) => { hojas.push(b); }, verificarEstado: async () => 'lista' } as any),
      idActual: () => undefined,
      guardar: () => undefined,
    };
    const cliente: any = {
      tomarTrabajos: vi.fn().mockResolvedValue([]),
      reportarResultado: vi.fn().mockResolvedValue(undefined),
      enviarLatido: vi.fn().mockResolvedValue({}),
    };
    const agente = new AgenteLocalServicio({
      config: { ...obtenerConfiguracion({}), intervaloLatidoMs: 0 },
      clienteApi: cliente,
      impresoras: {},
      equipo,
      logger: (n, m) => logs.push(`${n}: ${m}`),
    });
    await agente.ejecutarCiclo();
    await new Promise((r) => setTimeout(r, 20));
    expect(hojas).toHaveLength(2);
    expect(hojas.some((b) => b.toString('latin1').includes('CONECTADA'))).toBe(true);
    expect(logs.some((l) => l.includes('Imprimí una hoja de prueba en la ticketera'))).toBe(true);
  });

  it('avisa una sola vez que no ve impresora USB aunque haya otras impresoras', async () => {
    const solo = candidatasDeWindows([{ nombre: 'HP LaserJet', puerto: 'IP_1' }]);
    const { agente, logs } = montar(() => solo);
    await agente.ejecutarCiclo();
    await agente.ejecutarCiclo();
    expect(logs.filter((l) => l.includes('Aún no veo una ticketera por USB'))).toHaveLength(1);
  });

  it('guardada ausente: se conecta a la USB que sí aparece', async () => {
    const { agente, guardado } = montar(() => taller(), { TICKETERA: 'POS-80 vieja', ETIQUETERA: '4BARCODE 3B-303B' });
    await agente.ejecutarCiclo();
    expect(guardado.TICKETERA).toBe('POS-80C');
    expect(guardado.ETIQUETERA).toBe('4BARCODE 3B-303B');
  });
});

describe('envío RAW a Windows más tolerante', () => {
  it('reintenta y termina imprimiendo', async () => {
    const ejecutar = vi.fn().mockRejectedValueOnce(new Error('El spooler rechazó los datos')).mockResolvedValue('');
    const pausa = vi.fn().mockResolvedValue(undefined);
    await new ImpresoraWindows('POS-80C', ejecutar as any, pausa).escribir(Buffer.from('x'));
    expect(ejecutar).toHaveBeenCalledTimes(2);
    expect(pausa).toHaveBeenCalledTimes(1);
  });

  it('si sigue fallando, explica que está sin conexión', async () => {
    const ejecutar = vi.fn(async (script: string) => {
      if (script.includes('PrinterStatus')) return 'Offline|True';
      throw new Error('boom');
    });
    await expect(new ImpresoraWindows('POS-80C', ejecutar as any, async () => undefined).escribir(Buffer.from('x'))).rejects.toThrow(/sin conexión.*cable USB/);
    expect(ejecutar.mock.calls.filter(([s]) => !s.includes('PrinterStatus'))).toHaveLength(3);
  });
});
