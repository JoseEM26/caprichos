import { exigirComprobanteDigital } from '../comprobante-pago.util';

describe('exigirComprobanteDigital con plan de pago', () => {
  const pedidoId = 100n;
  const verificarPin = jest.fn(async () => ({ supervisorPartyId: 7n }));
  const sinVoucher = { motivo: 'El cliente mostró el yape en el celular', pinSupervisor: '123456' };

  const dbCon = (vouchers: Array<{ medio: string | null }>) => ({
    voucherPago: {
      findFirst: jest.fn(async () => (vouchers.length ? { id: 1n } : null)),
      findMany: jest.fn(async () => vouchers),
    },
  });

  beforeEach(() => verificarPin.mockClear());

  const planYapePlin = [{ medio: 'YAPE' }, { medio: 'PLIN' }, { medio: 'EFECTIVO' }];

  it('la captura es opcional: con YAPE y PLIN y solo la de Yape no lanza, deja «sin captura» de Plin', async () => {
    const db = dbCon([{ medio: 'YAPE' }]);
    const auth = await exigirComprobanteDigital({
      db: db as any,
      pedidoId,
      medios: ['YAPE', 'PLIN', 'EFECTIVO'],
      planPago: planYapePlin,
      permiteExcepcion: false,
      verificarPin,
    });
    expect(auth).toMatchObject({ faltan: ['PLIN'], sinCaptura: true, supervisorPartyId: '' });
    expect(verificarPin).not.toHaveBeenCalled();
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
        verificarPin,
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
        verificarPin,
      }),
    ).resolves.toBeNull();
  });

  it('un cliente viejo que aún manda motivo y código no frena el cobro y no pide supervisor', async () => {
    const db = dbCon([{ medio: 'YAPE' }]);
    const auth = await exigirComprobanteDigital({
      db: db as any,
      pedidoId,
      medios: ['YAPE', 'PLIN'],
      planPago: planYapePlin,
      sinVoucher,
      permiteExcepcion: true,
      verificarPin,
    });

    expect(verificarPin).not.toHaveBeenCalled();
    expect(auth).toMatchObject({ supervisorPartyId: '', faltan: ['PLIN'], sinCaptura: true });
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
        verificarPin,
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
      verificarPin,
    });
    expect(auth).toMatchObject({ faltan: ['YAPE'], sinCaptura: true });
  });

  it('efectivo no deja marca de «sin captura»', async () => {
    const db = dbCon([]);
    await expect(
      exigirComprobanteDigital({ db: db as any, pedidoId, medios: ['EFECTIVO'], permiteExcepcion: false, verificarPin }),
    ).resolves.toBeNull();
  });
});
