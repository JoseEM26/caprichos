import { readFileSync } from 'fs';
import { join } from 'path';

describe('migración 20261223100000_quitar_producto_media_docena', () => {
  const sql = readFileSync(
    join(__dirname, '../../../prisma/migrations/20261223100000_quitar_producto_media_docena/migration.sql'),
    'utf8',
  );

  it('busca el producto por nombre exacto sin distinguir mayúsculas, no por id fijo', () => {
    expect(sql).toMatch(/lower\(nombre\) = lower\('1\/2 DOCENA DONUTS O GALLETAS'\)/);
    expect(sql).not.toMatch(/WHERE id = \d+/);
    expect(sql).not.toMatch(/producto_id = \d+/);
    expect(sql).not.toMatch(/alcance_producto_id = \d+/);
  });

  it('va en un único bloque DO y sale si el producto no existe', () => {
    expect(sql).toMatch(/^DO \$\$/m);
    expect(sql).toMatch(/END \$\$;/);
    expect(sql).toMatch(/IF v_ids IS NULL THEN[\s\S]*RETURN;/);
  });

  it('tiene los dos caminos: con historial se oculta, sin historial se borra', () => {
    expect(sql).toMatch(/IF v_historial THEN[\s\S]*SET oculto = true[\s\S]*ELSE[\s\S]*DELETE FROM producto WHERE id = ANY\(v_ids\)/);
    expect(sql).toMatch(/EXISTS \(SELECT 1 FROM pedido_linea WHERE producto_id = ANY\(v_ids\)\)/);
  });

  it('desactiva las ofertas que quedan sin partes válidas en vez de dejarlas rotas', () => {
    expect(sql).toMatch(/SET activo = false, visible_carta = false\s+WHERE activo AND id = ANY/);
  });
});
