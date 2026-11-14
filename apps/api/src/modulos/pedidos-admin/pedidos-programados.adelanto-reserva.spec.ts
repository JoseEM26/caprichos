jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
jest.mock('../salon/salon.service', () => ({ SalonService: class {} }));
import { PedidosEstadoService } from './pedidos-estado.service';
import { PedidosProgramadosService } from './pedidos-programados.service';

const admin = { partyId: 1n, rol: 'ADMIN', debeCambiar: false } as any;
const manana = () => new Date(Date.now() + 26 * 60 * 60 * 1000);

describe('programados: reserva de mesa, reprogramar y anular con adelanto', () => {
  const armar = () => {
    const prisma: any = {
      parametro: { findMany: jest.fn().mockResolvedValue([]) },
      pedido: { findUnique: jest.fn().mockResolvedValue(null), update: jest.fn() },
      reserva: { update: jest.fn(), findFirst: jest.fn().mockResolvedValue(null) },
    };
    const reservas: any = {
      crear: jest.fn().mockResolvedValue({ id: '40', mesas: [{ nombre: 'Mesa 4', numero: 4 }] }),
      cancelar: jest.fn().mockResolvedValue({}),
      actualizar: jest.fn(),
    };
    const pedidos: any = { crear: jest.fn().mockResolvedValue({ id: '300', codigo: 'CP-W300', estado: 'PROGRAMADO' }) };
    const auditoria: any = { registrar: jest.fn() };
    return { prisma, reservas, pedidos, svc: new PedidosProgramadosService(prisma, auditoria, undefined, undefined, pedidos, reservas) };
  };
  const dtoMesa: any = { modalidad: 'MESA', cliente: { nombre: 'Ana', telefono: '987654321' }, lineas: [], pago: { metodo: 'EFECTIVO' }, reserva: { mesas: ['4'], personas: 3 } };

  it('un pedido de MESA programado crea la reserva, la enlaza al pedido y lleva el nombre de la mesa', async () => {
    const { svc, reservas, pedidos, prisma } = armar();
    const fecha = manana();
    const r: any = await svc.crearProgramado(dtoMesa, 'k1', { canal: 'CAJA', programadoPara: fecha } as any, admin);
    expect(reservas.crear.mock.calls[0][0]).toMatchObject({ telefono: '987654321', personas: 3, mesas: ['4'], hora: fecha.toISOString() });
    expect(pedidos.crear.mock.calls[0][2].mesaNombre).toBe('Mesa 4');
    expect(prisma.reserva.update).toHaveBeenCalledWith({ where: { id: 40n }, data: { pedido_id: 300n } });
    expect(r.reservaId).toBe('40');
  });

  it('sin reserva o sin celular se rechaza, y si el pedido falla la reserva se cancela', async () => {
    const { svc, reservas, pedidos } = armar();
    await expect(svc.crearProgramado({ ...dtoMesa, reserva: undefined }, 'k2', { programadoPara: manana() } as any, admin)).rejects.toMatchObject({ response: { codigo: 'RESERVA_REQUERIDA' } });
    await expect(svc.crearProgramado({ ...dtoMesa, cliente: { nombre: 'Ana' } }, 'k3', { programadoPara: manana() } as any, admin)).rejects.toMatchObject({ response: { codigo: 'TELEFONO_REQUERIDO' } });
    pedidos.crear.mockRejectedValue(new Error('sin stock'));
    await expect(svc.crearProgramado(dtoMesa, 'k4', { programadoPara: manana() } as any, admin)).rejects.toThrow('sin stock');
    expect(reservas.cancelar).toHaveBeenCalledWith('40', expect.objectContaining({ motivo: expect.any(String) }), admin, undefined);
  });

  it('otras modalidades no crean reserva', async () => {
    const { svc, reservas, pedidos } = armar();
    await svc.crearProgramado({ ...dtoMesa, modalidad: 'RECOGER' }, 'k5', { programadoPara: manana() } as any, admin);
    expect(reservas.crear).not.toHaveBeenCalled();
    expect(pedidos.crear).toHaveBeenCalled();
  });

  it('reprogramar mueve la fecha y también la reserva de la mesa; no vale si ya pasó a cocina', async () => {
    const { svc, prisma, reservas } = armar();
    prisma.pedido.findUnique.mockResolvedValue({ id: 9n, estado: 'PROGRAMADO', codigo: 'CP-W009', programado_para: manana() });
    prisma.reserva.findFirst.mockResolvedValue({ id: 40n });
    const nueva = new Date(Date.now() + 50 * 60 * 60 * 1000);
    await svc.reprogramar('9', nueva.toISOString(), admin);
    expect(reservas.actualizar).toHaveBeenCalledWith(40n, { hora: nueva.toISOString() }, admin, undefined);
    expect(prisma.pedido.update).toHaveBeenCalledWith({ where: { id: 9n }, data: { programado_para: nueva } });
    prisma.pedido.findUnique.mockResolvedValue({ id: 9n, estado: 'COLA' });
    await expect(svc.reprogramar('9', nueva.toISOString(), admin)).rejects.toMatchObject({ response: { codigo: 'REPROGRAMAR_SOLO_PROGRAMADO' } });
  });
});

