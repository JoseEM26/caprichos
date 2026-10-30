jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { VouchersService } from '../vouchers.service';
import { PagoPlanService } from '../../pedidos/pago-plan.service';
import { pedidoAceptaVoucher, mismoCliente } from '../voucher-reasignacion.util';

const TEL = '977000111';

function pedido(id: number, extra: Record<string, unknown> = {}) {
  return {
    id: BigInt(id),
    codigo: `CP-${id}`,
    estado: 'PENDIENTE',
    total: 20,
    pago_estado: 'PENDIENTE',
    pago_preferido: 'YAPE',
    pago_metodo: 'YAPE',
    es_personal: false,
    cliente_telefono: `51${TEL}`,
    party_id: null,
    creado_en: new Date(),
    ...extra,
  };
}

function construir(opts: {
  voucher?: Record<string, unknown> | null;
  pedidos?: any[];
  conversacion?: Record<string, unknown> | null;
}) {
  const pedidos = opts.pedidos ?? [];
  const voucher = opts.voucher === undefined ? { id: 5n, pedido_id: 1n, conversacion_id: 10n, archivo_id: 2n } : opts.voucher;
  const conv = opts.conversacion === undefined ? { id: 10n, telefono: `51${TEL}`, flujo: { pago: { pedidoId: '1', pedidoCodigo: 'CP-1' } } } : opts.conversacion;
  const prisma: any = {
    voucherPago: {
      findUnique: jest.fn(async () => voucher),
      update: jest.fn(async ({ data }: any) => ({ ...voucher, ...data })),
    },
    pedido: {
      findUnique: jest.fn(async ({ where }: any) => pedidos.find((p) => p.id === where.id) ?? null),
      findMany: jest.fn(async ({ where }: any) =>
        pedidos.filter((p) => !(where?.id?.not !== undefined && p.id === where.id.not)),
      ),
    },
    conversacion: {
      findUnique: jest.fn(async () => conv),
      update: jest.fn(async () => ({})),
    },
    $transaction: jest.fn(async (fn: any) => fn(prisma)),
  };
  const auditoria: any = { registrar: jest.fn(async () => undefined) };
  const eventos: any = { emitirAdmin: jest.fn() };
  const servicio = new VouchersService(prisma, {} as any, auditoria, {} as any, new PagoPlanService(), eventos);
  return { servicio, prisma, auditoria, eventos };
}

const usuario = { partyId: 77n } as any;

describe('Reglas de reasignación (utilidades)', () => {
  it('solo acepta un pedido digital, pendiente, no cerrado y no personal', () => {
    expect(pedidoAceptaVoucher(pedido(2))).toBe(true);
    expect(pedidoAceptaVoucher(pedido(2, { pago_preferido: 'EFECTIVO', pago_metodo: 'EFECTIVO' }))).toBe(false);
    expect(pedidoAceptaVoucher(pedido(2, { pago_estado: 'COORDINADO' }))).toBe(false);
    expect(pedidoAceptaVoucher(pedido(2, { estado: 'ANULADO' }))).toBe(false);
    expect(pedidoAceptaVoucher(pedido(2, { es_personal: true }))).toBe(false);
  });

  it('compara clientes por los últimos 9 dígitos', () => {
    expect(mismoCliente(`51${TEL}`, TEL)).toBe(true);
    expect(mismoCliente('999888777', TEL)).toBe(false);
    expect(mismoCliente(null, TEL)).toBe(false);
  });
});

describe('VouchersService.reasignar', () => {
  it('mueve el voucher al pedido del mismo cliente, actualiza la conversación y audita', async () => {
    const origen = pedido(1);
    const destino = pedido(2, { codigo: 'CP-2' });
    const { servicio, prisma, auditoria, eventos } = construir({ pedidos: [origen, destino] });

    const res = await servicio.reasignar('5', '2', usuario, '1.2.3.4');

    expect(res).toEqual({ ok: true, voucherId: '5', pedidoAnterior: 'CP-1', pedidoNuevo: 'CP-2' });
    expect(prisma.voucherPago.update).toHaveBeenCalledWith({ where: { id: 5n }, data: { pedido_id: 2n } });
    expect(prisma.conversacion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          flujo: expect.objectContaining({ pago: expect.objectContaining({ pedidoId: '2', pedidoCodigo: 'CP-2' }) }),
        }),
      }),
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        accion: 'REASIGNAR_VOUCHER',
        antes: { pedidoId: '1', pedidoCodigo: 'CP-1' },
        despues: { pedidoId: '2', pedidoCodigo: 'CP-2' },
      }),
    );
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('vouchers:actualizado', expect.objectContaining({ pedidoIds: ['1', '2'], motivo: 'reasignado' }));
  });

  it('no mueve un voucher que ya aprobó un pago', async () => {
    const origen = pedido(1, { pago_estado: 'COORDINADO' });
    const { servicio, prisma } = construir({ pedidos: [origen, pedido(2)] });
    await expect(servicio.reasignar('5', '2', usuario)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.voucherPago.update).not.toHaveBeenCalled();
  });

  it('rechaza un pedido destino que no es digital, pendiente o anulado', async () => {
    const origen = pedido(1);
    const efectivo = pedido(3, { pago_preferido: 'EFECTIVO', pago_metodo: 'EFECTIVO' });
    const anulado = pedido(4, { estado: 'ANULADO' });
    const { servicio } = construir({ pedidos: [origen, efectivo, anulado] });
    await expect(servicio.reasignar('5', '3', usuario)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_DESTINO_NO_VALIDO' } });
    await expect(servicio.reasignar('5', '4', usuario)).rejects.toBeInstanceOf(ConflictException);
  });

  it('no mueve el voucher entre clientes distintos', async () => {
    const origen = pedido(1);
    const otro = pedido(2, { cliente_telefono: '51999888777' });
    const { servicio, prisma } = construir({ pedidos: [origen, otro] });
    await expect(servicio.reasignar('5', '2', usuario)).rejects.toMatchObject({ response: { codigo: 'CLIENTE_DISTINTO' } });
    expect(prisma.voucherPago.update).not.toHaveBeenCalled();
  });

  it('no mueve un voucher al mismo pedido ni a uno inexistente', async () => {
    const { servicio } = construir({ pedidos: [pedido(1)] });
    await expect(servicio.reasignar('5', '1', usuario)).rejects.toBeInstanceOf(BadRequestException);
    await expect(servicio.reasignar('5', '99', usuario)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lista como destinos solo los pedidos válidos del mismo cliente', async () => {
    const origen = pedido(1);
    const { servicio } = construir({
      pedidos: [origen, pedido(2), pedido(3, { pago_preferido: 'EFECTIVO', pago_metodo: 'EFECTIVO' })],
    });
    const res = await servicio.destinosReasignacion('5');
    expect(res.bloqueado).toBe(false);
    expect(res.destinos.map((d) => d.codigo)).toEqual(['CP-2']);
  });
});
