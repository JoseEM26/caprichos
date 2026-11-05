import { readFileSync } from 'fs';
import { join } from 'path';

describe('migración 20261219100000_ofertas_inactivas_ocultas', () => {
  const sql = readFileSync(
    join(__dirname, '../../../prisma/migrations/20261219100000_ofertas_inactivas_ocultas/migration.sql'),
    'utf8',
  );

  it('solo marca como ocultas las ofertas desactivadas: no cambia activo ni toca las activas', () => {
    expect(sql).toMatch(/SET "visible_carta" = false WHERE "activo" = false AND "visible_carta" = true;/);
    expect(sql).not.toMatch(/"activo"\s*=\s*true/);
    expect(sql).not.toMatch(/SET\s+"activo"/);
  });
});
