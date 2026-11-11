import { readFileSync } from 'fs';
import { join } from 'path';

describe('Manual de Capri: descuento del equipo en la carta', () => {
  it('creditos explica que es solo descuento, sin credito, y cuando no aplica', () => {
    const t = readFileSync(join(__dirname, '..', 'manuales', 'creditos.md'), 'utf8');
    expect(t).toContain('Descuento del equipo en la carta virtual');
    expect(t).toContain('NO se carga a su credito');
    expect(t).toContain('usuario esta inactivo');
    expect(t).toContain('Sin sesion iniciada no se aplica ni se muestra nada');
    expect(t).toContain('no suma puntos');
  });
});
