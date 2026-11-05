import { ImpresionService } from './impresion.service';
import { estadoPorRol } from './estado-impresion';

jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

const latido = (impresoras: any[], hace = 1000) => ({
  ultimo_latido: new Date(Date.now() - hace),
  latido_impresora: 'lista',
  latido_detalle: JSON.stringify({ detalle: null, impresoras }),
});

describe('estadoPorRol', () => {
  it('sin latido: ambas no conectadas porque el programa del local no corre', () => {
    const e = estadoPorRol(null);
    expect(e.ETIQUETERA).toMatchObject({ conectada: false, motivo: 'El programa del local no está corriendo' });
    expect(e.TICKETERA.conectada).toBe(false);
  });

  it('latido viejo (más de 60 s) cuenta como programa apagado', () => {
    expect(estadoPorRol(latido([{ rol: 'ETIQUETERA', estado: 'lista' }], 120000)).ETIQUETERA.estado).toBe('sin_programa');
  });

  it('estado y motivo por rol', () => {
    const e = estadoPorRol(
      latido([
        { rol: 'ETIQUETERA', estado: 'lista' },
        { rol: 'TICKETERA', estado: 'desconectada' },
      ]),
    );
    expect(e.ETIQUETERA).toEqual({ conectada: true, estado: 'lista', motivo: null });
    expect(e.TICKETERA).toMatchObject({ conectada: false, motivo: 'Impresora no encontrada' });
  });

  it('una ticketera de red lista muestra su dirección como detalle', () => {
    const e = estadoPorRol(latido([{ rol: 'TICKETERA', estado: 'lista', detalle: 'Red 192.168.1.50:9100' }]));
    expect(e.TICKETERA).toEqual({ conectada: true, estado: 'lista', motivo: null, detalle: 'Red 192.168.1.50:9100' });
  });

  it('sin permiso y no encontrada traen el detalle del agente', () => {
    const e = estadoPorRol(
      latido([
        { rol: 'ETIQUETERA', estado: 'sin_permiso', detalle: 'Sin permiso para usar /dev/usb/lp0: ejecuta `sudo usermod -aG lp $USER` y reinicia el equipo' },
        { rol: 'TICKETERA', estado: 'desconectada', detalle: 'No encontrada (ruta /dev/usb/lp1)' },
      ]),
    );
    expect(e.ETIQUETERA).toMatchObject({ conectada: false, estado: 'sin_permiso' });
    expect(e.ETIQUETERA.motivo).toContain('sudo usermod -aG lp');
    expect(e.TICKETERA.motivo).toBe('No encontrada (ruta /dev/usb/lp1)');
  });

  it('rol ausente = no configurada; agente viejo solo habla de la etiquetera', () => {
    const e = estadoPorRol({ ultimo_latido: new Date(), latido_impresora: 'lista', latido_detalle: null });
    expect(e.ETIQUETERA.conectada).toBe(true);
    expect(e.TICKETERA.estado).toBe('no_configurada');
  });
});

describe('ImpresionService: ticket y vinculación', () => {
  let prisma: any;
  let service: ImpresionService;
  beforeEach(() => {
    prisma = {
      printJob: { upsert: jest.fn().mockResolvedValue({}), findMany: jest.fn().mockResolvedValue([]) },
      pedido: {
        findUnique: jest.fn().mockResolvedValue({
          id: 7n, codigo: 'PED-7', total: 20, modalidad: 'MESA', cliente_nombre: 'Ana',
          lineas: [{ cantidad: 2, nombre: 'Café', tamano: null, subtotal: 20, precio_unit: 10 }],
          planPago: [],
          cobros: [{ en: new Date(), anulado_en: null, pagos: [{ medio: 'EFECTIVO', monto: 20, recibido: 50, vuelto: 30 }] }],
        }),
      },
      parametro: { findUnique: jest.fn().mockResolvedValue({ valor: { nombre: 'Caprichos', ruc: '2060' } }) },
      comprobante: { findFirst: jest.fn().mockResolvedValue({ tipo: 'NOTA_VENTA', numero_texto: 'N001-1' }) },
      deviceKey: {
        findFirst: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn().mockResolvedValue({ id: 1n }),
        deleteMany: jest.fn(),
      },
    };
    service = new ImpresionService(prisma);
  });

  it('encola el ticket con clave pedido+tipo (idempotente al reintentar)', async () => {
    await service.encolarTicketPedido(7n);
    await service.encolarTicketPedido(7n);
    const llamadas = prisma.printJob.upsert.mock.calls;
    expect(llamadas).toHaveLength(2);
    for (const [arg] of llamadas) {
      expect(arg.where).toEqual({ clave_idempotencia: '7-TICKET_PAGO' });
      expect(arg.create.tipo).toBe('TICKET_PAGO');
      expect(arg.update).toEqual({});
      expect(arg.create.payload.pagos[0]).toMatchObject({ medio: 'EFECTIVO', vuelto: 30 });
      expect(arg.create.payload.comprobante.numero).toBe('N001-1');
    }
  });

  it('el latido con ambas máquinas guarda la lista en latido_detalle', async () => {
    prisma.deviceKey.update.mockResolvedValue({});
    await service.registrarLatido(
      { version: '1', impresora: 'lista', impresoras: [{ rol: 'TICKETERA', estado: 'sin_papel' }] } as any,
      2n,
    );
    const data = prisma.deviceKey.update.mock.calls[0][0].data;
    expect(JSON.parse(data.latido_detalle).impresoras[0]).toMatchObject({ rol: 'TICKETERA', estado: 'sin_papel' });
  });

  it('el código de vinculación es de un solo uso y vence', async () => {
    const { codigo } = await service.generarCodigoVinculoAgente('demo.caprichos.pe');
    expect(codigo).toMatch(/^[A-Z2-9]{8}@demo\.caprichos\.pe$/);
    prisma.deviceKey.findFirst.mockResolvedValue({ id: 1n, codigo_expira_en: new Date(Date.now() - 1000) });
    await expect(service.vincularAgente(codigo)).rejects.toMatchObject({ response: { codigo: 'CODIGO_INVALIDO' } });
    prisma.deviceKey.findFirst.mockResolvedValue({ id: 1n, codigo_expira_en: new Date(Date.now() + 60000) });
    prisma.deviceKey.update.mockResolvedValue({});
    const { llave } = await service.vincularAgente(codigo);
    expect(llave).toMatch(/^agk_/);
    expect(prisma.deviceKey.update.mock.calls[0][0].data).toMatchObject({ activo: true, codigo_vinculo: null });
  });
});
