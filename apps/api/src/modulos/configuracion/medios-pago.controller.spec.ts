jest.mock('../acceso/acceso.guard', () => ({ AccesoGuard: class {} }));
import { MediosPagoController } from './medios-pago.controller';

const prisma = (valores: Record<string, unknown>) => ({
  parametro: { findUnique: jest.fn(async ({ where }: any) => (where.clave in valores ? { valor: valores[where.clave] } : null)) },
}) as any;

describe('MediosPagoController: presentación', () => {
  it('sin parámetro: orden de fábrica y Culqi al final sin insignia', async () => {
    const c = new MediosPagoController(prisma({}));
    const r = await c.delCanal('carta');
    expect(r.medios).toEqual(['YAPE', 'PLIN', 'EFECTIVO', 'TARJETA', 'TRANSFERENCIA']);
    expect(r.presentacion.CULQI.insignia).toBeNull();
    expect((await c.todo()).presentacion.CULQI.orden).toBe(6);
  });

  it('con parámetro: los medios del canal salen en el orden configurado', async () => {
    const pres = { EFECTIVO: { orden: 0, tamano: 'normal', insignia: null }, YAPE: { orden: 2, tamano: 'grande', insignia: 'Nuevo' } };
    const r = await new MediosPagoController(prisma({ medios_pago_presentacion: pres })).delCanal('CAJA');
    expect(r.medios[0]).toBe('EFECTIVO');
    expect(r.presentacion.YAPE).toEqual({ orden: 2, tamano: 'grande', insignia: 'Nuevo' });
  });
});
