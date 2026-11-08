import { ofertaAplicaA, ofertaIncluyeModalidad, modalidadOferta } from './ofertas.util';
import { promoEnvioGratisVigente } from './envio-gratis-promo';

const base = { activo: true, canales: ['CARTA', 'ADMIN', 'BOT'] };
const lunes = new Date('2026-11-09T17:00:00.000Z'); // lunes 12:00 Lima

describe('ofertaAplicaA: canal x modalidad x fecha', () => {
  it('modalidades vacías = todas (retrocompatible)', () => {
    for (const m of ['MESA', 'COMER_LOCAL', 'RECOGER', 'LLEVAR', 'DELIVERY', undefined]) {
      expect(ofertaAplicaA({ ...base, modalidades: [] }, { canal: 'CARTA', modalidad: m, fecha: lunes })).toBe(true);
    }
    expect(ofertaAplicaA(base, { canal: 'CARTA', modalidad: 'DELIVERY', fecha: lunes })).toBe(true);
  });

  it('solo comer en el local: MESA y COMER_LOCAL sí; delivery y llevar no', () => {
    const o = { ...base, modalidades: ['COMER_LOCAL'] };
    expect(ofertaAplicaA(o, { canal: 'ADMIN', modalidad: 'MESA', fecha: lunes })).toBe(true);
    expect(ofertaAplicaA(o, { canal: 'CARTA', modalidad: 'COMER_LOCAL', fecha: lunes })).toBe(true);
    expect(ofertaAplicaA(o, { canal: 'CARTA', modalidad: 'DELIVERY', fecha: lunes })).toBe(false);
    expect(ofertaAplicaA(o, { canal: 'CARTA', modalidad: 'RECOGER', fecha: lunes })).toBe(false);
  });

  it('llevar y recoger valen entre sí; sin modalidad conocida no se descarta', () => {
    expect(ofertaIncluyeModalidad(['LLEVAR'], 'RECOGER')).toBe(true);
    expect(ofertaIncluyeModalidad(['RECOGER'], 'LLEVAR')).toBe(true);
    expect(ofertaIncluyeModalidad(['LLEVAR'], 'DELIVERY')).toBe(false);
    expect(ofertaIncluyeModalidad(['DELIVERY'], undefined)).toBe(true);
    expect(modalidadOferta('RECOJO')).toBe('RECOGER');
  });

  it('combina con canal y fecha', () => {
    const o = { ...base, canales: ['CARTA'], modalidades: ['DELIVERY'], dias: [2] };
    expect(ofertaAplicaA(o, { canal: 'CARTA', modalidad: 'DELIVERY', fecha: lunes })).toBe(false); // día
    expect(ofertaAplicaA({ ...o, dias: [] }, { canal: 'ADMIN', modalidad: 'DELIVERY', fecha: lunes })).toBe(false); // canal
    expect(ofertaAplicaA({ ...o, dias: [] }, { canal: 'CARTA', modalidad: 'DELIVERY', fecha: lunes })).toBe(true);
  });
});

describe('envío gratis solo delivery', () => {
  const prisma = (mods: string[]): any => ({
    oferta: { findMany: async () => [{ id: 1n, nombre: 'Envío gratis', tipo: 'ENVIO_GRATIS', ...base, modalidades: mods, hora_hasta: null, compra_minima: null }] },
  });
  it('vale en delivery y no si la oferta excluye Delivery', async () => {
    expect(await promoEnvioGratisVigente(prisma(['DELIVERY']), 'CARTA')).not.toBeNull();
    expect(await promoEnvioGratisVigente(prisma([]), 'CARTA')).not.toBeNull();
    expect(await promoEnvioGratisVigente(prisma(['COMER_LOCAL']), 'CARTA')).toBeNull();
  });
});
