import {
  aplicaPromoEnvio,
  calcularEnvioDelivery,
  canalOfertaParaEnvio,
  promoEnvioGratisVigente,
} from './envio-gratis-promo';

// Miércoles 4 de noviembre de 2026. Lima es UTC-5 sin horario de verano.
const MIERCOLES_14H = new Date('2026-11-04T19:00:00.000Z'); // 14:00 Lima
const MIERCOLES_13H59 = new Date('2026-11-04T18:59:00.000Z');
const MIERCOLES_17H59 = new Date('2026-11-04T22:59:00.000Z');
const MIERCOLES_18H = new Date('2026-11-04T23:00:00.000Z'); // 18:00 Lima: ya no aplica (hora_hasta exclusiva)

function oferta(extra: Record<string, unknown> = {}) {
  return {
    id: 77n,
    nombre: 'Delivery gratis de 2 a 6 pm',
    tipo: 'ENVIO_GRATIS',
    activo: true,
    orden: 0,
    dias: [] as number[],
    hora_desde: new Date('1970-01-01T14:00:00.000Z'),
    hora_hasta: new Date('1970-01-01T18:00:00.000Z'),
    fecha_desde: null,
    fecha_hasta: null,
    canales: ['CARTA', 'ADMIN'],
    limite_usos: null,
    usos_actuales: 0,
    compra_minima: null,
    ...extra,
  };
}

function prismaCon(ofertas: unknown[], valorMonto: unknown = 70) {
  return {
    oferta: { findMany: jest.fn().mockResolvedValue(ofertas) },
    parametro: {
      findUnique: jest.fn(({ where }: any) =>
        Promise.resolve(where.clave === 'envio_gratis_monto' ? { valor: valorMonto } : null),
      ),
    },
  } as any;
}

