import { mediosPagoPublicos } from './local.service';

describe('datos de pago que ve el bot', () => {
  it('toma el número y el titular configurados, no uno de relleno, y los entrega en mediosPago y mediosPagoVisibles', () => {
    const parametros = [
      { clave: 'local_pagos', valor: { yape: { activo: true, numero: '977503006' }, plin: { activo: true, numero: '977503006' }, transferencia: { activo: true, banco: 'BCP', cuenta: '19197148281074' } } },
      { clave: 'voucher_titular_nombre', valor: 'Maria Jose Morillo Ruiz' },
    ];
    const v = mediosPagoPublicos(parametros);
    expect(v.yape.numero).toBe('977503006');
    expect(v.yape.titular).toBe('Maria Jose Morillo Ruiz');
    expect(v.transferencia.cuenta).toBe('19197148281074');
    expect(v.transferencia.banco).toBe('BCP');
  });
});

describe('titular por medio de pago', () => {
  it('el titular escrito junto al Yape manda sobre el titular general de los vouchers', () => {
    const v = mediosPagoPublicos([
      { clave: 'local_pagos', valor: { yape: { activo: true, numero: '977503006', titular: 'Kevin Rosales' }, plin: { activo: true, numero: '977503006' } } },
      { clave: 'voucher_titular_nombre', valor: 'Maria Jose Morillo Ruiz' },
    ]);
    expect(v.yape.titular).toBe('Kevin Rosales');
    expect(v.plin.titular).toBe('Maria Jose Morillo Ruiz');
  });
});
