import { exigirComprobanteDigital } from '../comprobante-pago.util';

describe('exigirComprobanteDigital con plan de pago', () => {
  const pedidoId = 100n;

  const dbCon = (vouchers: Array<{ medio: string | null }>) => ({
    voucherPago: {
      findFirst: jest.fn(async () => (vouchers.length ? { id: 1n } : null)),
      findMany: jest.fn(async () => vouchers),
    },
  });

  const planYapePlin = [{ medio: 'YAPE' }, { medio: 'PLIN' }, { medio: 'EFECTIVO' }];

  it('la captura es opcional: con YAPE y PLIN y solo la de Yape no lanza, deja «sin captura» de Plin', async () => {
    const db = dbCon([{ medio: 'YAPE' }]);
    const auth = await exigirComprobanteDigital({
      db: db as any,
      pedidoId,
      medios: ['YAPE', 'PLIN', 'EFECTIVO'],
      planPago: planYapePlin,
      permiteExcepcion: false,
    });
    expect(auth).toMatchObject({ faltan: ['PLIN'], sinCaptura: true });
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

  it('sin plan y sin foto (delivery, bot o carta): cobra igual y queda auditado «sin captura»', async () => {
    const db = dbCon([]);
    const auth = await exigirComprobanteDigital({
      db: db as any,
      pedidoId,
      medios: ['YAPE'],
      permiteExcepcion: false,
    });
    expect(auth).toMatchObject({ faltan: ['YAPE'], sinCaptura: true });
  });

  it('efectivo no deja marca de «sin captura»', async () => {
    const db = dbCon([]);
    await expect(
      exigirComprobanteDigital({ db: db as any, pedidoId, medios: ['EFECTIVO'], permiteExcepcion: false }),
    ).resolves.toBeNull();
  });
});
