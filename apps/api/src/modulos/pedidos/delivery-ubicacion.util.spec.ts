import { deliveryUbicado, exigirDeliveryUbicado } from './delivery-ubicacion.util';

describe('delivery-ubicacion', () => {
  const ok = { modalidad: 'DELIVERY', entrega_lat: -12, entrega_lng: -77 };
  it('delivery con punto está ubicado', () => expect(deliveryUbicado(ok)).toBe(true));
  it.each([
    { ...ok, entrega_lat: null },
    { ...ok, entrega_lng: null },
  ])('delivery sin punto no lo está (caso %#)', (p) => {
    expect(deliveryUbicado(p)).toBe(false);
    expect(() => exigirDeliveryUbicado(p)).toThrow(expect.objectContaining({
      response: { codigo: 'UBICACION_REQUERIDA', mensaje: 'Falta la ubicación del cliente: confírmala por WhatsApp antes de mandarlo con el motorizado' },
      status: 409,
    }));
  });
  it('mesa y recoger no aplican', () => {
    expect(deliveryUbicado({ modalidad: 'MESA' })).toBe(true);
    expect(deliveryUbicado({ modalidad: 'RECOGER', entrega_lat: null })).toBe(true);
  });
});
