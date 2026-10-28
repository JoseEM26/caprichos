// El gateway arrastra @nestjs/jwt (ESM): aquí solo se usa como tipo opcional.
jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RepartosService } from './repartos.service';
import { UsuarioAutenticado } from '../acceso/acceso.tipos';

const admin: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };

/** Pedido delivery retirado (LISTO, motivo NO_CONTESTA) con el cliente que dijo SÍ. */
function crear(opts: { pagoEstado?: string; recargo?: number | null; envio?: number; estado?: string }) {
  const pedido = {
    id: 77n,
    codigo: 'CP-7700',
    estado: opts.estado ?? 'LISTO',
    motivo_falla: 'NO_CONTESTA',
    repartidor_party_id: null,
    pago_estado: opts.pagoEstado ?? 'PENDIENTE',
    pago_metodo: 'EFECTIVO',
    total: new Prisma.Decimal(30),
    envio: new Prisma.Decimal(opts.envio ?? 7),
  };
  const prisma: any = {
    pedido: {
      findUnique: jest.fn().mockImplementation(async () => ({ ...pedido })),
      update: jest.fn().mockImplementation(async ({ data }: any) => ({
        ...pedido,
        ...data,
        estado: data.estado ?? pedido.estado,
      })),
    },
    mensajeReparto: {
      findUnique: jest.fn().mockImplementation(async () => ({
        estado: prisma.__estadoPregunta,
      })),
      update: jest.fn().mockResolvedValue({}),
    },
    parametro: {
      findMany: jest.fn().mockResolvedValue([{ clave: 'reprog_max_intentos', valor: 1 }]),
    },
    incidenteEntrega: {
      count: jest.fn().mockResolvedValue(0),
      findFirst: jest.fn().mockResolvedValue({ id: 9n, recargo: opts.recargo === undefined ? new Prisma.Decimal(7) : opts.recargo }),
      update: jest.fn().mockResolvedValue({}),
    },
    pedidoEstadoHistorial: { create: jest.fn().mockResolvedValue({}) },
    notificacion: { create: jest.fn().mockResolvedValue({ id: 1n, titulo: 'x' }) },
    __estadoPregunta: 'REPROGRAMAR',
  };
  const auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
  const eventos = { emitirAdmin: jest.fn() };
  const avisos = { avisar: jest.fn().mockResolvedValue({ estado: 'ENVIADO' }) };
  const servicio = new RepartosService(prisma, auditoria as any, {} as any, eventos as any, avisos as any);
  return { servicio, prisma, eventos, avisos };
}

describe('Reenvío tras confirmación del cliente (reprogramarPedido)', () => {
  it('total y envío suben el recargo exactamente una vez', async () => {
    const { servicio, prisma, avisos } = crear({ recargo: 7 });

    const res = await servicio.reprogramarPedido('77', admin);

    expect(res.ok).toBe(true);
    expect(prisma.pedido.update).toHaveBeenCalledTimes(1);
    const data = prisma.pedido.update.mock.calls[0][0].data;
    expect(Number(data.total)).toBe(37);
    expect(Number(data.envio)).toBe(14);
    expect(prisma.incidenteEntrega.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ cierre: 'REPROGRAMADO' }) }),
    );
    expect(avisos.avisar).toHaveBeenCalledWith(BigInt(77), 'REENVIADO');
  });

  it('idempotente: un segundo reenvío no vuelve a sumar (la pregunta ya quedó REPROGRAMADO)', async () => {
    const { servicio, prisma } = crear({ recargo: 7 });
    await servicio.reprogramarPedido('77', admin);

    prisma.__estadoPregunta = 'REPROGRAMADO';
    await expect(servicio.reprogramarPedido('77', admin)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.pedido.update).toHaveBeenCalledTimes(1);
  });

  it('sin costo (0): no cambia total ni envío', async () => {
    const { servicio, prisma } = crear({ recargo: 0 });
    await servicio.reprogramarPedido('77', admin);
    const data = prisma.pedido.update.mock.calls[0][0].data;
    expect(data.total).toBeUndefined();
    expect(data.envio).toBeUndefined();
  });

  it('pedido ya PAGADO: el recargo se suma y Caja recibe aviso para cobrarlo aparte', async () => {
    const { servicio, prisma, eventos } = crear({ recargo: 7, pagoEstado: 'PAGADO' });
    await servicio.reprogramarPedido('77', admin);

    expect(prisma.notificacion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: 'REPROG_COBRAR_RECARGO', rol_destino: 'CAJERO' }),
    });
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('notificaciones:nueva', expect.anything());
  });

  it('pedido pendiente de pago: no crea aviso de cobro aparte (el total ya incluye el recargo)', async () => {
    const { servicio, prisma } = crear({ recargo: 7, pagoEstado: 'PENDIENTE' });
    await servicio.reprogramarPedido('77', admin);
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });
});
