import { NotFoundException } from '@nestjs/common';
import { SeguimientoService, estadoVoucherDe } from './seguimiento.service';
import { generarTokenSeguimiento } from './seguimiento.tokens';

const CREADO = new Date('2026-10-23T17:00:00Z');
const REVISADO = new Date('2026-10-23T17:20:00Z');

function pedido(extra: Record<string, unknown> = {}) {
  return {
    id: 7n,
    codigo: 'CAP-0007',
    estado: 'COLA',
    modalidad: 'DELIVERY',
    total: { toString: () => '42.50' },
    creado_en: CREADO,
    pasa_cocina_en: null,
    listo_en: null,
    despachado_en: null,
    entregado_en: null,
    historial: [],
    pago_preferido: 'PLIN',
    pago_estado: 'PENDIENTE',
    ...extra,
  };
}

function fila(extra: Record<string, unknown> = {}) {
  return {
    medio: 'PLIN',
    semaforo: 'CONFIABLE',
    motivos: [],
    creado_en: CREADO,
    revisado_en: null,
    ...extra,
  };
}

describe('SeguimientoService: estado del voucher', () => {
  let service: SeguimientoService;
  let prismaMock: any;
  const token = () => generarTokenSeguimiento(7n);

  beforeEach(() => {
    prismaMock = {
      pedido: { findUnique: jest.fn() },
      voucherPago: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new SeguimientoService(prismaMock);
  });

  function conPedido(extra: Record<string, unknown>) {
    prismaMock.pedido.findUnique.mockResolvedValue(pedido(extra));
  }

  describe('estadoVoucherDe', () => {
    it('sin vouchers vigentes: SIN_VOUCHER', () => {
      expect(estadoVoucherDe({ pagado: false, medioPreferido: 'YAPE', vouchers: [] })).toEqual({
        estado: 'SIN_VOUCHER',
        medio: 'YAPE',
        actualizadoEn: null,
      });
    });

    it('voucher útil sin revisar: EN_REVISION con el medio del voucher', () => {
      const r = estadoVoucherDe({ pagado: false, medioPreferido: 'YAPE', vouchers: [fila({ medio: 'PLIN' })] });
      expect(r.estado).toBe('EN_REVISION');
      expect(r.medio).toBe('PLIN');
      expect(r.actualizadoEn).toBe(CREADO.toISOString());
    });

    it('voucher útil revisado por el equipo: VERIFICADO con la hora de revisión', () => {
      const r = estadoVoucherDe({ pagado: false, medioPreferido: 'PLIN', vouchers: [fila({ revisado_en: REVISADO })] });
      expect(r).toEqual({ estado: 'VERIFICADO', medio: 'PLIN', actualizadoEn: REVISADO.toISOString() });
    });

    it('pedido PAGADO por Caja: VERIFICADO aunque no haya voucher', () => {
      expect(estadoVoucherDe({ pagado: true, medioPreferido: 'YAPE', vouchers: [] })).toEqual({
        estado: 'VERIFICADO',
        medio: 'YAPE',
        actualizadoEn: null,
      });
    });

    it('solo ILEGIBLE: RECHAZADO con el motivo corto; un ILEGIBLE no cuenta como comprobante', () => {
      const r = estadoVoucherDe({
        pagado: false,
        medioPreferido: 'YAPE',
        vouchers: [fila({ semaforo: 'ILEGIBLE', motivos: ['Voucher no legible'] })],
      });
      expect(r).toEqual({
        estado: 'RECHAZADO',
        medio: 'PLIN',
        actualizadoEn: CREADO.toISOString(),
        motivo: 'Voucher no legible',
      });
    });

    it('un ILEGIBLE más nuevo no tapa un voucher útil anterior: sigue EN_REVISION', () => {
      const r = estadoVoucherDe({
        pagado: false,
        medioPreferido: 'YAPE',
        vouchers: [fila({ semaforo: 'ILEGIBLE', motivos: ['Voucher no legible'] }), fila({ semaforo: 'OBSERVADO' })],
      });
      expect(r.estado).toBe('EN_REVISION');
    });
  });

  describe('obtener', () => {
    it('pago digital sin voucher: bloque SIN_VOUCHER', async () => {
      conPedido({});
      const r = await service.obtener('CAP-0007', token());
      expect(r.pagoDigital).toBe(true);
      expect(r.voucher?.estado).toBe('SIN_VOUCHER');
    });

    it('pago digital con voucher ilegible: RECHAZADO', async () => {
      conPedido({});
      prismaMock.voucherPago.findMany.mockResolvedValue([fila({ semaforo: 'ILEGIBLE', motivos: ['Voucher no legible'] })]);
      const r = await service.obtener('CAP-0007', token());
      expect(r.voucher?.estado).toBe('RECHAZADO');
      expect(r.voucher?.motivo).toBe('Voucher no legible');
    });

    it('pago digital con voucher útil: EN_REVISION', async () => {
      conPedido({});
      prismaMock.voucherPago.findMany.mockResolvedValue([fila()]);
      const r = await service.obtener('CAP-0007', token());
      expect(r.voucher?.estado).toBe('EN_REVISION');
    });

    it('pago dividido Yape 38 + efectivo 2: la carta muestra solo S/ 38 por yapear y S/ 2 al recibir', async () => {
      conPedido({
        pago_preferido: 'YAPE',
        total: { toString: () => '40.00' },
        planPago: [{ medio: 'YAPE', monto: '38.00' }, { medio: 'EFECTIVO', monto: '2.00' }],
      });
      const r = await service.obtener('CAP-0007', token());
      expect(r.montoDigital).toBe(38);
      expect(r.montoContraentrega).toBe(2);
    });

    it('sin plan no manda montos: la carta usa el total de siempre', async () => {
      conPedido({});
      const r = await service.obtener('CAP-0007', token());
      expect(r.montoDigital).toBeUndefined();
    });

    it('pago digital verificado: VERIFICADO', async () => {
      conPedido({ pago_estado: 'PAGADO' });
      const r = await service.obtener('CAP-0007', token());
      expect(r.voucher?.estado).toBe('VERIFICADO');
    });

    it('pago en efectivo: no hay bloque de voucher y no se consultan vouchers', async () => {
      conPedido({ pago_preferido: 'EFECTIVO' });
      const r = await service.obtener('CAP-0007', token());
      expect(r.pagoDigital).toBe(false);
      expect('voucher' in r).toBe(false);
      expect(prismaMock.voucherPago.findMany).not.toHaveBeenCalled();
    });

    it('la respuesta solo lleva estado y medio del voucher, nunca imagen, operación, montos ni titular', async () => {
      conPedido({});
      prismaMock.voucherPago.findMany.mockResolvedValue([fila({ revisado_en: REVISADO })]);
      const r = await service.obtener('CAP-0007', token());
      expect(Object.keys(r.voucher ?? {}).sort()).toEqual(['actualizadoEn', 'estado', 'medio']);
      const texto = JSON.stringify(r);
      expect(texto).not.toMatch(/archivo|imagen|operacion|extraido|monto|titular|hash|semaforo/i);
    });

    it('la consulta de vouchers no pide imagen, operación ni datos leídos', async () => {
      conPedido({});
      await service.obtener('CAP-0007', token());
      const args = prismaMock.voucherPago.findMany.mock.calls[0][0];
      expect(Object.keys(args.select).sort()).toEqual(['creado_en', 'medio', 'motivos', 'revisado_en', 'semaforo']);
      expect(args.where).toEqual({ pedido_id: 7n, reemplazado_en: null });
    });

    it('token inválido: responde como pedido inexistente y no consulta vouchers', async () => {
      conPedido({});
      await expect(service.obtener('CAP-0007', 'mal')).rejects.toBeInstanceOf(NotFoundException);
      await expect(service.obtener('CAP-0007', undefined)).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.voucherPago.findMany).not.toHaveBeenCalled();
    });
  });
});
