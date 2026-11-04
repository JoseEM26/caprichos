jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ConflictException, NotFoundException } from '@nestjs/common';
import { UbicarPedidoService } from './ubicar-pedido.service';

describe('UbicarPedidoService', () => {
  const usuario: any = { partyId: 2n, rol: 'CAJERO' };
  let prisma: any;
  let zonas: any;
  let auditoria: any;
  let gateway: any;
  let service: UbicarPedidoService;

  const pedido = (extra: any = {}) => ({
    id: 7n,
    codigo: 'CP-W007',
    modalidad: 'DELIVERY',
    estado: 'PREPARANDO',
    subtotal: 40,
    descuento: 0,
    envio: null,
    total: 40,
    pago_estado: 'PENDIENTE',
    entrega_lat: null,
    entrega_lng: null,
    ...extra,
  });

  beforeEach(() => {
    prisma = {
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido()), update: jest.fn().mockResolvedValue({ id: 7n, codigo: 'CP-W007' }) },
      parametro: { findUnique: jest.fn().mockResolvedValue({ valor: 70 }) },
      oferta: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(prisma)),
    };
    zonas = { detectar: jest.fn().mockResolvedValue({ zonaId: 3n, codigo: 'Z3', tarifa: 6 }) };
    auditoria = { registrar: jest.fn() };
    gateway = { emitirAdmin: jest.fn() };
    service = new UbicarPedidoService(prisma, zonas, auditoria, gateway);
  });

  it('fija el punto, la zona y recalcula envío y total', async () => {
    const r = await service.ubicar('7', { lat: -12.05, lng: -76.97, direccion: ' Av. Brasil 1234 ' }, usuario);
    expect(r).toMatchObject({ zona: 'Z3', envio: 6, total: 46 });
    const data = prisma.pedido.update.mock.calls[0][0].data;
    expect(data).toMatchObject({ zona_id: 3n, entrega_origen: 'MAPA', entrega_direccion: 'Av. Brasil 1234' });
    expect(Number(data.total)).toBe(46);
    expect(auditoria.registrar).toHaveBeenCalledWith(expect.objectContaining({ accion: 'UBICAR_PEDIDO' }));
    expect(gateway.emitirAdmin).toHaveBeenCalledWith('pedido:estado', expect.objectContaining({ codigo: 'CP-W007' }));
  });

  it('envío gratis si el subtotal supera el mínimo', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ subtotal: 80, total: 80 }));
    const r = await service.ubicar('7', { lat: -12.05, lng: -76.97 }, usuario);
    expect(r).toMatchObject({ envio: 0, total: 80 });
  });

  it('modo desde: el subtotal exacto ya es gratis; mas_de no', async () => {
    prisma.parametro.findUnique.mockImplementation(({ where }: any) =>
      Promise.resolve(
        where.clave === 'envio_gratis_monto'
          ? { valor: 70 }
          : where.clave === 'envio_gratis_modo'
            ? { valor: 'desde' }
            : null,
      ),
    );
    prisma.pedido.findUnique.mockResolvedValue(pedido({ subtotal: 70, total: 70 }));
    await expect(service.ubicar('7', { lat: -12.05, lng: -76.97 }, usuario)).resolves.toMatchObject({ envio: 0, total: 70 });

    prisma.parametro.findUnique.mockResolvedValue({ valor: 70 });
    prisma.pedido.findUnique.mockResolvedValue(pedido({ subtotal: 70, total: 70 }));
    await expect(service.ubicar('7', { lat: -12.05, lng: -76.97 }, usuario)).resolves.toMatchObject({ envio: 6, total: 76 });
  });

  it('fuera de cobertura no guarda nada', async () => {
    zonas.detectar.mockResolvedValue(null);
    await expect(service.ubicar('7', { lat: 0, lng: 0 }, usuario)).rejects.toMatchObject({ response: { codigo: 'FUERA_DE_COBERTURA' } });
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('rechaza pedidos que no son delivery, cerrados o ya pagados con otro total', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ modalidad: 'RECOGER' }));
    await expect(service.ubicar('7', { lat: 1, lng: 1 }, usuario)).rejects.toMatchObject({ response: { codigo: 'NO_ES_DELIVERY' } });
    prisma.pedido.findUnique.mockResolvedValue(pedido({ estado: 'ENTREGADO' }));
    await expect(service.ubicar('7', { lat: 1, lng: 1 }, usuario)).rejects.toBeInstanceOf(ConflictException);
    prisma.pedido.findUnique.mockResolvedValue(pedido({ pago_estado: 'PAGADO' }));
    await expect(service.ubicar('7', { lat: 1, lng: 1 }, usuario)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_PAGADO' } });
  });

  it('pedido inexistente', async () => {
    prisma.pedido.findUnique.mockResolvedValue(null);
    await expect(service.ubicar('7', { lat: 1, lng: 1 }, usuario)).rejects.toBeInstanceOf(NotFoundException);
  });
});
