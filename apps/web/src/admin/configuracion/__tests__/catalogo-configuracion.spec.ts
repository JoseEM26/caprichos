import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { CATALOGO, idsInvalidos } from '../catalogo';
import { CATEGORIAS_CONFIG } from '../ConfiguracionLocalView';

describe('Catálogo de configuración', () => {
  it('los ids son únicos y están en kebab-case', () => {
    expect(idsInvalidos()).toEqual([]);
  });

  it('cada entrada apunta a una pestaña real y trae título, descripción y palabras', () => {
    const tabs = new Set(CATEGORIAS_CONFIG.map((c) => c.id));
    for (const e of CATALOGO) {
      expect(tabs.has(e.tab), `${e.id}: pestaña ${e.tab}`).toBe(true);
      expect(e.titulo.length).toBeGreaterThan(3);
      expect(e.descripcion.length).toBeGreaterThan(20);
      expect(e.palabras.length).toBeGreaterThan(0);
    }
  });

  it('cada pestaña tiene al menos una entrada', () => {
    const conEntrada = new Set(CATALOGO.map((e) => e.tab));
    // estas pestañas solo tienen campos genéricos aún sin sembrar (TODO de los agentes)
    for (const c of CATEGORIAS_CONFIG) expect(conEntrada.has(c.id), c.id).toBe(true);
  });

  it('todo data-cfg-id / CampoConfig literal del código existe en el catálogo', () => {
    const dir = resolve(__dirname, '..');
    const ids = new Set(CATALOGO.map((e) => e.id));
    const re = /(?:data-cfg-id=|<CampoConfig\s+id=|cfgId=)"([a-z0-9-]+)"/g;
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.tsx'))) {
      const txt = readFileSync(resolve(dir, f), 'utf8');
      for (const m of txt.matchAll(re)) expect(ids.has(m[1]), `${f}: ${m[1]}`).toBe(true);
    }
  });
});
