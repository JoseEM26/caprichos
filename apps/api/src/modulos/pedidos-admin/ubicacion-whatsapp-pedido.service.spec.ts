jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ConflictException } from '@nestjs/common';
import { UbicacionWhatsappPedidoService } from './ubicacion-whatsapp-pedido.service';
import { textoPedirUbicacion, textoUbicacionAsignada, distanciaMetros } from './ubicacion-whatsapp.util';

const pedido = (id: bigint, codigo: string, extra: Record<string, unknown> = {}) => ({
  id, codigo, cliente_telefono: '987654321', cliente_party_id: null, entrega_lat: null, entrega_lng: null, zona_id: null, ...extra,
});

describe('UbicacionWhatsappPedidoService', () => {
  let prisma: any, cambio: any, ventana: any, auditoria: any, eventos: any, svc: UbicacionWhatsappPedidoService;

  beforeEach(() => {
    prisma = {
      pedido: { findMany: jest.fn(), findUnique: jest.fn() },
      pedidoCambioUbicacion: { update: jest.fn().mockResolvedValue({}), updateMany: jest.fn(), create: jest.fn() },
      notificacion: { create: jest.fn().mockResolvedValue({ id: 1n }) },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    cambio = {
      aplicarCambio: jest.fn().mockResolvedValue({ cambioId: '7', envioNuevo: 5, totalNuevo: 32, ajuste: null }),
      calcular: jest.fn().mockResolvedValue({ zona: { zonaId: 2n, codigo: 'Z1' }, envioNuevo: 6, totalNuevo: 33, diferencia: 1 }),
      parseId: (x: string) => BigInt(x),
      pedidoEditable: jest.fn(),
    };
    ventana = { esVentanaAbierta: jest.fn().mockResolvedValue(true), enviarMensajeNegocio: jest.fn().mockResolvedValue({ exito: true }) };
    auditoria = { registrar: jest.fn() };
    eventos = { emitirAdmin: jest.fn() };
    svc = new UbicacionWhatsappPedidoService(prisma, cambio, ventana, auditoria, eventos);
  });

  const punto = { telefono: '51987654321', lat: -12.05, lng: -77.04 };

  it('sin pedido delivery activo: no la atiende (el bot sigue su camino)', async () => {
    prisma.pedido.findMany.mockResolvedValue([]);
    expect(await svc.recibir(punto)).toEqual({ atendida: false });
    expect(cambio.aplicarCambio).not.toHaveBeenCalled();
  });

  it('se asigna al pedido más reciente sin ubicación, recalcula por el flujo de cambio y avisa al cliente con los otros pedidos', async () => {
    prisma.pedido.findMany.mockResolvedValue([pedido(2n, 'CP-W032'), pedido(1n, 'CP-W031')]);
    expect(await svc.recibir(punto)).toEqual({ atendida: true });
    expect(cambio.aplicarCambio).toHaveBeenCalledWith(
      2n,
      { lat: -12.05, lng: -77.04 },
      expect.objectContaining({ origen: 'WHATSAPP_CLIENTE', usuario: null, omitirAvisoCliente: true }),
    );
    const texto = ventana.enviarMensajeNegocio.mock.calls[0][1].textoLibre as string;
    expect(texto).toContain('CP-W032');
    expect(texto).toContain('S/ 5.00');
    expect(texto).toContain('CP-W031');
    expect(prisma.pedidoCambioUbicacion.update).toHaveBeenCalledWith({ where: { id: 7n }, data: { aviso_cliente: 'ENVIADO' } });
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('ubicacion:propuesta', expect.objectContaining({ estado: 'APROBADA' }));
  });

  it('pedido que ya tiene ubicación: queda como propuesta de WHATSAPP_CLIENTE, no lo reemplaza', async () => {
    prisma.pedido.findMany.mockResolvedValue([pedido(3n, 'CP-W033', { entrega_lat: -12.1, entrega_lng: -77.1, zona_id: 1n })]);
    prisma.pedido.findUnique.mockResolvedValue({ id: 3n, entrega_lat: -12.1, entrega_lng: -77.1, zona_id: 1n, envio: 4, total: 31 });
    await svc.recibir(punto);
    expect(cambio.aplicarCambio).not.toHaveBeenCalled();
    expect(prisma.pedidoCambioUbicacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ origen: 'WHATSAPP_CLIENTE', estado: 'PROPUESTA', fuera_de_zona: false, envio_nuevo: 6, zona_nueva_id: 2n }),
    });
    expect(prisma.notificacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ titulo: expect.stringContaining('otra ubicación') }) });
    // El aviso al equipo lleva el Código Plus del punto que mandó el cliente
    expect(prisma.notificacion.create.mock.calls[0][0].data.mensaje).toMatch(/Código Plus: [2-9CFGHJMPQRVWX]{4}\+[2-9CFGHJMPQRVWX]{2} Lima/);
    expect(ventana.enviarMensajeNegocio.mock.calls[0][1].textoLibre).toContain('Caja la revisará');
  });

  it('misma ubicación que la guardada: no crea propuesta', async () => {
    prisma.pedido.findMany.mockResolvedValue([pedido(3n, 'CP-W033', { entrega_lat: -12.05, entrega_lng: -77.04, zona_id: 1n })]);
    await svc.recibir(punto);
    expect(prisma.pedidoCambioUbicacion.create).not.toHaveBeenCalled();
    expect(ventana.enviarMensajeNegocio.mock.calls[0][1].textoLibre).toContain('la misma');
  });

  it('fuera de zona: no asigna, deja propuesta marcada, avisa a Caja y al cliente', async () => {
    prisma.pedido.findMany.mockResolvedValue([pedido(2n, 'CP-W032')]);
    cambio.aplicarCambio.mockRejectedValue(new ConflictException({ codigo: 'FUERA_DE_COBERTURA', mensaje: 'fuera' }));
    prisma.pedido.findUnique.mockResolvedValue({ id: 2n, entrega_lat: null, entrega_lng: null, zona_id: null, envio: null, total: 27 });
    cambio.calcular.mockRejectedValue(new ConflictException({ codigo: 'FUERA_DE_COBERTURA' }));
    expect(await svc.recibir(punto)).toEqual({ atendida: true });
    expect(prisma.pedidoCambioUbicacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ fuera_de_zona: true, zona_nueva_id: null, envio_nuevo: null }),
    });
    expect(prisma.notificacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ titulo: expect.stringContaining('fuera de zona') }) });
    expect(ventana.enviarMensajeNegocio.mock.calls[0][1].textoLibre).toContain('fuera de nuestra zona');
  });

  it('pedirUbicacion: con la ventana cerrada responde 409 VENTANA_CERRADA y no envía', async () => {
    cambio.pedidoEditable.mockResolvedValue({ codigo: 'CP-W031', cliente_telefono: '987654321' });
    ventana.esVentanaAbierta.mockResolvedValue(false);
    await expect(svc.pedirUbicacion('1', { partyId: 1 } as any)).rejects.toMatchObject({ response: { codigo: 'VENTANA_CERRADA' } });
    expect(ventana.enviarMensajeNegocio).not.toHaveBeenCalled();
  });

  it('pedirUbicacion: con ventana abierta reenvía el pedido de ubicación y audita', async () => {
    cambio.pedidoEditable.mockResolvedValue({ codigo: 'CP-W031', cliente_telefono: '987654321' });
    await expect(svc.pedirUbicacion('1', { partyId: 1 } as any)).resolves.toEqual({ enviado: true });
    expect(ventana.enviarMensajeNegocio.mock.calls[0][1].textoLibre).toBe(textoPedirUbicacion('CP-W031'));
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'PEDIR_UBICACION_WHATSAPP' }));
  });
});

describe('textos de la ubicación por WhatsApp', () => {
  it('pedido de ubicación trae el paso a paso del clip', () => {
    expect(textoPedirUbicacion('CP-W031')).toContain('toca el clip 📎 → Ubicación → Enviar tu ubicación actual');
  });
  it('ajuste de un pedido ya pagado', () => {
    expect(textoUbicacionAsignada({ codigo: 'CP-1', envioNuevo: 6, totalNuevo: 33, ajuste: { tipo: 'SALDO', monto: 6 }, otros: [] })).toContain('se ajusta S/ 6.00');
  });
  it('distancia', () => {
    expect(distanciaMetros({ lat: 0, lng: 0 }, { lat: 0, lng: 0.001 })).toBeGreaterThan(100);
  });
});
