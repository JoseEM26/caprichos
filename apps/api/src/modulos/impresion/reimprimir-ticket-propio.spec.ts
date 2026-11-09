jest.mock('@nestjs/jwt', () => ({ JwtService: jest.fn(), JwtModule: {} }));
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import 'reflect-metadata';
import { ImpresionService } from './impresion.service';
import { PedidosAdminController } from '../pedidos-admin/pedidos-admin.controller';
import { CLAVE_PERMISO } from '../acceso/permiso.decorator';
import { MATRIZ } from '../acceso/permisos';

describe('reimprimirTicketPagoPropio', () => {
  const llamar = (usuario: any, partyPedido: bigint | null) => {
    const reimprimirPedido = jest.fn().mockResolvedValue({ ok: true });
    const ctx = { prisma: { pedido: { findUnique: jest.fn().mockResolvedValue({ party_id: partyPedido }) } }, reimprimirPedido };
    return {
      reimprimirPedido,
      promesa: ImpresionService.prototype.reimprimirTicketPagoPropio.call(ctx, '5', usuario, '1.1.1.1'),
    };
  };

  it('el mozo reimprime un pedido suyo (tipo ticket_pago)', async () => {
    const { promesa, reimprimirPedido } = llamar({ partyId: 7n, rol: 'MOZO' }, 7n);
    await promesa;
    expect(reimprimirPedido).toHaveBeenCalledWith('5', { tipo: 'ticket_pago' }, expect.anything(), '1.1.1.1');
  });

  it('el mozo no reimprime uno ajeno', async () => {
    const { promesa, reimprimirPedido } = llamar({ partyId: 7n, rol: 'MOZO' }, 8n);
    await expect(promesa).rejects.toMatchObject({ response: { codigo: 'PEDIDO_AJENO' } });
    expect(reimprimirPedido).not.toHaveBeenCalled();
  });

  it('admin y supervisor reimprimen cualquiera', async () => {
    for (const rol of ['ADMIN', 'SUPERVISOR', 'CAJERO']) {
      const { promesa } = llamar({ partyId: 1n, rol }, 8n);
      await expect(promesa).resolves.toEqual({ ok: true });
    }
  });

  it('la ruta pide pedidos/reimprimir_ticket y la tienen ADMIN, SUPERVISOR, CAJERO y MOZO (no cocina)', () => {
    expect(Reflect.getMetadata(CLAVE_PERMISO, PedidosAdminController.prototype.reimprimirTicketPago)).toEqual({
      modulo: 'pedidos',
      accion: 'reimprimir_ticket',
    });
    for (const r of ['ADMIN', 'SUPERVISOR', 'CAJERO', 'MOZO']) expect(MATRIZ[r]).toContain('pedidos/reimprimir_ticket');
    for (const r of ['COCINA', 'ALMACEN', 'REPARTIDOR']) expect(MATRIZ[r]).not.toContain('pedidos/reimprimir_ticket');
  });
});
