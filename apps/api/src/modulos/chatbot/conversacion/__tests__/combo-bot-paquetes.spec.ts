import { comboVendibleBot } from '../flujos/pedido/combo-bot';

const combo = (partes: object[]) => ({ tipo: 'COMBO', activo: true, alcanceProductoId: '9', canales: ['BOT'], combosParte: partes });

describe('comboVendibleBot con complemento de paquetes', () => {
  it('un combo normal sigue vendiéndose por el bot', () => {
    expect(comboVendibleBot([combo([{ id: '1', tipo: 'FIJO' }])], '9')).not.toBeNull();
  });

  it('un combo con paquetes (complemento a elegir) se pide por la carta: el bot no lo vende', () => {
    expect(comboVendibleBot([combo([{ id: '1', tipo: 'FIJO', paqueteGrupo: 'Complemento', paqueteNombre: '1 carrot cake' }])], '9')).toBeNull();
  });
});
