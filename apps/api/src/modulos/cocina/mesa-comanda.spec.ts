import { mesaDePedido } from './mesa-comanda.util';

describe('mesaDePedido', () => {
  it('una mesa: usa el nombre que guarda el pedido', () => {
    expect(mesaDePedido({ modalidad: 'MESA', mesa_nombre: 'Mesa 6' })).toBe('Mesa 6');
  });
  it('varias mesas unidas', () => {
    expect(mesaDePedido({ modalidad: 'MESA', mesa_nombre: 'Mesas 4 y 5' })).toBe('Mesas 4 y 5');
  });
  it('pedido extra de la misma cuenta: misma mesa', () => {
    expect(mesaDePedido({ modalidad: 'MESA', mesa_nombre: 'Mesa 6' })).toBe('Mesa 6');
  });
  it('pedido viejo de mesa sin nombre: cae en entrega_referencia', () => {
    expect(mesaDePedido({ modalidad: 'MESA', mesa_nombre: null, entrega_referencia: '3' })).toBe('3');
  });
  it('mesa sin dato: null (la web muestra «Mesa sin asignar»)', () => {
    expect(mesaDePedido({ modalidad: 'MESA', mesa_nombre: null })).toBeNull();
  });
  it('para llevar y delivery nunca llevan mesa', () => {
    expect(mesaDePedido({ modalidad: 'LLEVAR', mesa_nombre: 'Mesa 6' })).toBeNull();
    expect(mesaDePedido({ modalidad: 'DELIVERY', entrega_referencia: 'Frente al parque' })).toBeNull();
  });
});
