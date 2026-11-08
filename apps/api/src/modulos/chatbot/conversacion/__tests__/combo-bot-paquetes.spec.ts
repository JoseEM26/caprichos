import { comboVendibleBot, eleccionesParaServidor, iniciarCombo } from '../flujos/pedido/combo-bot';

const combo = (partes: object[]) => ({ tipo: 'COMBO', activo: true, alcanceProductoId: '9', canales: ['BOT'], combosParte: partes });

describe('comboVendibleBot con complemento de paquetes', () => {
  it('un combo normal sigue vendiéndose por el bot', () => {
    expect(comboVendibleBot([combo([{ id: '1', tipo: 'FIJO' }])], '9')).not.toBeNull();
  });

  it('un combo con paquetes (complemento a elegir) se pide por la carta: el bot no lo vende', () => {
    expect(comboVendibleBot([combo([{ id: '1', tipo: 'FIJO', paqueteGrupo: 'Complemento', paqueteNombre: '1 carrot cake' }])], '9')).toBeNull();
  });
});

describe('combo del bot con parte opcional (papas): valor por defecto, sin pregunta', () => {
  const oferta = (extra: object) => ({
    id: '4', nombre: 'Dúo', combosParte: [{ id: '2', tipo: 'FIJO', productos: ['51'], principalNombre: 'Papas nativas', opcional: true, cantidad: 1, ...extra }],
  });
  it('marcada por defecto: viaja como incluida (el servidor aplica el valor por defecto)', () => {
    const c = iniciarCombo(oferta({ incluidaPorDefecto: true }));
    expect(eleccionesParaServidor(c)).toEqual([{ parteId: '2', productoId: '51' }]);
  });
  it('no marcada por defecto: no se ofrece ni se envía (sale sin ella)', () => {
    const c = iniciarCombo(oferta({ incluidaPorDefecto: false }));
    expect(c.fijas).toEqual([]);
  });
});
