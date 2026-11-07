import { REGLAS_IMPRESION_DEFECTO } from '@caprichos/compartido';
import { aplicaSegunReglas } from './ruteo-impresion';

/** Qué sale de fábrica por tipo de pedido: lo que decidió el dueño (08/11/2026). */
describe('reglas iniciales de impresión (decisión del dueño)', () => {
  const sale = (modalidad: string) =>
    ['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA', 'TICKET_COMANDA_SALON', 'TICKET_COMANDA_AREA'].filter((t) =>
      aplicaSegunReglas(t, modalidad, REGLAS_IMPRESION_DEFECTO),
    );

  it('en el local: solo la comanda de salón, ningún sticker', () => {
    expect(sale('MESA')).toEqual(['TICKET_COMANDA_SALON']);
    expect(sale('LOCAL')).toEqual(['TICKET_COMANDA_SALON']);
  });

  it('para llevar, recoger y delivery: sticker por área y de bebida, sin comanda ni sticker general', () => {
    for (const m of ['LLEVAR', 'RECOGER', 'DELIVERY']) {
      expect(sale(m)).toEqual(['ETIQUETA_AREA', 'ETIQUETA_BEBIDA']);
    }
  });
});
