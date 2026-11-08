import { describe, it, expect, vi } from 'vitest';
import type { ConfigEquipoParaAgente, RolImpresora } from '@caprichos/compartido';
import { PRESETS_TAMANO_ETIQUETA } from '@caprichos/compartido';
import { candidatasDeWindows } from '../../candidatas';
import { AgenteLocalServicio, leerInfoEquipo } from '../bucle';
import type { EquipoLocal } from '../bucle';
import { ImpresoraMemoria } from '../../impresora/impresoraMemoria';
import { obtenerConfiguracion } from '../../config';
import { generarEtiquetaBebida, generarEtiquetaGeneral } from '../../tspl/generadorTspl';
import { muestraEtiquetaBebida, muestraEtiquetaGeneral } from '../../datosMuestra';

const taller = () =>
  candidatasDeWindows([
    { nombre: '4BARCODE 3B-303B', driver: '4BARCODE 3B-303B', puerto: 'USB002', estado: 'Normal' },
    { nombre: 'POS-80C', driver: 'POS-80C', puerto: 'USB001', estado: 'Normal' },
    { nombre: 'TSC Segunda', driver: 'TSC TTP-244', puerto: 'USB005', estado: 'Normal' },
  ]);

const cfg = (c: Partial<ConfigEquipoParaAgente> = {}): ConfigEquipoParaAgente => ({ ticketera: true, etiquetera: true, pausado: false, configurado: true, ...c });

function montar(respuestas: any[]) {
  const guardado: Partial<Record<RolImpresora, string>> = {};
  const logs: string[] = [];
  const equipo: EquipoLocal = {
    listar: async () => taller(),
    crear: () => new ImpresoraMemoria(),
    idActual: (rol) => guardado[rol],
    guardar: (rol, c) => {
      guardado[rol] = c.id;
    },
  };
  const cliente: any = {
    tomarTrabajos: vi.fn().mockResolvedValue([]),
    reportarResultado: vi.fn().mockResolvedValue(undefined),
    enviarLatido: vi.fn(async () => respuestas.shift() ?? {}),
  };
  const agente = new AgenteLocalServicio({
    config: { ...obtenerConfiguracion({}), intervaloLatidoMs: 0 },
    clienteApi: cliente,
    impresoras: {},
    equipo,
    infoEquipo: () => ({ hostname: 'CAJA-PC', sistema: 'win32 10', ipLocal: ['192.168.1.20'] }),
    logger: (n, m) => logs.push(`${n}: ${m}`),
  });
  return { agente, guardado, logs, cliente };
}

describe('el programa aplica la configuración que llega en el latido, sin reiniciar', () => {
  it('reporta nombre, sistema e IP local de la computadora en cada latido', async () => {
    const { agente, cliente } = montar([]);
    await agente.ejecutarCiclo();
    expect(cliente.enviarLatido.mock.calls[0][5]).toEqual({ hostname: 'CAJA-PC', sistema: 'win32 10', ipLocal: ['192.168.1.20'] });
  });

  it('leerInfoEquipo trae hostname, sistema y solo IPv4 externas', () => {
    const i = leerInfoEquipo();
    expect(i.hostname).toBeTruthy();
    expect(i.sistema).toContain(process.platform);
    expect((i.ipLocal ?? []).every((ip) => /^\d+\.\d+\.\d+\.\d+$/.test(ip) && !ip.startsWith('127.'))).toBe(true);
  });

  it('PC nueva sin configurar: sigue la autodetección USB (así el dueño ve y prueba las impresoras) y lo avisa', async () => {
    const { agente, guardado, logs } = montar([{ equipo: cfg({ configurado: false, ticketera: false, etiquetera: false }) }]);
    await agente.ejecutarCiclo();
    await agente.ejecutarCiclo();
    expect(guardado).toEqual({ TICKETERA: 'POS-80C', ETIQUETERA: '4BARCODE 3B-303B' });
    expect(logs.some((l) => l.includes('aún no está configurada'))).toBe(true);
  });

  it('al apagar la etiquetera en el panel, deja de tomar sus trabajos en el siguiente ciclo y sigue con la ticketera', async () => {
    const { agente, guardado, cliente } = montar([{}, { equipo: cfg({ etiquetera: false }) }, {}]);
    await agente.ejecutarCiclo();
    expect(cliente.tomarTrabajos.mock.calls.at(-1)[1]).toEqual(['ETIQUETERA', 'TICKETERA']);
    await agente.ejecutarCiclo();
    await agente.ejecutarCiclo();
    expect(guardado.TICKETERA).toBe('POS-80C');
    const roles = cliente.tomarTrabajos.mock.calls.at(-1)[1];
    expect(roles).toEqual(['TICKETERA']);
  });

  it('si el dueño elige otra impresora por rol, la usa en cuanto aparece; la autodetección USB sigue si no hay elección', async () => {
    const { agente, guardado, logs } = montar([{ equipo: cfg(), seleccion: { ETIQUETERA: 'TSC Segunda' } }]);
    await agente.ejecutarCiclo();
    expect(guardado.ETIQUETERA).toBe('TSC Segunda');
    expect(guardado.TICKETERA).toBe('POS-80C');
    expect(logs).toContain('info: La etiquetera ahora es: TSC Segunda');
  });

  it('una elección que no aparece no cambia nada por su cuenta', async () => {
    const { agente, guardado, logs } = montar([{ seleccion: { ETIQUETERA: 'No existe' } }]);
    await agente.ejecutarCiclo();
    expect(guardado.ETIQUETERA).toBe('4BARCODE 3B-303B');
    expect(logs.some((l) => l.includes('no encontrada: No existe'))).toBe(true);
  });
});

