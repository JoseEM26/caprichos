import { NotificacionesService } from './notificaciones.service';

describe('NotificacionesService', () => {
  const hace = (min: number) => new Date(Date.now() - min * 60000);
  let prisma: any;
  let service: NotificacionesService;

  beforeEach(() => {
    prisma = {
      rolPermiso: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([{ creado_en: hace(30) }, { creado_en: hace(5) }]) // por cobrar
          .mockResolvedValueOnce([{ creado_en: hace(10) }]) // sin ubicar
          .mockResolvedValueOnce([{ creado_en: hace(20) }, { creado_en: hace(2) }]) // en cocina
          .mockResolvedValueOnce([{ creado_en: hace(40), entrega_lat: 1 }]), // listos
      },
      comprobante: { count: jest.fn().mockResolvedValue(3) },
      reclamo: { findMany: jest.fn().mockResolvedValue([{ creado_en: hace(60) }]) },
    };
    service = new NotificacionesService(prisma);
  });

  it('el administrador ve todo, con conteos y lo urgente primero', async () => {
    const r = await service.resumen({ partyId: 1n, rol: 'ADMIN', debeCambiar: false });
    expect(r.conteos).toEqual({ caja: 2, cocina: 2, repartos: 1, comprobantes: 3, reclamos: 1 });
    expect(r.notificaciones[0].prioridad).toBe('ALTA');
    expect(r.notificaciones.map((n) => n.id)).toEqual(
      expect.arrayContaining(['por-cobrar', 'sin-ubicar', 'cocina-atrasados', 'repartos-listos', 'comprobantes', 'reclamos']),
    );
    const prioridades = r.notificaciones.map((n) => n.prioridad);
    expect(prioridades).toEqual([...prioridades].sort((a, b) => ['ALTA', 'MEDIA', 'BAJA'].indexOf(a) - ['ALTA', 'MEDIA', 'BAJA'].indexOf(b)));
  });

  it('un rol sin permisos no recibe nada', async () => {
    const r = await service.resumen({ partyId: 2n, rol: 'MOZO', debeCambiar: false });
    expect(r).toEqual({ conteos: {}, notificaciones: [] });
    expect(prisma.pedido.findMany).not.toHaveBeenCalled();
  });

  it('un cajero solo ve caja', async () => {
    prisma.rolPermiso.findMany.mockResolvedValue([{ permiso: { modulo: 'caja', accion: 'ver' } }]);
    prisma.pedido.findMany.mockReset().mockResolvedValue([]);
    const r = await service.resumen({ partyId: 3n, rol: 'CAJERO', debeCambiar: false });
    expect(Object.keys(r.conteos)).toEqual(['caja']);
  });
});