describe('anular un programado con adelanto', () => {
  const pedido = { id: 20n, codigo: 'CP-W020', modalidad: 'RECOGER', estado: 'PROGRAMADO', adelanto_total: 30 };
  const montar = () => {
    const tx: any = {
      pedidoAdelanto: {
        findMany: jest.fn().mockResolvedValue([{ id: 1n, pedido_id: 20n, caja_id: 5n, medio: 'EFECTIVO', monto: 30, anulado_en: null }]),
        update: jest.fn(),
      },
      pedido: { update: jest.fn() },
      caja: { findUnique: jest.fn().mockResolvedValue({ id: 6n, estado: 'ABIERTA' }) },
      movimientoCaja: { create: jest.fn().mockResolvedValue({ id: 77n }) },
      $queryRaw: jest.fn(),
    };
    // la caja del adelanto (5) ya cerró; la de hoy (6) está abierta
    tx.$queryRaw = jest.fn();
    const cajas: Record<string, any> = { '5': { id: 5n, estado: 'CERRADA' }, '6': { id: 6n, estado: 'ABIERTA' } };
    tx.caja.findUnique = jest.fn(({ where }: any) => Promise.resolve(where.id ? cajas[String(where.id)] : cajas['6']));
    const prisma: any = {
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido), update: jest.fn().mockResolvedValue({ ...pedido, estado: 'ANULADO' }), count: jest.fn().mockResolvedValue(0) },
      cobro: { findFirst: jest.fn().mockResolvedValue(null) },
      pedidoEstadoHistorial: { create: jest.fn() },
      reserva: { updateMany: jest.fn() },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };
    const auditoria: any = { registrar: jest.fn().mockResolvedValue(undefined) };
    return { tx, prisma, service: new PedidosEstadoService(prisma, {} as any, auditoria, { emitirAdmin: jest.fn() } as any) };
  };

  it('sin elegir «se devuelve» pide decidir (409) y no anula', async () => {
    const { service, prisma } = montar();
    await expect(service.cambiarEstado(20n, { estado: 'ANULADO', motivo: 'Cliente desistió' }, admin)).rejects.toMatchObject({ response: { codigo: 'PEDIDO_CON_ADELANTO' } });
    expect(prisma.pedido.update).not.toHaveBeenCalled();
  });

  it('«se devuelve»: con la caja del adelanto cerrada, el efectivo sale como egreso de la caja de hoy; libera la reserva', async () => {
    const { service, tx, prisma } = montar();
    const r = await service.cambiarEstado(20n, { estado: 'ANULADO', motivo: 'Cliente desistió', adelanto: 'DEVUELVE' }, admin);
    expect(r.estado).toBe('ANULADO');
    const mov = tx.movimientoCaja.create.mock.calls[0][0].data;
    expect(mov).toMatchObject({ caja_id: 6n, tipo: 'EGRESO' });
    expect(Number(mov.monto)).toBe(30);
    expect(tx.pedidoAdelanto.update.mock.calls[0][0].data).toMatchObject({ devuelto_movimiento_id: 77n, devuelto_en_caja_id: 6n });
    expect(prisma.reserva.updateMany).toHaveBeenCalled();
  });
});
