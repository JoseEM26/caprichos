import { BadRequestException } from '@nestjs/common';
import { PagoPlanService, montoEsperadoVoucher } from './pago-plan.service';

const codigoDe = (fn: () => unknown): string | undefined => {
  try {
    fn();
  } catch (e) {
    return (e as any).response?.codigo;
  }
  return undefined;
};

describe('PagoPlanService', () => {
  const servicio = new PagoPlanService();

  it('valida un plan que suma el total y lo devuelve ordenado', () => {
    const plan = servicio.validar(
      [
        { medio: 'efectivo', monto: 4 },
        { medio: 'YAPE', monto: 6.5 },
      ],
      10.5,
    );
    expect(plan).toEqual([
      { medio: 'EFECTIVO', monto: 4, orden: 0 },
      { medio: 'YAPE', monto: 6.5, orden: 1 },
    ]);
  });

  it('tolera 1 céntimo de diferencia y rechaza más', () => {
    expect(() => servicio.validar([{ medio: 'YAPE', monto: 10.01 }], 10)).not.toThrow();
    expect(() => servicio.validar([{ medio: 'YAPE', monto: 10.02 }], 10)).toThrow(BadRequestException);
  });

  it('rechaza una suma distinta del total', () => {
    expect(codigoDe(() => servicio.validar([{ medio: 'YAPE', monto: 9 }], 10))).toBe('PLAN_PAGO_NO_CUADRA');
  });

  it('rechaza un medio fuera de la lista', () => {
    expect(codigoDe(() => servicio.validar([{ medio: 'CHEQUE', monto: 10 }], 10))).toBe('PLAN_PAGO_MEDIO_INVALIDO');
  });

  it('TARJETA entra al plan (no lleva voucher) y puede ir con otro medio', () => {
    const plan = servicio.validar([{ medio: 'YAPE', monto: 6 }, { medio: 'TARJETA', monto: 4 }], 10)!;
    expect(plan.map((f) => f.medio)).toEqual(['YAPE', 'TARJETA']);
    expect(servicio.montoDigital(plan)).toBe(6);
  });

  it('rechaza el mismo medio dos veces y montos no positivos', () => {
    expect(
      codigoDe(() =>
        servicio.validar(
          [
            { medio: 'YAPE', monto: 5 },
            { medio: 'YAPE', monto: 5 },
          ],
          10,
        ),
      ),
    ).toBe('PLAN_PAGO_MEDIO_REPETIDO');
    expect(codigoDe(() => servicio.validar([{ medio: 'YAPE', monto: 0 }], 0))).toBe('PLAN_PAGO_MONTO_INVALIDO');
  });

  it('sin plan (null o lista vacía) devuelve null: retrocompatible', () => {
    expect(servicio.validar(undefined, 10)).toBeNull();
    expect(servicio.validar([], 10)).toBeNull();
  });

  it('un solo medio se guarda como plan de un renglón', () => {
    const plan = servicio.validar([{ medio: 'PLIN', monto: 33 }], 33);
    expect(plan).toEqual([{ medio: 'PLIN', monto: 33, orden: 0 }]);
    expect(servicio.pagoPrincipal(plan!)).toBe('PLIN');
  });

  it('pago principal: el digital; si no hay digital, el de mayor monto', () => {
    expect(
      servicio.pagoPrincipal([
        { medio: 'EFECTIVO', monto: 30 },
        { medio: 'TRANSFERENCIA', monto: 5 },
      ]),
    ).toBe('TRANSFERENCIA');
    expect(servicio.pagoPrincipal([{ medio: 'EFECTIVO', monto: 5 }])).toBe('EFECTIVO');
  });

  it('montoDigital y montoEsperadoVoucher: con plan digital compara solo esa parte', () => {
    const plan = [
      { medio: 'EFECTIVO', monto: 20 },
      { medio: 'YAPE', monto: 15 },
    ];
    expect(servicio.montoDigital(plan)).toBe(15);
    expect(montoEsperadoVoucher(plan, 35)).toBe(15);
  });

  it('montoEsperadoVoucher sin plan usa el total; plan solo efectivo no compara', () => {
    expect(montoEsperadoVoucher(undefined, 35)).toBe(35);
    expect(montoEsperadoVoucher([{ medio: 'EFECTIVO', monto: 35 }], 35)).toBeNull();
  });
});
