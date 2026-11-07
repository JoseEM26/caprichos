import {
  limpiarAgotadosAutomaticosDeProducto,
  sincronizarAgotadoProducto,
  sincronizarAgotadoSabor,
} from './producto-controlado';
import { FECHA_HASTA_REACTIVAR } from '../cocina/cocina.util';

const AHORA = new Date('2026-11-06T15:00:00Z');

function db(prod: any, sab?: any) {
  return {
    producto: { findUnique: jest.fn().mockResolvedValue(prod), update: jest.fn(), updateMany: jest.fn() },
    sabor: { findUnique: jest.fn().mockResolvedValue(sab), update: jest.fn(), updateMany: jest.fn() },
    agotado: { create: jest.fn(), updateMany: jest.fn() },
  };
}

describe('Origen del agotado (MANUAL vs AUTOMATICO)', () => {
  describe('producto', () => {
    it('saldo 0 sin agotado: lo marca AUTOMATICO (producto y fila de historial)', async () => {
      const d = db({ agotado_hasta: null, agotado_origen: null });
      expect(await sincronizarAgotadoProducto(d, 1n, 0, AHORA)).toBe('AGOTADO');
      expect(d.producto.update).toHaveBeenCalledWith({
        where: { id: 1n },
        data: { agotado_hasta: FECHA_HASTA_REACTIVAR, agotado_origen: 'AUTOMATICO' },
      });
      expect(d.agotado.create.mock.calls[0][0].data.origen).toBe('AUTOMATICO');
    });

    it('saldo > 0 con agotado AUTOMATICO: vuelve solo (apertura del día / anulación / reposición)', async () => {
      const d = db({ agotado_hasta: FECHA_HASTA_REACTIVAR, agotado_origen: 'AUTOMATICO' });
      expect(await sincronizarAgotadoProducto(d, 1n, 5, AHORA)).toBe('REACTIVADO');
      expect(d.producto.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { agotado_hasta: null, agotado_origen: null } });
      expect(d.agotado.updateMany).toHaveBeenCalled();
    });

    it.each(['MANUAL', null, undefined])('saldo > 0 con agotado %s: NO se reactiva solo', async (origen) => {
      const d = db({ agotado_hasta: FECHA_HASTA_REACTIVAR, agotado_origen: origen });
      expect(await sincronizarAgotadoProducto(d, 1n, 5, AHORA)).toBeNull();
      expect(d.producto.update).not.toHaveBeenCalled();
      expect(d.agotado.updateMany).not.toHaveBeenCalled();
    });

    it('saldo 0 con agotado MANUAL: se queda MANUAL (no se reescribe ni se duplica)', async () => {
      const d = db({ agotado_hasta: FECHA_HASTA_REACTIVAR, agotado_origen: 'MANUAL' });
      expect(await sincronizarAgotadoProducto(d, 1n, 0, AHORA)).toBeNull();
      expect(d.producto.update).not.toHaveBeenCalled();
      expect(d.agotado.create).not.toHaveBeenCalled();
    });
  });

  describe('sabor', () => {
    it('saldo 0: AUTOMATICO; saldo > 0: solo reactiva el AUTOMATICO', async () => {
      const d0 = db(null, { agotado_hasta: null, agotado_origen: null, producto_id: 1n });
      expect(await sincronizarAgotadoSabor(d0, 2n, 0, AHORA)).toBe('AGOTADO');
      expect(d0.sabor.update.mock.calls[0][0].data.agotado_origen).toBe('AUTOMATICO');
      expect(d0.agotado.create.mock.calls[0][0].data.origen).toBe('AUTOMATICO');

      const da = db(null, { agotado_hasta: FECHA_HASTA_REACTIVAR, agotado_origen: 'AUTOMATICO', producto_id: 1n });
      expect(await sincronizarAgotadoSabor(da, 2n, 3, AHORA)).toBe('REACTIVADO');

      const dm = db(null, { agotado_hasta: FECHA_HASTA_REACTIVAR, agotado_origen: 'MANUAL', producto_id: 1n });
      expect(await sincronizarAgotadoSabor(dm, 2n, 3, AHORA)).toBeNull();
      expect(dm.sabor.update).not.toHaveBeenCalled();
    });
  });

  describe('apagar «Controlar stock» (limpiarAgotadosAutomaticosDeProducto)', () => {
    it('solo toca origen AUTOMATICO (producto, sabores e historial abierto); el MANUAL queda', async () => {
      const d = db(null);
      await limpiarAgotadosAutomaticosDeProducto(d, 9n, AHORA);
      expect(d.producto.updateMany).toHaveBeenCalledWith({
        where: { id: 9n, agotado_origen: 'AUTOMATICO' },
        data: { agotado_hasta: null, agotado_origen: null },
      });
      expect(d.sabor.updateMany).toHaveBeenCalledWith({
        where: { producto_id: 9n, agotado_origen: 'AUTOMATICO' },
        data: { agotado_hasta: null, agotado_origen: null },
      });
      expect(d.agotado.updateMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ reactivado_en: null, origen: 'AUTOMATICO' }),
        data: { reactivado_en: AHORA },
      });
    });
  });
});
