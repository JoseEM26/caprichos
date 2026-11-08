import { mediosPagoPublicos, PAGOS_DEFAULT } from './local.service';
import { TEXTOS_REPARTO } from '../chatbot/conversacion/textos-reparto';
import { detalleDatosPago } from '../chatbot/conversacion/flujos/pago/textos-pago';

describe('mediosPagoPublicos: a quién pagar', () => {
  it('los parámetros voucher_* ponen número y titular de Yape y Plin', () => {
    const m = mediosPagoPublicos([
      { clave: 'local_pagos', valor: { yape: { activo: true, numero: '111' }, plin: { activo: true }, efectivo: { activo: true } } },
      { clave: 'voucher_titular_nombre', valor: '"Maria Perez"' },
      { clave: 'voucher_yape_numero', valor: '"977503006"' },
      { clave: 'voucher_plin_numero', valor: '988111222' },
    ]);
    expect(m.yape).toMatchObject({ numero: '977503006', titular: 'Maria Perez' });
    expect(m.plin).toMatchObject({ numero: '988111222', titular: 'Maria Perez' });
    expect(m.efectivo).toEqual({ activo: true });
  });

  it('sin parámetros usa los valores por defecto y no falla; los medios apagados no salen', () => {
    expect(mediosPagoPublicos([]).yape.numero).toBe(PAGOS_DEFAULT.yape.numero);
    expect(mediosPagoPublicos([{ clave: 'local_pagos', valor: { yape: { activo: false, numero: '1' } } }])).toEqual({});
  });
});

describe('aviso de pedido recibido con pago digital', () => {
  const resumen = { lineas: ['1 x Dona'], total: 27, medioPago: 'Yape', envioPorConfirmar: false, envio: null };

  it('incluye número, titular y monto antes de pedir la captura', () => {
    const datos = `${detalleDatosPago('YAPE', { yape: { numero: '977503006', titular: 'Maria Perez' } }, '27.00')}\n• Monto: S/ 27.00`;
    const t = TEXTOS_REPARTO.recibidoDigital('Ana', 'CP-W040', 'Yape', null, resumen, datos).textoLibre;
    expect(t).toContain('977503006');
    expect(t).toContain('Maria Perez');
    expect(t).toContain('S/ 27.00');
    expect(t.indexOf('977503006')).toBeLessThan(t.indexOf('envíanos por aquí mismo la captura'));
  });

  it('sin datos de pago el texto sale como antes', () => {
    const t = TEXTOS_REPARTO.recibidoDigital('Ana', 'CP-W040', 'Yape', null, resumen).textoLibre;
    expect(t).toContain('Pago por Yape: tu pedido ya está en marcha');
    expect(t).toContain('envíanos por aquí mismo la captura (foto) de tu pago');
    expect(t).toContain('(opcional)');
  });
});
