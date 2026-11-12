import { readFileSync } from 'fs';
import { join } from 'path';

const leer = (n: string) => readFileSync(join(__dirname, '..', 'manuales', `${n}.md`), 'utf8');

describe('Manuales de Capri: cierre sin pedidos abiertos', () => {
  it('cierre explica PEDIDOS_SIN_TERMINAR, el panel y la excepcion del Administrador', () => {
    const t = leer('cierre');
    expect(t).toContain('PEDIDOS_SIN_TERMINAR');
    expect(t).toContain('Pedidos sin terminar');
    expect(t).toContain('CIERRE_PEDIDOS_SIN_TERMINAR');
    expect(t).toContain('Justificar sin terminar y permitir el cierre');
  });

  it('caja avisa que el cierre exige todo Entregado o Anulado', () => {
    const t = leer('caja');
    expect(t).toContain('PEDIDOS_SIN_TERMINAR');
    expect(t).toContain('Entregados o Anulados');
  });
});
