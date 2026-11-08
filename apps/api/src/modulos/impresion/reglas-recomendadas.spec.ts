import { REGLAS_IMPRESION_DEFECTO } from '@caprichos/compartido';
import { aplicaSegunReglas } from './ruteo-impresion';

/** Qué sale de fábrica por tipo de pedido: lo que decidió el dueño (08/11/2026). */
describe('reglas iniciales de impresión (decisión del dueño)', () => {
  const sale = (modalidad: string) =>
    ['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA', 'TICKET_COMANDA_SALON', 'TICKET_COMANDA_AREA'].filter((t) =>
      aplicaSegunReglas(t, modalidad, REGLAS_IMPRESION_DEFECTO),
    );

  // Desde «cada PC manda» las reglas solo dicen CUÁNDO; qué sale lo decide cada PC (el sticker general nace apagado en las PC)
  it('en el local: comanda de salón y de área, ningún sticker', () => {
    expect(sale('MESA')).toEqual(['TICKET_COMANDA_SALON', 'TICKET_COMANDA_AREA']);
    expect(sale('LOCAL')).toEqual(['TICKET_COMANDA_SALON', 'TICKET_COMANDA_AREA']);
  });

  it('para llevar, recoger y delivery: stickers, sin comanda de salón', () => {
    for (const m of ['LLEVAR', 'RECOGER', 'DELIVERY']) {
      expect(sale(m)).toEqual(['ETIQUETA_GENERAL', 'ETIQUETA_AREA', 'ETIQUETA_BEBIDA', 'TICKET_COMANDA_AREA']);
    }
  });
});
