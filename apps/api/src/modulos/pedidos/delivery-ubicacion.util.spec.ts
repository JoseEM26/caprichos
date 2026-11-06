import { deliveryUbicado, exigirDeliveryUbicado } from './delivery-ubicacion.util';

describe('delivery-ubicacion', () => {
  const ok = { modalidad: 'DELIVERY', entrega_lat: -12, entrega_lng: -77, zona_id: 1n };
  it('delivery con punto y zona está ubicado', () => expect(deliveryUbicado(ok)).toBe(true));
  it.each([
    { ...ok, entrega_lat: null },
    { ...ok, entrega_lng: null },
    { ...ok, zona_id: null },
  ])('delivery sin punto o sin zona no lo está (caso %#)', (p) => {
    expect(deliveryUbicado(p)).toBe(false);
    expect(() => exigirDeliveryUbicado(p)).toThrow(expect.objectContaining({
      response: { codigo: 'DELIVERY_SIN_UBICACION', mensaje: 'Para delivery primero ubica la dirección en el mapa (calcula la zona y el envío).' },
    }));
  });
  it('mesa y recoger no aplican', () => {
    expect(deliveryUbicado({ modalidad: 'MESA' })).toBe(true);
    expect(deliveryUbicado({ modalidad: 'RECOGER', entrega_lat: null })).toBe(true);
  });
});
