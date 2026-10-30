import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { CATALOGO } from '../catalogo';

const dir = resolve(__dirname, '..');
const FUENTES: Record<string, string[]> = {
  vouchers: [resolve(dir, 'TarjetaVouchersIaConfiguracion.tsx')],
  ayuda: [resolve(dir, 'TarjetaAyudaIaConfiguracion.tsx')],
  ingreso: [resolve(dir, 'TarjetaPantallaIngresoConfiguracion.tsx')],
  impresion: [resolve(dir, '../impresion/TarjetaImpresionEtiquetas.tsx')],
};
const re = /(?:data-cfg-id=|<CampoConfig\s+id=|cfgId=)"([a-z0-9-]+)"/g;

describe('Catálogo de tarjetas Vouchers, Ayuda, Ingreso e Impresión', () => {
  for (const [tab, archivos] of Object.entries(FUENTES)) {
    it(`cada ajuste de ${tab} tiene destino en su tarjeta y cada destino está en el catálogo`, () => {
      const enCodigo = new Set<string>();
      for (const f of archivos) for (const m of readFileSync(f, 'utf8').matchAll(re)) enCodigo.add(m[1]);
      const enCatalogo = CATALOGO.filter((e) => e.tab === tab).map((e) => e.id);
      for (const id of enCatalogo) expect(enCodigo.has(id), `falta destino: ${id}`).toBe(true);
      for (const id of enCodigo) expect(enCatalogo.includes(id), `sin catálogo: ${id}`).toBe(true);
    });
  }
});
