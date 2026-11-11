import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

/**
 * Guardián: cada estado que el código asigna a comprobante/sunat_resumen debe figurar en el CHECK vigente
 * (la última migración que lo define). Con Prisma simulado nadie lo notaba: en Postgres el UPDATE fallaba con 23514.
 */
const MIGRACIONES = join(__dirname, '../../../prisma/migrations');
const SRC = join(__dirname, '../..');

function checkVigente(nombre: string): string[] {
  let valores: string[] = [];
  for (const dir of readdirSync(MIGRACIONES).sort()) {
    let sql: string;
    try {
      sql = readFileSync(join(MIGRACIONES, dir, 'migration.sql'), 'utf8');
    } catch {
      continue;
    }
    // "ADD CONSTRAINT "nombre" ... CHECK (... IN ('A','B'))" hasta el ';'
    const re = new RegExp(`CONSTRAINT "${nombre}"[^;]*?CHECK[^;]*?IN \\(([^)]*)\\)`, 'g');
    for (const m of sql.matchAll(re)) valores = [...m[1].matchAll(/'([A-Z_]+)'/g)].map((x) => x[1]);
  }
  return valores;
}

function archivosTs(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory() ? archivosTs(join(dir, d.name)) : d.name.endsWith('.ts') && !/\.(spec|fake-db)\.ts$/.test(d.name) ? [join(dir, d.name)] : [],
  );
}

function asignados(campo: string): Set<string> {
  const re = new RegExp(`\\b${campo}\\s*:\\s*'([A-Z_]+)'`, 'g');
  const set = new Set<string>();
  for (const f of archivosTs(SRC)) {
    const txt = readFileSync(f, 'utf8');
    // Solo escrituras: se ignoran líneas de filtro (where / in / not) por su forma habitual
    for (const linea of txt.split('\n')) {
      if (/where|findMany|findFirst|count\(|\bnot:|\bin:/.test(linea)) continue;
      for (const m of linea.matchAll(re)) set.add(m[1]);
    }
  }
  return set;
}

describe('CHECK de estados de comprobante frente al código', () => {
  it('facturacion_estado: REVISION_MANUAL y los demás estados asignados están permitidos', () => {
    const permitidos = checkVigente('ck_comprobante_facturacion_estado');
    expect(permitidos).toContain('REVISION_MANUAL');
    for (const v of asignados('facturacion_estado')) expect(permitidos).toContain(v);
  });

  it('baja_estado: PENDIENTE_BAJA y los demás estados asignados están permitidos', () => {
    const permitidos = checkVigente('ck_comprobante_baja_estado');
    expect(permitidos).toContain('PENDIENTE_BAJA');
    for (const v of asignados('baja_estado')) expect(permitidos).toContain(v);
    const svc = readFileSync(join(SRC, 'modulos/comprobantes/comprobantes.service.ts'), 'utf8');
    for (const m of svc.matchAll(/bajaEstado = '([A-Z_]+)'/g)) expect(permitidos).toContain(m[1]);
  });

  it('sunat_resumen.estado: los estados asignados están permitidos', () => {
    const permitidos = checkVigente('ck_sunat_resumen_estado');
    const svc = readFileSync(join(SRC, 'modulos/comprobantes/comprobantes-sunat.service.ts'), 'utf8');
    const usados = [...svc.matchAll(/data: \{ estado: '([A-Z_]+)'|^\s+estado: '([A-Z_]+)',$/gm)].map((m) => m[1] ?? m[2]);
    expect(usados.length).toBeGreaterThan(0);
    for (const v of usados) expect(permitidos).toContain(v);
  });
});
