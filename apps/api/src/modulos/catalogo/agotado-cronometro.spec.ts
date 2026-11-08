jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { BadRequestException } from '@nestjs/common';
import { AGOTADO_INDEFINIDO, CatalogoService, estaDisponible, regresoAgotado } from './catalogo.service';

describe('Agotado con cronómetro', () => {
  describe('estaDisponible / regresoAgotado (límites exactos y Lima)', () => {
    const t = Date.parse('2026-11-08T20:40:00Z'); // 15:40 en Lima

    it('vence justo en el instante de regreso: ≤ ahora es disponible', () => {
      expect(estaDisponible(new Date(t), t)).toBe(true);
      expect(estaDisponible(new Date(t + 1), t)).toBe(false);
      expect(estaDisponible(new Date(t - 1), t)).toBe(true);
    });

    it('indefinido (9999) y null', () => {
      expect(estaDisponible(AGOTADO_INDEFINIDO, t)).toBe(false);
      expect(estaDisponible(null, t)).toBe(true);
      expect(regresoAgotado(AGOTADO_INDEFINIDO)).toBeNull();
      expect(regresoAgotado(null)).toBeNull();
    });

    it('cruce de medianoche de Lima (05:00 UTC): 23:59 Lima sigue agotado, 00:00 Lima ya volvió', () => {
      const medianoche = new Date('2026-11-09T05:00:00Z');
      expect(estaDisponible(medianoche, Date.parse('2026-11-09T04:59:59Z'))).toBe(false); // 23:59:59 Lima
      expect(estaDisponible(medianoche, Date.parse('2026-11-09T05:00:00Z'))).toBe(true); // 00:00 Lima
      expect(regresoAgotado(medianoche)).toBe('2026-11-09T05:00:00.000Z');
    });
  });

  describe('CatalogoService', () => {
    let prisma: any;
    let auditoria: any;
    let gateway: any;
    let service: CatalogoService;
    const usuario: any = { partyId: BigInt(7), rol: 'ADMIN' };

    beforeEach(() => {
      prisma = {
        producto: {
          findUnique: jest.fn().mockResolvedValue({ id: BigInt(1), nombre: 'Dona X', agotado_hasta: null, agotado_motivo: null }),
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockResolvedValue({}),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        sabor: { findMany: jest.fn().mockResolvedValue([]) },
        opcion: { findMany: jest.fn().mockResolvedValue([]) },
        agotado: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      };
      auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
      gateway = { emitirAdmin: jest.fn() };
      service = new CatalogoService(prisma, auditoria, gateway);
    });

    it('agotar indefinido: guarda 9999, motivo y emite el evento', async () => {
      const r = await service.agotarProducto(1, { motivo: '  se acabó la masa ' }, usuario);
      expect(r.agotadoHasta).toBe(AGOTADO_INDEFINIDO.toISOString());
      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: { agotado_hasta: AGOTADO_INDEFINIDO, agotado_origen: 'MANUAL', agotado_motivo: 'se acabó la masa' },
      });
      expect(auditoria.registrar).toHaveBeenCalledWith(
        expect.objectContaining({ accion: 'AGOTAR_PRODUCTO', despues: expect.objectContaining({ motivo: 'se acabó la masa' }) }),
      );
      expect(gateway.emitirAdmin).toHaveBeenCalledWith('carta:disponibilidad', expect.any(Object));
    });

    it('agotar temporal guarda la fecha de regreso', async () => {
      const hasta = new Date(Date.now() + 3_600_000).toISOString();
      const r = await service.agotarProducto(1, { agotadoHasta: hasta }, usuario);
      expect(r.agotadoHasta).toBe(hasta);
    });

    it('una hora de regreso pasada o inválida se rechaza', async () => {
      await expect(service.agotarProducto(1, { agotadoHasta: new Date(Date.now() - 1000).toISOString() }, usuario)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.agotarProducto(1, { agotadoHasta: 'mañana' }, usuario)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.producto.update).not.toHaveBeenCalled();
    });

    it('reactivar manual limpia fecha y motivo, audita y emite', async () => {
      await service.disponibilizarProducto(1, usuario);
      expect(prisma.producto.update).toHaveBeenCalledWith({
        where: { id: BigInt(1) },
        data: { agotado_hasta: null, agotado_origen: null, agotado_motivo: null },
      });
      expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'DISPONIBILIZAR_PRODUCTO' }));
      expect(gateway.emitirAdmin).toHaveBeenCalled();
    });

    describe('reactivarVencidos', () => {
      const ahora = new Date('2026-11-08T20:40:00Z');

      it('limpia los vencidos (inclusive el límite exacto), audita REACTIVADO_AUTOMATICO y emite una vez', async () => {
        prisma.producto.findMany
          .mockResolvedValueOnce([{ id: BigInt(1), agotado_hasta: ahora, agotado_motivo: 'x' }])
          .mockResolvedValue([]);
        expect(await service.reactivarVencidos(ahora)).toBe(1);
        expect(prisma.producto.findMany.mock.calls[0][0].where).toEqual({ agotado_hasta: { not: null, lte: ahora } });
        expect(prisma.producto.updateMany).toHaveBeenCalledWith({
          where: { id: BigInt(1), agotado_hasta: ahora },
          data: { agotado_hasta: null, agotado_origen: null, agotado_motivo: null },
        });
        expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'REACTIVADO_AUTOMATICO', entidadId: BigInt(1) }));
        expect(gateway.emitirAdmin).toHaveBeenCalledTimes(1);
      });

      it('idempotente: sin vencidos no audita ni emite; si otro ya lo reactivó (count 0) no se repite', async () => {
        expect(await service.reactivarVencidos(ahora)).toBe(0);
        prisma.producto.findMany.mockResolvedValueOnce([{ id: BigInt(2), agotado_hasta: ahora, agotado_motivo: null }]);
        prisma.producto.updateMany.mockResolvedValueOnce({ count: 0 });
        expect(await service.reactivarVencidos(ahora)).toBe(0);
        expect(auditoria.registrar).not.toHaveBeenCalled();
        expect(gateway.emitirAdmin).not.toHaveBeenCalled();
      });
    });
  });
});
