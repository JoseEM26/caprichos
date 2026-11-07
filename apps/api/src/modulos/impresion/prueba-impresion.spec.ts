import { HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ImpresionService } from './impresion.service';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

describe('pruebas de impresión', () => {
  let service: ImpresionService;
  let prisma: any;
  let auditoria: any;
  const usuario = { partyId: 7n, rol: 'CAJERO', debeCambiar: false, roles: ['CAJERO'] };

  beforeEach(() => {
    prisma = {
      printJob: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(async ({ data }) => ({ id: 42n, ...data })),
        findMany: jest.fn().mockResolvedValue([]),
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      parametro: { findUnique: jest.fn().mockResolvedValue({ valor: { nombre: 'Caprichos' } }) },
      party: { findUnique: jest.fn().mockResolvedValue({ persona: { nombres: 'Ana Maria' } }) },
      pedido: { findUnique: jest.fn() },
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    service = new ImpresionService(prisma, auditoria);
  });

  it('encola una etiqueta de prueba sin pedido, con formato de etiqueta general', async () => {
    const res = await service.encolarPrueba('ETIQUETERA', usuario as any);
    const data = prisma.printJob.create.mock.calls[0][0].data;
    expect(data.pedido_id).toBeNull();
    expect(data.tipo).toBe('ETIQUETA_GENERAL');
    expect(data.estado).toBe('PENDIENTE');
    expect(data.copia).toBe(false);
    expect(data.payload.codigo).toBe('PRUEBA');
    expect(data.payload.who).toBe('Ana');
    expect(data.payload.nota).toContain('PRUEBA - no es un pedido');
    expect(prisma.pedido.findUnique).not.toHaveBeenCalled();
    expect(res.trabajoId).toBe('42');
  });

  it('encola un ticket de prueba con líneas y pago marcados SIN VALOR', async () => {
    await service.encolarPrueba('TICKETERA', usuario as any);
    const data = prisma.printJob.create.mock.calls[0][0].data;
    expect(data.tipo).toBe('TICKET_PAGO');
    expect(data.pedido_id).toBeNull();
    expect(data.payload.total).toBe(0);
    expect(data.payload.pagos).toEqual([{ medio: 'SIN VALOR', monto: 0 }]);
    expect(data.payload.lineas.every((l: any) => l.nombre.includes('SIN VALOR'))).toBe(true);
    expect(data.payload.comprobante).toBeUndefined();
  });

  it('limita a una prueba cada 10 s por máquina (solo mira los trabajos de esa máquina)', async () => {
    prisma.printJob.findFirst.mockResolvedValueOnce({ id: 1n });
    await expect(service.encolarPrueba('TICKETERA', usuario as any)).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
    expect(prisma.printJob.create).not.toHaveBeenCalled();
    const filtro = prisma.printJob.findFirst.mock.calls[0][0].where;
    expect(filtro.pedido_id).toBeNull();
    expect(filtro.tipo).toEqual({ in: ['TICKET_PAGO', 'TICKET_COMANDA_SALON', 'TICKET_COMANDA_AREA'] });
    expect(filtro.en.gt).toBeInstanceOf(Date);
  });

  it('audita IMPRESION_PRUEBA solo con el rol, sin datos personales', async () => {
    await service.encolarPrueba('ETIQUETERA', usuario as any, '10.0.0.1');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'IMPRESION_PRUEBA',
        modulo: 'impresion',
        partyId: 7n,
        despues: { rol: 'ETIQUETERA' },
        ip: '10.0.0.1',
      }),
    );
  });

  it('obtenerPrueba devuelve el estado y solo para trabajos sin pedido', async () => {
    prisma.printJob.findFirst.mockResolvedValueOnce({
      id: 42n, tipo: 'TICKET_PAGO', estado: 'FALLIDO', intentos: 5, error: 'Sin papel',
    });
    await expect(service.obtenerPrueba('42')).resolves.toEqual({
      id: '42', rol: 'TICKETERA', estado: 'FALLIDO', intentos: 5, error: 'Sin papel',
    });
    expect(prisma.printJob.findFirst.mock.calls[0][0].where.pedido_id).toBeNull();

    prisma.printJob.findFirst.mockResolvedValueOnce(null);
    await expect(service.obtenerPrueba('99')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('la cola muestra cada prueba como grupo propio marcado como prueba', async () => {
    const en = new Date('2026-11-02T12:00:00Z');
    prisma.printJob.findMany.mockResolvedValueOnce([
      { id: 5n, pedido_id: null, estado: 'PENDIENTE', en, error: null, pedido: null },
      { id: 4n, pedido_id: 9n, estado: 'PENDIENTE', en, error: null, pedido: { codigo: 'PED-9', cliente_nombre: 'Luis' } },
    ]);
    const res = await service.listarCola('pendientes', 1, 20, 30);
    const prueba = res.items.find((g: any) => g.esPrueba);
    const pedido = res.items.find((g: any) => !g.esPrueba);
    expect(prueba).toMatchObject({ pedidoId: null, trabajoIds: ['5'], pedidoCodigo: 'PRUEBA' });
    expect(pedido).toMatchObject({ pedidoId: '9', esPrueba: false, pedidoCodigo: 'PED-9' });
  });
});
