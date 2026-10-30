import { flujoLiberadoParaBot } from '../flujo-liberado.util';

describe('flujoLiberadoParaBot', () => {
  it('saca el flujo de ATENCION_PERSONA al menu y conserva el resto', () => {
    const r = flujoLiberadoParaBot({ estado: 'ATENCION_PERSONA', nombre_perfil_wa: 'Jose', repreguntasFallidas: 3 });
    expect(r).toEqual({ estado: 'MENU', nombre_perfil_wa: 'Jose', repreguntasFallidas: 0 });
  });
  it('no toca otros estados ni valores vacios', () => {
    expect(flujoLiberadoParaBot({ estado: 'PEDIDO_REFERENCIA', x: 1 })).toEqual({ estado: 'PEDIDO_REFERENCIA', x: 1 });
    expect(flujoLiberadoParaBot(null)).toEqual({});
  });
});
