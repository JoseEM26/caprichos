import { calcularMontosCaja } from './caja.calculo';
import { montoACobrar } from '../../comun/monto-a-cobrar';
import { anularAdelantoTx, registrarAdelantoTx } from '../pedidos/adelanto.util';

/**
 * Ejemplo: pedido programado de S/ 60. Hoy (día 1) el cliente adelanta S/ 30 en efectivo; el día 2 paga el saldo (S/ 30) con Yape.
 * Día 1 entran 30; día 2 entran 30 (no 60); lo cobrado suma exactamente el total del pedido.
 */
describe('adelantos de pedidos programados y caja del día', () => {
  const caja = (id: bigint) => ({ id, fecha: new Date('2026-11-13T00:00:00.000Z'), apertura: 100 });
  const cliente = (cobros: any[], adelantos: any[]): any => ({
    cobro: { findMany: jest.fn().mockResolvedValue(cobros) },
    pedidoAdelanto: { findMany: jest.fn().mockResolvedValue(adelantos) },
    movimientoCaja: { findMany: jest.fn().mockResolvedValue([]) },
    liquidacion: { findMany: jest.fn().mockResolvedValue([]) },
    pedido: { findMany: jest.fn().mockResolvedValue([]) },
  });

  it('el adelanto en efectivo cuenta en la caja del día en que se recibió', async () => {
    const dia1 = await calcularMontosCaja(cliente([], [{ medio: 'EFECTIVO', monto: 30 }]), caja(1n));
    expect(dia1.ventasEfectivo).toBe(30);
    expect(dia1.esperadoEfectivo).toBe(130); // apertura 100 + adelanto 30
  });

  it('el día del cobro entra solo el saldo; sumando los dos días da el total del pedido', async () => {
    const saldo = montoACobrar({ total: 60, adelanto_total: 30 });
    expect(saldo).toBe(30);
    const dia2 = await calcularMontosCaja(cliente([{ pagos: [{ medio: 'YAPE', monto: saldo, propina: 0 }] }], []), caja(2n));
    expect(dia2.sistemaYape).toBe(30);
    expect(dia2.ventasEfectivo).toBe(0);
    expect(30 + dia2.sistemaYape).toBe(60);
  });

  it('un adelanto anulado no cuenta (la consulta filtra anulado_en null) y el adelanto con tarjeta suma a tarjeta', async () => {
    const c = cliente([], [{ medio: 'TARJETA', monto: 12.5 }]);
    const m = await calcularMontosCaja(c, caja(1n));
    expect(c.pedidoAdelanto.findMany).toHaveBeenCalledWith({ where: { caja_id: 1n, anulado_en: null } });
    expect(m.sistemaTarjeta).toBe(12.5);
  });

  it('sin adelantos todo queda igual y el pedido sin adelanto cobra el total', async () => {
    const m = await calcularMontosCaja(cliente([], []), caja(1n));
    expect(m.esperadoEfectivo).toBe(100);
    expect(montoACobrar({ total: 60 })).toBe(60);
  });

  describe('registrarAdelantoTx', () => {
    const tx = (over: any = {}): any => ({
      caja: { findUnique: jest.fn().mockResolvedValue({ id: 5n, estado: 'ABIERTA' }), findFirst: jest.fn().mockResolvedValue(null) },
      $queryRaw: jest.fn().mockResolvedValue([]),
      pedido: { findUnique: jest.fn().mockResolvedValue({ id: 9n, estado: 'PROGRAMADO', total: 60, monto_credito: 0, adelanto_total: 0 }), update: jest.fn() },
      pedidoAdelanto: { create: jest.fn().mockResolvedValue({ id: 1n }), findUnique: jest.fn(), update: jest.fn() },
      pedidoPagoPlan: { deleteMany: jest.fn() },
      ...over,
    });

    it('registra en la caja de hoy y sube adelanto_total', async () => {
      const t = tx();
      await registrarAdelantoTx(t, 9n, { medio: 'efectivo', monto: 30 }, 7n);
      expect(t.pedidoAdelanto.create.mock.calls[0][0].data).toMatchObject({ pedido_id: 9n, caja_id: 5n, medio: 'EFECTIVO' });
      expect(t.pedido.update.mock.calls[0][0].data.adelanto_total.increment.toString()).toBe('30');
    });

    it('acepta cualquier medio (Yape sin captura) pero no un medio inventado; rechaza montos que cubren todo, pedidos no programados y caja cerrada', async () => {
      const yape = tx();
      await registrarAdelantoTx(yape, 9n, { medio: 'YAPE', monto: 10 }, 7n);
      expect(yape.pedidoAdelanto.create.mock.calls[0][0].data.medio).toBe('YAPE');
      await expect(registrarAdelantoTx(tx(), 9n, { medio: 'CHEQUE', monto: 10 }, 7n)).rejects.toMatchObject({ response: { codigo: 'ADELANTO_MEDIO_INVALIDO' } });
      await expect(registrarAdelantoTx(tx(), 9n, { medio: 'EFECTIVO', monto: 60 }, 7n)).rejects.toMatchObject({ response: { codigo: 'ADELANTO_CUBRE_TODO' } });
      await expect(registrarAdelantoTx(tx({ pedido: { findUnique: jest.fn().mockResolvedValue({ estado: 'COLA', total: 60 }) } }), 9n, { medio: 'EFECTIVO', monto: 10 }, 7n)).rejects.toMatchObject({ response: { codigo: 'ADELANTO_SOLO_PROGRAMADO' } });
      await expect(registrarAdelantoTx(tx({ caja: { findUnique: jest.fn().mockResolvedValue({ id: 5n, estado: 'CERRADA' }), findFirst: jest.fn().mockResolvedValue(null) } }), 9n, { medio: 'EFECTIVO', monto: 10 }, 7n)).rejects.toMatchObject({ response: { codigo: 'CAJA_CERRADA' } });
    });

    it('anular un adelanto de una caja abierta lo resta de ese cierre, sin egreso', async () => {
      const previo = { id: 1n, pedido_id: 9n, caja_id: 5n, medio: 'EFECTIVO', monto: 30, anulado_en: null };
      const abierta = tx({ pedidoAdelanto: { findUnique: jest.fn().mockResolvedValue(previo), update: jest.fn() }, movimientoCaja: { create: jest.fn() }, caja: { findUnique: jest.fn().mockResolvedValue({ id: 5n, estado: 'ABIERTA' }) } });
      await anularAdelantoTx(abierta, 1n, 'cliente cancela', 7n);
      expect(abierta.pedidoAdelanto.update).toHaveBeenCalled();
      expect(abierta.movimientoCaja.create).not.toHaveBeenCalled();
      expect(abierta.pedido.update.mock.calls[0][0].data.adelanto_total.decrement.toString()).toBe('30');
    });

    it('con la caja del adelanto cerrada: el efectivo sale como egreso de hoy (si hoy está cerrada, 409) y un medio digital solo se registra', async () => {
      const cajas: Record<string, any> = { '5': { id: 5n, estado: 'CERRADA' }, '6': { id: 6n, estado: 'ABIERTA' } };
      const montar = (medio: string, hoy: any) =>
        tx({
          pedidoAdelanto: { findUnique: jest.fn().mockResolvedValue({ id: 1n, pedido_id: 9n, caja_id: 5n, medio, monto: 30, anulado_en: null }), update: jest.fn() },
          movimientoCaja: { create: jest.fn().mockResolvedValue({ id: 8n }) },
          caja: { findUnique: jest.fn(({ where }: any) => Promise.resolve(where.id ? (String(where.id) === '6' ? hoy : cajas[String(where.id)]) : hoy)) },
        });
      const efectivo = montar('EFECTIVO', cajas['6']);
      await anularAdelantoTx(efectivo, 1n, 'cliente cancela', 7n);
      expect(efectivo.movimientoCaja.create.mock.calls[0][0].data).toMatchObject({ caja_id: 6n, tipo: 'EGRESO' });
      await expect(anularAdelantoTx(montar('EFECTIVO', { id: 6n, estado: 'CERRADA' }), 1n, 'cliente cancela', 7n)).rejects.toMatchObject({ response: { codigo: 'CAJA_CERRADA' } });
      const yape = montar('YAPE', cajas['6']);
      await anularAdelantoTx(yape, 1n, 'cliente cancela', 7n);
      expect(yape.movimientoCaja.create).not.toHaveBeenCalled();
      expect(yape.pedidoAdelanto.update.mock.calls[0][0].data).toMatchObject({ devuelto_en_caja_id: 6n });
    });
  });
});
