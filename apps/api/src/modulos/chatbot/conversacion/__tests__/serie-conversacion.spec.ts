jest.mock('../../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ejecutarEnSerie } from '../../utilidades/candado-serie.util';

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('Procesamiento en serie por conversación', () => {
  it('un trabajo que llega mientras otro corre espera y no se pierde (orden conservado)', async () => {
    const orden: string[] = [];
    const a = ejecutarEnSerie('k', null, async () => { orden.push('a1'); await esperar(40); orden.push('a2'); });
    const b = ejecutarEnSerie('k', null, async () => { orden.push('b1'); });
    const otra = ejecutarEnSerie('otra', null, async () => { orden.push('x'); });
    await Promise.all([a, b, otra]);
    expect(orden).toEqual(['a1', 'x', 'a2', 'b1']);
  });

  it('un fallo no bloquea al siguiente', async () => {
    await expect(ejecutarEnSerie('f', null, async () => { throw new Error('x'); })).rejects.toThrow();
    await expect(ejecutarEnSerie('f', null, async () => 7)).resolves.toBe(7);
  });

});
