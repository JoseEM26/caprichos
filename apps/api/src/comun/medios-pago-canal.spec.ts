import { exigirMediosActivos, leerMediosPagoCanal } from './medios-pago-canal';
import { medioActivo, mediosPagoActivosCanal, mediosPagoPorDefecto } from '@caprichos/compartido';

const dbCon = (valor: unknown) => ({ parametro: { findUnique: jest.fn().mockResolvedValue(valor === undefined ? null : { valor }) } });
const config = (cambios: Record<string, Record<string, boolean>>) => ({ ...mediosPagoPorDefecto(), ...Object.fromEntries(Object.entries(cambios).map(([c, f]) => [c, { ...mediosPagoPorDefecto()[c as 'CAJA'], ...f }])) });

describe('medios de pago por canal', () => {
  it('por defecto todo lo que existía queda encendido y PAGO_EN_LINEA apagado, en los 4 canales', () => {
    for (const canal of ['CARTA', 'CAJA', 'MOZO', 'BOT', 'WHATSAPP']) {
      expect(mediosPagoActivosCanal(undefined, canal)).toEqual(['EFECTIVO', 'YAPE', 'PLIN', 'TARJETA', 'TRANSFERENCIA']);
      expect(medioActivo(undefined, 'PAGO_EN_LINEA', canal)).toBe(false);
    }
    expect(medioActivo(undefined, 'BITCOIN', 'CARTA')).toBe(false);
  });

  it('el servidor rechaza un medio apagado en cada canal con mensaje simple, y deja pasar los demás', async () => {
    for (const canal of ['CARTA', 'CAJA', 'MOZO', 'BOT', 'WHATSAPP']) {
      const db = dbCon(config({ [canal === 'WHATSAPP' ? 'BOT' : canal]: { PLIN: false } }));
      await expect(exigirMediosActivos(db, ['plin'], canal)).rejects.toMatchObject({
        response: { codigo: 'MEDIO_NO_DISPONIBLE', mensaje: 'Plin no está disponible ahora' },
      });
      await expect(exigirMediosActivos(db, ['YAPE'], canal)).resolves.toBeUndefined();
    }
  });

  it('un medio apagado en un canal sigue permitido en los otros', async () => {
    const db = dbCon(config({ CARTA: { PLIN: false } }));
    await expect(exigirMediosActivos(db, ['PLIN'], 'CARTA')).rejects.toBeDefined();
    await expect(exigirMediosActivos(db, ['PLIN'], 'CAJA')).resolves.toBeUndefined();
  });

  it('pago dividido: basta un medio apagado en el plan para rechazarlo', async () => {
    const db = dbCon(config({ MOZO: { TRANSFERENCIA: false } }));
    await expect(exigirMediosActivos(db, ['EFECTIVO', 'TRANSFERENCIA'], 'MOZO')).rejects.toMatchObject({ response: { codigo: 'MEDIO_NO_DISPONIBLE' } });
    await expect(exigirMediosActivos(db, ['EFECTIVO', 'YAPE'], 'MOZO')).resolves.toBeUndefined();
  });

  it('PAGO_EN_LINEA está apagado por defecto en todos los canales (la pasarela llega en otra rama)', async () => {
    await expect(exigirMediosActivos(dbCon(undefined), ['PAGO_EN_LINEA'], 'CARTA')).rejects.toMatchObject({ response: { mensaje: 'Pago en línea no está disponible ahora' } });
  });

  it('canal sin interruptor (repartidor) no filtra; sin parámetro o con mocks sin parametro usa los valores de fábrica', async () => {
    await expect(exigirMediosActivos(dbCon(config({ CAJA: { YAPE: false } })), ['YAPE'], 'REPARTIDOR')).resolves.toBeUndefined();
    expect((await leerMediosPagoCanal({})).CAJA.EFECTIVO).toBe(true);
  });
});