describe('el tamaño de la PC llega al TSPL', () => {
  const tspl = async (tipo: 'ETIQUETA_BEBIDA' | 'ETIQUETA_GENERAL', payload: any, config: Partial<ConfigEquipoParaAgente> & { tamanoBebida?: any; tamanoGeneral?: any }) => {
    const escrituras: Buffer[] = [];
    const et = new ImpresoraMemoria();
    const cliente: any = {
      tomarTrabajos: vi.fn().mockResolvedValueOnce([{ id: '1', tipo, payload, copia: false, intentos: 0 }]).mockResolvedValue([]),
      reportarResultado: vi.fn().mockResolvedValue(undefined),
      enviarLatido: vi.fn().mockResolvedValue({ equipo: cfg(config) }),
    };
    const agente = new AgenteLocalServicio({
      config: { ...obtenerConfiguracion({}), intervaloLatidoMs: 0 },
      clienteApi: cliente,
      impresoras: { ETIQUETERA: et },
      equipo: { listar: async () => [], crear: () => et, idActual: () => 'x', guardar: () => undefined },
      infoEquipo: () => ({}),
      logger: () => undefined,
    });
    await agente.ejecutarCiclo(); // aplica la config del latido y toma el trabajo
    escrituras.push(...et.obtenerTrabajosEscritos());
    return escrituras.map((b) => b.toString('latin1')).join('');
  };

  it('sin tamanoMm en el trabajo usa el tamaño propio de la PC (con décimas, como 101,6 x 63,5)', async () => {
    const t = await tspl('ETIQUETA_BEBIDA', muestraEtiquetaBebida, { tamanoBebida: { anchoMm: 101.6, altoMm: 63.5 } });
    expect(t).toContain('SIZE 101.6 mm,63.5 mm');
  });

  it('sin tamaño propio hereda el general de fábrica (bebida 76 x 38, general 100 x 100)', async () => {
    expect(await tspl('ETIQUETA_BEBIDA', muestraEtiquetaBebida, {})).toContain('SIZE 76 mm,38 mm');
    expect(await tspl('ETIQUETA_GENERAL', muestraEtiquetaGeneral, {})).toContain('SIZE 100 mm,100 mm');
  });

  it('el tamaño que ya manda el servidor (propio de la PC, o de una prueba) no se pisa', async () => {
    const t = await tspl('ETIQUETA_GENERAL', { ...muestraEtiquetaGeneral, tamanoMm: { anchoMm: 60, altoMm: 40 } }, { tamanoGeneral: { anchoMm: 80, altoMm: 80 } });
    expect(t).toContain('SIZE 60 mm,40 mm');
  });
});

describe('TSPL con cada medida común: el SIZE es el elegido y el dibujo cabe en el rollo', () => {
  it.each(PRESETS_TAMANO_ETIQUETA.map((p) => [p.nombre, p] as const))('%s', (_n, p) => {
    for (const margenMm of [0, 3]) {
      const tamanoMm = { anchoMm: p.anchoMm, altoMm: p.altoMm, margenMm };
      const bebida = generarEtiquetaBebida({ ...muestraEtiquetaBebida, tamanoMm });
      const general = generarEtiquetaGeneral({ ...muestraEtiquetaGeneral, tamanoMm });
      for (const t of [bebida, general]) {
        expect(t).toContain(`SIZE ${p.anchoMm} mm,${p.altoMm} mm`);
        const W = Math.round(p.anchoMm * 8);
        const H = Math.round(p.altoMm * 8);
        // Ningún TEXT/BOX/BAR empieza fuera del rollo
        for (const m of t.matchAll(/^(?:TEXT|BAR|BOX|REVERSE) (\d+),(\d+)/gm)) {
          expect(Number(m[1])).toBeLessThan(W);
          expect(Number(m[2])).toBeLessThan(H);
        }
      }
    }
  });
});