describe('promo ENVIO_GRATIS: vigencia por horario, días, fechas, canal y límite', () => {
  it('dentro del horario (14:00 incluida) devuelve la promo con su hora de fin', async () => {
    const promo = await promoEnvioGratisVigente(prismaCon([oferta()]), 'CARTA', MIERCOLES_14H);
    expect(promo).toEqual({ id: '77', nombre: 'Delivery gratis de 2 a 6 pm', hasta: '18:00', compraMinima: null });
  });

  it('antes de las 14:00 no aplica', async () => {
    expect(await promoEnvioGratisVigente(prismaCon([oferta()]), 'CARTA', MIERCOLES_13H59)).toBeNull();
  });

  it('17:59 aún aplica y 18:00 ya no (hora_hasta es exclusiva, como en el resto de ofertas)', async () => {
    const prisma = prismaCon([oferta()]);
    expect(await promoEnvioGratisVigente(prisma, 'CARTA', MIERCOLES_17H59)).not.toBeNull();
    expect(await promoEnvioGratisVigente(prisma, 'CARTA', MIERCOLES_18H)).toBeNull();
  });

  it('un día de la semana no permitido no aplica (solo lunes, hoy es miércoles)', async () => {
    expect(await promoEnvioGratisVigente(prismaCon([oferta({ dias: [1] })]), 'CARTA', MIERCOLES_14H)).toBeNull();
  });

  it('fuera del rango de fechas no aplica', async () => {
    const ayer = { fecha_hasta: new Date('2026-11-03T00:00:00.000Z') };
    expect(await promoEnvioGratisVigente(prismaCon([oferta(ayer)]), 'CARTA', MIERCOLES_14H)).toBeNull();
  });

  it('con el límite de usos agotado no aplica', async () => {
    expect(
      await promoEnvioGratisVigente(prismaCon([oferta({ limite_usos: 5, usos_actuales: 5 })]), 'CARTA', MIERCOLES_14H),
    ).toBeNull();
  });

  it('inactiva no aplica', async () => {
    expect(await promoEnvioGratisVigente(prismaCon([oferta({ activo: false })]), 'CARTA', MIERCOLES_14H)).toBeNull();
  });

  it('en el bot (y WhatsApp) solo aplica si la promo tiene BOT marcado; TODOS no alcanza', async () => {
    expect(await promoEnvioGratisVigente(prismaCon([oferta({ canales: ['CARTA', 'ADMIN'] })]), 'BOT', MIERCOLES_14H)).toBeNull();
    expect(await promoEnvioGratisVigente(prismaCon([oferta({ canales: ['TODOS'] })]), 'BOT', MIERCOLES_14H)).toBeNull();
    expect(await promoEnvioGratisVigente(prismaCon([oferta({ canales: ['CARTA', 'BOT'] })]), 'BOT', MIERCOLES_14H)).not.toBeNull();
    expect(await promoEnvioGratisVigente(prismaCon([oferta({ canales: ['CARTA', 'BOT'] })]), 'WHATSAPP', MIERCOLES_14H)).not.toBeNull();
  });

  it('la carta web usa el canal CARTA y los pedidos de local usan ADMIN', async () => {
    expect(canalOfertaParaEnvio('CARTA')).toBe('CARTA');
    expect(canalOfertaParaEnvio('MOZO')).toBe('ADMIN');
    expect(canalOfertaParaEnvio('CAJA')).toBe('ADMIN');
    expect(canalOfertaParaEnvio('BOT')).toBe('BOT');
    expect(canalOfertaParaEnvio('WHATSAPP')).toBe('BOT');
    expect(await promoEnvioGratisVigente(prismaCon([oferta({ canales: ['ADMIN'] })]), 'CARTA', MIERCOLES_14H)).toBeNull();
    expect(await promoEnvioGratisVigente(prismaCon([oferta({ canales: ['ADMIN'] })]), 'MOZO', MIERCOLES_14H)).not.toBeNull();
  });

  it('sin compra mínima aplica a cualquier subtotal; con mínimo, solo si el subtotal lo alcanza', async () => {
    const sinMinimo = await promoEnvioGratisVigente(prismaCon([oferta()]), 'CARTA', MIERCOLES_14H);
    expect(aplicaPromoEnvio(sinMinimo, 3)).toBe(true);

    const conMinimo = await promoEnvioGratisVigente(prismaCon([oferta({ compra_minima: 50 })]), 'CARTA', MIERCOLES_14H);
    expect(conMinimo?.compraMinima).toBe(50);
    expect(aplicaPromoEnvio(conMinimo, 49.99)).toBe(false);
    expect(aplicaPromoEnvio(conMinimo, 50)).toBe(true);
    expect(aplicaPromoEnvio(null, 100)).toBe(false);
  });
});

describe('calcularEnvioDelivery (la misma cuenta para consulta, pedido y ubicar)', () => {
  it('con la promo vigente el envío es 0 aunque la zona cobre tarifa', async () => {
    const r = await calcularEnvioDelivery(prismaCon([oferta()]), {
      subtotal: 28,
      tarifaZona: 5,
      canal: 'CARTA',
      ahora: MIERCOLES_14H,
    });
    expect(r.envio).toBe(0);
    expect(r.promo?.id).toBe('77');
  });

  it('fuera de horario paga la tarifa de la zona', async () => {
    const r = await calcularEnvioDelivery(prismaCon([oferta()]), {
      subtotal: 28,
      tarifaZona: 5,
      canal: 'CARTA',
      ahora: MIERCOLES_18H,
    });
    expect(r).toEqual({ envio: 5, promo: null });
  });

  it('con compra mínima no alcanzada paga la tarifa; el envío gratis por monto sigue igual', async () => {
    const prisma = prismaCon([oferta({ compra_minima: 50 })], 70);
    expect(
      await calcularEnvioDelivery(prisma, { subtotal: 28, tarifaZona: 5, canal: 'CARTA', ahora: MIERCOLES_14H }),
    ).toEqual({ envio: 5, promo: null });
    // Sin promo, el envío gratis por monto (mas_de 70) manda: subtotal 84 -> 0
    const sinPromo = prismaCon([], 70);
    expect(
      await calcularEnvioDelivery(sinPromo, { subtotal: 84, tarifaZona: 5, canal: 'CARTA', ahora: MIERCOLES_14H }),
    ).toEqual({ envio: 0, promo: null });
  });
});
