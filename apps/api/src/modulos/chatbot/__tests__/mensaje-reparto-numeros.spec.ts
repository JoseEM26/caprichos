jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import * as fs from 'fs';
import * as path from 'path';
import { ETAPAS_AVISO } from '../servicios/avisos-pedido.service';

/**
 * Cada etapa de ETAPAS_AVISO se guarda como numero en mensaje_reparto. El CHECK de la última migración
 * que lo define debe admitir todas (lección: una etapa nueva sin ampliar el CHECK falla en silencio en el outbox).
 */
describe('CHECK de mensaje_reparto.numero', () => {
  it('admite todas las etapas de ETAPAS_AVISO', () => {
    const dir = path.join(__dirname, '../../../../prisma/migrations');
    const sqls = fs
      .readdirSync(dir)
      .filter((d) => fs.existsSync(path.join(dir, d, 'migration.sql')))
      .sort()
      .map((d) => fs.readFileSync(path.join(dir, d, 'migration.sql'), 'utf8'))
      .filter((sql) => sql.includes('ck_mensaje_reparto_numero') && sql.includes('ADD CONSTRAINT'));
    const ultimo = sqls[sqls.length - 1];
    const rango = /"numero" BETWEEN 1 AND (\d+)/.exec(ultimo ?? '');
    expect(rango).not.toBeNull();
    const maximo = Math.max(...Object.values(ETAPAS_AVISO).map((e) => e.numero));
    expect(Number(rango![1])).toBeGreaterThanOrEqual(maximo);
  });
});
