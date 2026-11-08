import { BadRequestException } from '@nestjs/common';
import { exigirComprobanteDigital } from '../comprobante-pago.util';

describe('exigirComprobanteDigital con plan de pago', () => {
  const pedidoId = 100n;
  const sinVoucher = { motivo: 'El cliente mostró el yape en el celular' };

  const dbCon = (vouchers: Array<{ medio: string | null }>) => ({
    voucherPago: {
      findFirst: jest.fn(async () => (vouchers.length ? { id: 1n } : null)),
      findMany: jest.fn(async () => vouchers),
    },
  });

  const planYapePlin = [{ medio: 'YAPE' }, { medio: 'PLIN' }, { medio: 'EFECTIVO' }];

  it('plan con YAPE y PLIN: una captura de Yape no basta, falta la de Plin', async () => {
    const db = dbCon([{ medio: 'YAPE' }]);
    const err = await exigirComprobanteDigital({
      db: db as any,
      pedidoId,
      medios: ['YAPE', 'PLIN', 'EFECTIVO'],
      planPago: planYapePlin,
      permiteExcepcion: true,
    }).catch((e) => e);

    expect(err).toBeInstanceOf(BadRequestException);
    expect(err.getResponse()).toMatchObject({ codigo: 'VOUCHER_REQUERIDO', faltan: ['PLIN'] });
    expect(err.getResponse().mensaje).toContain('Falta la captura de Plin');
  });

  it('plan con YAPE y PLIN: con una captura por cada medio cobra sin excepción', async () => {
    const db = dbCon([{ medio: 'YAPE' }, { medio: 'PLIN' }]);
    await expect(
      exigirComprobanteDigital({
        db: db as any,
        pedidoId,
        medios: ['YAPE', 'PLIN'],
        planPago: planYapePlin,
        permiteExcepcion: true,
      }),
    ).resolves.toBeNull();
  });

  it('un voucher sin medio (antiguo) cubre cualquier medio del plan', async () => {
    const db = dbCon([{ medio: null }]);
    await expect(
      exigirComprobanteDigital({
        db: db as any,
        pedidoId,
        medios: ['YAPE', 'PLIN'],
        planPago: planYapePlin,
        permiteExcepcion: true,
      }),
    ).resolves.toBeNull();
  });

  it('la excepción con motivo cubre solo los medios que faltan', async () => {
    const db = dbCon([{ medio: 'YAPE' }]);
    const auth = await exigirComprobanteDigital({
      db: db as any,
      pedidoId,
      medios: ['YAPE', 'PLIN'],
      planPago: planYapePlin,
      sinVoucher,
      permiteExcepcion: true,
    });

    expect(auth).toEqual({ motivo: sinVoucher.motivo, faltan: ['PLIN'] });
  });

  it('plan con un solo medio digital: se mantiene la regla de siempre (un voucher basta)', async () => {
    const db = dbCon([{ medio: 'PLIN' }]);
    await expect(
      exigirComprobanteDigital({
        db: db as any,
        pedidoId,
        medios: ['YAPE', 'EFECTIVO'],
        planPago: [{ medio: 'YAPE' }, { medio: 'EFECTIVO' }],
        permiteExcepcion: true,
      }),
    ).resolves.toBeNull();
    expect(db.voucherPago.findMany).not.toHaveBeenCalled();
  });

  it('sin plan: se mantiene el comportamiento de siempre', async () => {
    const db = dbCon([]);
    const err = await exigirComprobanteDigital({
      db: db as any,
      pedidoId,
      medios: ['YAPE'],
      permiteExcepcion: false,
    }).catch((e) => e);
    expect(err.getResponse()).toMatchObject({ codigo: 'VOUCHER_REQUERIDO', faltan: ['YAPE'] });
  });
});
