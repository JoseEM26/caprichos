import { describe, it, expect, vi } from 'vitest';
import {
  comandoEstado,
  comandoImpresoras,
  comandoProbarTodas,
  comandoProbarUna,
  comandoUsar,
  ejecutarMenu,
  resolverImpresora,
} from '../comandos';
import type { DepsComandos } from '../comandos';
import type { CandidataLocal } from '../candidatas';
import { ImpresoraMemoria } from '../impresora/impresoraMemoria';
import { resolverFormato } from '../tspl/formato';

const lista: CandidataLocal[] = [
  { id: 'TSC TTP-247', nombre: 'TSC TTP-247', destino: 'TSC TTP-247', sugerido: 'ETIQUETERA' },
  { id: 'XP-80C', nombre: 'XP-80C', destino: 'XP-80C', sugerido: 'TICKETERA' },
  { id: 'Rara', nombre: 'Rara', destino: 'Rara' },
];

function deps(extra: Partial<DepsComandos> = {}) {
  const log: string[] = [];
  const memorias: Record<string, ImpresoraMemoria> = {};
  const guardadas: Array<[string, string]> = [];
  const d: DepsComandos = {
    listar: async () => lista,
    crear: (c) => (memorias[c.id] ??= new ImpresoraMemoria()),
    guardar: (rol, c) => void guardadas.push([rol, c.id]),
    archivo: {},
    config: { etiqueta: resolverFormato({}), ticketColumnas: 48 },
    log: (m) => void log.push(m),
    ...extra,
  };
  return { d, log, memorias, guardadas };
}

describe('resolverImpresora', () => {
  it('por número (desde 1), por nombre exacto y por parte del nombre', () => {
    expect(resolverImpresora(lista, '2')).toBe(lista[1]);
    expect(resolverImpresora(lista, 'xp-80c')).toBe(lista[1]);
    expect(resolverImpresora(lista, 'ttp')).toBe(lista[0]);
  });
  it('explica el error si no existe o es ambigua', () => {
    expect(resolverImpresora(lista, '9')).toMatchObject({ error: expect.stringContaining('No hay impresora número 9') });
    expect(resolverImpresora(lista, 'zzz')).toMatchObject({ error: expect.stringContaining('No hay ninguna impresora') });
    expect(resolverImpresora([...lista, { ...lista[1], id: 'XP-80C (2)', nombre: 'XP-80C 2' }], 'xp')).toMatchObject({ error: expect.stringContaining('coincide con 2') });
    expect(resolverImpresora(lista, ' ')).toMatchObject({ error: expect.stringContaining('Falta') });
  });
});

describe('comandos de terminal', () => {
  it('impresoras: lista numerada con la sugerencia y marca la que ya es etiquetera', async () => {
    const { d, log } = deps({ archivo: { etiquetera: 'TSC TTP-247' } });
    await comandoImpresoras(d);
    expect(log.join('\n')).toContain('1) TSC TTP-247  [parece etiquetera, ES LA ETIQUETERA]');
    expect(log.join('\n')).toContain('2) XP-80C  [parece ticketera]');
  });

  it('impresoras: sin ninguna, lo dice y menciona que las virtuales no se muestran', async () => {
    const { d, log } = deps({ listar: async () => [] });
    await comandoImpresoras(d);
    expect(log[0]).toContain('virtuales');
  });

  it('probar-todas imprime en CADA una con su número; la de rol desconocido recibe etiqueta y ticket', async () => {
    const { d, memorias } = deps();
    const r = await comandoProbarTodas(d);
    expect(r).toEqual({ total: 3, fallidas: 0 });
    expect(memorias['TSC TTP-247'].obtenerTrabajosEscritos()).toHaveLength(1);
    expect(memorias['TSC TTP-247'].obtenerTrabajosEscritos()[0].toString('latin1')).toContain('N° 1 de 3');
    expect(memorias['XP-80C'].obtenerTrabajosEscritos()[0].toString('latin1')).toContain('Impresora 2 de 3');
    expect(memorias.Rara.obtenerTrabajosEscritos()).toHaveLength(2);
  });

  it('probar-todas sigue con las demás si una falla y cuenta la fallida', async () => {
    const { d, memorias, log } = deps();
    memorias.Rara = new ImpresoraMemoria();
    memorias.Rara.simularErrorAlEscribir(new Error('apagada'));
    const r = await comandoProbarTodas(d);
    expect(r.fallidas).toBe(1);
    expect(log.join('\n')).toContain('3) Rara: apagada');
  });

  it('probar <n> imprime solo en esa; con número inválido avisa', async () => {
    const { d, memorias, log } = deps();
    expect(await comandoProbarUna(d, '2')).toBe(true);
    expect(Object.keys(memorias)).toEqual(['XP-80C']);
    expect(await comandoProbarUna(d, '8')).toBe(false);
    expect(log.at(-1)).toContain('No hay impresora número 8');
  });

  it('usar etiquetera/ticketera guarda la elegida; rol inválido o impresora inexistente no guardan', async () => {
    const { d, guardadas } = deps();
    expect(await comandoUsar(d, 'etiquetera', '1')).toBe(true);
    expect(await comandoUsar(d, 'ticketera', 'xp-80c')).toBe(true);
    expect(await comandoUsar(d, 'impresora', '1')).toBe(false);
    expect(await comandoUsar(d, 'ticketera', '99')).toBe(false);
    expect(guardadas).toEqual([['ETIQUETERA', 'TSC TTP-247'], ['TICKETERA', 'XP-80C']]);
  });

  it('estado distingue: sin elegir, conectada y guardada-no-encontrada, y el arranque automático', async () => {
    const { d, log } = deps({
      archivo: { agenteKey: 'k', apiUrl: 'https://x', ticketera: 'Perdida' },
      autoarranque: async () => true,
    });
    await comandoEstado(d, '/cfg.json');
    const t = log.join('\n');
    expect(t).toContain('Vinculado a Caprichos: SÍ');
    expect(t).toContain('etiquetera: NO ELEGIDA');
    expect(t).toContain('ticketera: Impresora guardada no encontrada: Perdida');
    expect(t).toContain('ACTIVADO');
    expect(t).toContain('/cfg.json');
  });

  it('el menú numerado permite probar todas, elegir y salir sin recordar comandos', async () => {
    const { d, guardadas, memorias } = deps();
    const resp = ['2', '4', '1', '0'];
    await ejecutarMenu(async () => resp.shift() ?? '0', d, '/cfg');
    expect(Object.keys(memorias)).toHaveLength(3);
    expect(guardadas).toEqual([['ETIQUETERA', 'TSC TTP-247']]);
  });

  it('el menú ofrece la opción de arranque solo si el sistema la soporta', async () => {
    const { d, log } = deps();
    const alternar = vi.fn().mockResolvedValue('hecho');
    const resp = ['7', '0'];
    await ejecutarMenu(async () => resp.shift() ?? '0', d, '/cfg', { alternarAutoarranque: alternar });
    expect(alternar).toHaveBeenCalled();
    expect(log.join('\n')).toContain('7) Activar');
  });
});
