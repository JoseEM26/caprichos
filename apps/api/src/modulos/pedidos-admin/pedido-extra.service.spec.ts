jest.mock('../impresion/impresion.service', () => ({ ImpresionService: class {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../pedidos/pedidos.service', () => ({ PedidosService: class {} }));

import { ConflictException, NotFoundException } from '@nestjs/common';
import { PedidoExtraService } from './pedido-extra.service';
import { resumenExtras } from './extras-pedido.util';

const dto: any = { lineas: [{ productoId: 1, cantidad: 1 }], pago: { metodo: 'YAPE' }, comprobante: { tipo: 'BOLETA', dni: '12345678' } };
const cajero: any = { partyId: 9n, rol: 'CAJERO' };
const mozo: any = { partyId: 8n, rol: 'MOZO' };

function original(over: any = {}) {
  return {
    id: 100n, codigo: 'CP-W045', estado: 'ENTREGADO', modalidad: 'DELIVERY', mesa_nombre: null,
    cliente_nombre: 'Ana', cliente_telefono: '987654321', cliente_party_id: 5n, pedido_origen_id: null,
    entrega_direccion: 'Av. Lima 123', entrega_referencia: 'portón', entrega_lat: -12.04, entrega_lng: -77.03,
    ...over,
  };
}

describe('PedidoExtraService', () => {
  let prisma: any, pedidos: any, auditoria: any, impresion: any, eventos: any, servicio: PedidoExtraService;

  beforeEach(() => {
    prisma = { pedido: { findUnique: jest.fn().mockResolvedValue(original()) } };
    pedidos = { crear: jest.fn().mockResolvedValue({ id: '200', codigo: 'CP-W046', estado: 'COLA', total: 12, envio: 0 }) };
    auditoria = { registrar: jest.fn() };
    impresion = { encolarEtiquetasPedido: jest.fn() };
    eventos = { emitirAdmin: jest.fn() };
    servicio = new PedidoExtraService(prisma, pedidos, auditoria, impresion, eventos);
  });

  it('hereda cliente, modalidad y dirección; crea con origen, canal CAJA y su propio pago y comprobante', async () => {
    const res = await servicio.crearExtra('100', dto, cajero, 'k1');
    const [crearDto, clave, origen] = pedidos.crear.mock.calls[0];
    expect(clave).toBe('k1');
    expect(crearDto).toMatchObject({
      cliente: { nombre: 'Ana', telefono: '987654321' },
      modalidad: 'DELIVERY',
      clienteTelefono: '987654321',
      entrega: { direccion: 'Av. Lima 123', referencia: 'portón', lat: -12.04, lng: -77.03 },
      pago: { metodo: 'YAPE' },
      comprobante: { tipo: 'BOLETA', dni: '12345678' },
    });
    expect(origen).toMatchObject({ canal: 'CAJA', pedidoOrigenId: 100n, usuarioPartyId: 9n });
    expect(res).toMatchObject({ codigo: 'CP-W046', pedidoOrigenCodigo: 'CP-W045' });
    expect(impresion.encolarEtiquetasPedido).toHaveBeenCalledWith('200');
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('pedido:extra', expect.objectContaining({ id: '100', extraId: '200' }));
  });

  it('mesa: hereda la mesa y no manda dirección; el mozo crea con canal MOZO', async () => {
    prisma.pedido.findUnique.mockResolvedValue(original({ modalidad: 'MESA', mesa_nombre: 'Mesa 3', cliente_telefono: null, entrega_direccion: null }));
    await servicio.crearExtra('100', dto, mozo);
    const [crearDto, , origen] = pedidos.crear.mock.calls[0];
    expect(crearDto).toMatchObject({ modalidad: 'MESA', mesa: 'Mesa 3', entrega: undefined, clientePartyId: '5' });
    expect(origen).toMatchObject({ canal: 'MOZO', mesaNombre: 'Mesa 3' });
  });

  it('audita AGREGAR_EXTRA sobre el original', async () => {
    await servicio.crearExtra('100', dto, cajero, undefined, '1.2.3.4');
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: 'pedidos', accion: 'AGREGAR_EXTRA', entidadId: 100n, partyId: 9n, ip: '1.2.3.4' }),
    );
  });

  it.each(['ANULADO', 'RECHAZADO'])('rechaza si el original está %s y no crea nada', async (estado) => {
    prisma.pedido.findUnique.mockResolvedValue(original({ estado }));
    await expect(servicio.crearExtra('100', dto, cajero)).rejects.toBeInstanceOf(ConflictException);
    expect(pedidos.crear).not.toHaveBeenCalled();
    expect(auditoria.registrar).not.toHaveBeenCalled();
  });

  it('un pedido pagado y entregado sí admite extra', async () => {
    prisma.pedido.findUnique.mockResolvedValue(original({ estado: 'ENTREGADO', pago_estado: 'PAGADO' }));
    await expect(servicio.crearExtra('100', dto, cajero)).resolves.toBeDefined();
  });

  it('pedido inexistente: 404', async () => {
    prisma.pedido.findUnique.mockResolvedValue(null);
    await expect(servicio.crearExtra('100', dto, cajero)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('un extra de un extra se enlaza al pedido raíz', async () => {
    prisma.pedido.findUnique
      .mockResolvedValueOnce(original({ id: 200n, codigo: 'CP-W046', pedido_origen_id: 100n }))
      .mockResolvedValueOnce(original());
    await servicio.crearExtra('200', dto, cajero);
    expect(pedidos.crear.mock.calls[0][2]).toMatchObject({ pedidoOrigenId: 100n });
  });
});

describe('resumenExtras', () => {
  it('suma solo los extras vigentes al total con extras', () => {
    const r = resumenExtras({
      total: 50,
      extras: [
        { id: 2n, codigo: 'CP-W2', estado: 'COLA', pago_estado: 'PENDIENTE', total: 10 },
        { id: 3n, codigo: 'CP-W3', estado: 'ANULADO', pago_estado: 'PENDIENTE', total: 99 },
      ],
    });
    expect(r.total_con_extras).toBe(60);
    expect(r.extras).toHaveLength(2);
  });
  it('sin extras no hay total con extras; un extra apunta a su original', () => {
    expect(resumenExtras({ total: 50, extras: [] }).total_con_extras).toBeNull();
    expect(resumenExtras({ total: 5, pedidoOrigen: { id: 1n, codigo: 'CP-W1' }, extras: [] }).pedido_origen).toEqual({ id: '1', codigo: 'CP-W1' });
  });
});
