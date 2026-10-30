jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { NotificacionesService } from './notificaciones.service';

describe('NotificacionesService', () => {
  const hace = (min: number) => new Date(Date.now() - min * 60000);
  let prisma: any;
  let auditoria: any;
  let eventos: any;
  let service: NotificacionesService;

  beforeEach(() => {
    prisma = {
      parametro: { findUnique: jest.fn().mockResolvedValue({ valor: 'si' }) },
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
      solicitudReserva: { findMany: jest.fn().mockResolvedValue([{ creado_en: hace(30) }]) },
      insumo: { findMany: jest.fn().mockResolvedValue([]) },
      notificacion: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            tipo: 'STOCK_BAJO',
            titulo: 'Stock bajo',
            mensaje: 'Crema chantilly bajo el mínimo',
            enlace: null,
            leida_en: null,
            en: new Date('2026-10-15T20:55:00Z'),
          },
          {
            id: 2n,
            tipo: 'ERROR_IMPRESORA',
            titulo: 'Error de impresora',
            mensaje: 'La impresora de cocina no responde',
            enlace: null,
            leida_en: new Date('2026-10-15T21:00:00Z'),
            en: new Date('2026-10-15T19:40:00Z'),
          },
        ]),
        findUnique: jest.fn().mockResolvedValue({ id: 1n, leida_en: null }),
        update: jest.fn().mockResolvedValue({ id: 1n }),
        updateMany: jest.fn().mockResolvedValue({ count: 2 }),
        create: jest.fn().mockResolvedValue({ id: 3n, titulo: 'Mensaje de prueba' }),
      },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    eventos = { emitirAdmin: jest.fn() };
    service = new NotificacionesService(prisma, auditoria, eventos);
  });

  it('el administrador ve todo, con conteos y lo urgente primero', async () => {
    const r = await service.resumen({ partyId: 1n, rol: 'ADMIN', debeCambiar: false });
    expect(r.conteos).toEqual({ caja: 2, cocina: 2, repartos: 1, comprobantes: 3, reservas: 1, reclamos: 1 });
    expect(r.notificaciones[0].prioridad).toBe('ALTA');
    expect(r.notificaciones.map((n) => n.id)).toEqual(
      expect.arrayContaining(['por-cobrar', 'sin-ubicar', 'cocina-atrasados', 'repartos-listos', 'comprobantes', 'reservas', 'reclamos']),
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

  it('lista el historial con métricas y conteos dinámicos', async () => {
    // Setup for resumen inside historial
    prisma.pedido.findMany.mockReset().mockResolvedValue([]);
    prisma.comprobante.count.mockReset().mockResolvedValue(0);
    prisma.reclamo.findMany.mockReset().mockResolvedValue([]);

    const res = await service.historial({}, { partyId: 1n, rol: 'ADMIN', debeCambiar: false });
    expect(res.metricas).toBeDefined();
    expect(res.items.length).toBe(2);
    expect(res.conteosPorTipo).toHaveProperty('Stock bajo');
    expect(res.conteosPorEstado).toEqual({ todas: 2, nuevas: 1, leidas: 1 });
  });

  it('marca una notificación como leída o no leída', async () => {
    const r = await service.marcarLeida('1', true, { partyId: 1n, rol: 'ADMIN', debeCambiar: false });
    expect(r.ok).toBe(true);
    expect(prisma.notificacion.update).toHaveBeenCalled();
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('notificaciones:actualizada', { id: '1' });
  });

  it('marca todas las notificaciones como leídas', async () => {
    const r = await service.marcarTodasLeidas({ partyId: 1n, rol: 'ADMIN', debeCambiar: false });
    expect(r.ok).toBe(true);
    expect(prisma.notificacion.updateMany).toHaveBeenCalled();
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('notificaciones:actualizada', { todas: true });
  });

  it('incluye aviso de stock bajo cuando hay insumos bajo su mínimo', async () => {
    prisma.insumo.findMany.mockResolvedValue([
      {
        id: 10n,
        nombre: 'Harina',
        minimo: 10,
        stocks: [{ cantidad: 4 }],
      },
      {
        id: 11n,
        nombre: 'Azúcar',
        minimo: 5,
        stocks: [{ cantidad: 2 }],
      },
    ]);
    prisma.pedido.findMany.mockReset().mockResolvedValue([]);
    prisma.comprobante.count.mockReset().mockResolvedValue(0);
    prisma.reclamo.findMany.mockReset().mockResolvedValue([]);

    const r = await service.resumen({ partyId: 1n, rol: 'ADMIN', debeCambiar: false });
    expect(r.conteos.compras).toBe(2);
    const notifStock = r.notificaciones.find((n: any) => n.id === 'stock-bajo');
    expect(notifStock).toBeDefined();
    expect(notifStock?.titulo).toBe('2 insumos con stock bajo');
    expect(notifStock?.ruta).toBe('/admin/compras?tab=pedir');
  });

  it('con el control de almacén apagado no muestra el aviso de stock bajo', async () => {
    prisma.parametro.findUnique.mockResolvedValue(null);
    prisma.insumo.findMany.mockResolvedValue([{ id: 10n, nombre: 'Harina', minimo: 10, stocks: [{ cantidad: 0 }] }]);
    prisma.pedido.findMany.mockReset().mockResolvedValue([]);
    prisma.comprobante.count.mockReset().mockResolvedValue(0);
    prisma.reclamo.findMany.mockReset().mockResolvedValue([]);

    const r = await service.resumen({ partyId: 1n, rol: 'ADMIN', debeCambiar: false });

    expect(r.notificaciones.find((n: any) => n.id === 'stock-bajo')).toBeUndefined();
    expect(r.conteos.compras ?? 0).toBe(0);
    expect(prisma.insumo.findMany).not.toHaveBeenCalled();
  });

  it('crea un mensaje interno y lo audita', async () => {
    const r = await service.crearMensajeInterno(
      { titulo: 'Reunión de equipo', mensaje: 'Cierre a las 22:00' },
      { partyId: 1n, rol: 'ADMIN', debeCambiar: false },
    );
    expect(r.ok).toBe(true);
    expect(prisma.notificacion.create).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalled();
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('notificaciones:nueva', expect.any(Object));
  });
});
