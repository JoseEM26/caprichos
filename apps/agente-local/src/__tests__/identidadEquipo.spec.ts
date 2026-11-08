import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { describe, expect, it, vi } from 'vitest';
import { obtenerEquipoUid } from '../identidadEquipo';
import { canjearCodigoVinculo } from '../api/clienteApi';

const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'uid-')), 'config.json');

describe('identidad estable de la PC', () => {
  it('con id de máquina envía solo un hash estable (no el valor crudo)', () => {
    const ruta = tmp();
    const a = obtenerEquipoUid(ruta, () => 'ABC-123-GUID');
    expect(a).toBe(obtenerEquipoUid(ruta, () => 'abc-123-guid'));
    expect(a).not.toContain('ABC');
    expect(fs.existsSync(ruta)).toBe(false);
  });

  it('sin id de máquina genera un UUID una vez y lo conserva entre reinicios, junto a la llave', () => {
    const ruta = tmp();
    fs.writeFileSync(ruta, JSON.stringify({ agenteKey: 'agk_1' }));
    const a = obtenerEquipoUid(ruta, () => undefined);
    expect(a).toMatch(/^u-[0-9a-f-]{36}$/);
    expect(obtenerEquipoUid(ruta, () => undefined)).toBe(a);
    expect(JSON.parse(fs.readFileSync(ruta, 'utf-8')).agenteKey).toBe('agk_1');
  });

  it('el canje del código envía el equipo (uid) y sin él sigue igual que antes', async () => {
    const f: any = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ llave: 'agk_x' }) });
    await canjearCodigoVinculo('http://x', 'ABCD', f, { hostname: 'CAJA', equipoUid: 'm-1' });
    expect(JSON.parse(f.mock.calls[0][1].body)).toEqual({ codigo: 'ABCD', equipo: { hostname: 'CAJA', equipoUid: 'm-1' } });
  });
});
