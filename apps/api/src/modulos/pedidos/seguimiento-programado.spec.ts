import { SeguimientoService } from './seguimiento.service';
import { generarTokenSeguimiento } from './seguimiento.tokens';

/** Pedido programado desde la carta o el bot: se puede seguir y adjuntar el voucher aunque la caja esté cerrada. */
describe('SeguimientoService: pedido programado', () => {
  const PACTADO = new Date('2027-03-02T15:30:00Z');
  let prismaMock: any;
  let service: SeguimientoService;

  const pedido = (extra: Record<string, unknown> = {}) => ({
    id: 7n,
    codigo: 'CAP-0007',
    estado: 'PROGRAMADO',
    modalidad: 'RECOGER',
    total: { toString: () => '42.50' },
    creado_en: new Date('2027-03-01T04:00:00Z'),
    programado_para: PACTADO,
    pasa_cocina_en: null,
    listo_en: null,
    despachado_en: null,
    entregado_en: null,
    historial: [],
    pago_preferido: 'YAPE',
    pago_estado: 'PENDIENTE',
    ...extra,
  });

  beforeEach(() => {
    prismaMock = { pedido: { findUnique: jest.fn().mockResolvedValue(pedido()) }, voucherPago: { findMany: jest.fn().mockResolvedValue([]) } };
    service = new SeguimientoService(prismaMock);
  });

  it('el seguimiento dice para cuándo quedó programado y lo etiqueta «Programado»', async () => {
    const r = await service.obtener('CAP-0007', generarTokenSeguimiento(7n));
    expect(r.estado).toBe('PROGRAMADO');
    expect(r.estadoEtiqueta).toBe('Programado');
    expect(r.programadoPara).toBe(PACTADO.toISOString());
  });

  it('un pedido que ya no está programado no trae la fecha', async () => {
    prismaMock.pedido.findUnique.mockResolvedValue(pedido({ estado: 'COLA' }));
    const r = await service.obtener('CAP-0007', generarTokenSeguimiento(7n));
    expect(r.programadoPara).toBeUndefined();
  });

  it('adjuntar la captura del pago de un pedido PROGRAMADO está permitido (no depende de la caja)', async () => {
    await expect(service.idParaComprobante('CAP-0007', generarTokenSeguimiento(7n))).resolves.toBe(7n);
  });
});
