// El gateway arrastra @nestjs/jwt (ESM); aquí solo se usa como tipo opcional.
jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { ReprogramacionService } from '../servicios/reprogramacion.service';

const TEL = '51987654321';
const PEDIDO = BigInt(1);

function crearPrisma(opts: { pendiente?: boolean; pago?: string; actualizados?: number } = {}) {
  const prisma: any = {
    mensajeReparto: {
      findFirst: jest.fn().mockResolvedValue(
        opts.pendiente === false ? null : { pedido_id: PEDIDO, numero: 5, pedido: { id: PEDIDO, codigo: 'CP-R1' } },
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn(),
      findMany: jest.fn().mockResolvedValue([{ pedido_id: PEDIDO }]),
    },
    pedido: {
      updateMany: jest.fn().mockResolvedValue({ count: opts.actualizados ?? 1 }),
      findUnique: jest.fn().mockResolvedValue({ codigo: 'CP-R1', pago_estado: opts.pago ?? 'PENDIENTE' }),
    },
    incidenteEntrega: {
      findFirst: jest.fn().mockResolvedValue({ id: BigInt(9) }),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    pedidoEstadoHistorial: { create: jest.fn() },
    notificacion: { create: jest.fn().mockResolvedValue({ id: BigInt(1) }) },
  };
  prisma.$transaction = jest.fn((fn: any) => fn(prisma));
  return prisma;
}

function crear(prisma: any) {
  const avisos = { avisar: jest.fn().mockResolvedValue({ estado: 'ENVIADO' }) };
  const servicio = new ReprogramacionService(prisma, avisos as any);
  return { servicio, avisos };
}

describe('ReprogramacionService (retiro -> SI / NO / sin respuesta)', () => {
  it('sin pregunta pendiente, un "no gracias" no cancela nada y sigue al bot', async () => {
    const prisma = crearPrisma({ pendiente: false });
    const { servicio, avisos } = crear(prisma);

    const atendida = await servicio.procesarRespuesta(TEL, 'No gracias', null);

    expect(atendida).toBe(false);
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
    expect(avisos.avisar).not.toHaveBeenCalled();
  });

  it('SI del cliente: queda Por reprogramar, avisa a Caja (CAJERO) y confirma al cliente', async () => {
    const prisma = crearPrisma();
    const { servicio, avisos } = crear(prisma);

    const atendida = await servicio.procesarRespuesta(TEL, 'Sí, reprogramar', 'reprogramar_si');

    expect(atendida).toBe(true);
    expect(prisma.mensajeReparto.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'REPROGRAMAR' }) }),
    );
    expect(prisma.notificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rol_destino: 'CAJERO', tipo: 'REPROGRAMACION_DELIVERY' }) }),
    );
    expect(avisos.avisar).toHaveBeenCalledWith(PEDIDO, 'REPROG_RECIBIDA');
    // El pedido NO se anula ni sale de la falla: lo reenvía el admin
    expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
  });

  it('SI repetido (ya respondido) no vuelve a avisar', async () => {
    const prisma = crearPrisma();
    prisma.mensajeReparto.updateMany.mockResolvedValueOnce({ count: 0 });
    const { servicio, avisos } = crear(prisma);

    await servicio.procesarRespuesta(TEL, 'si', null);

    expect(avisos.avisar).not.toHaveBeenCalled();
  });

  it('NO del cliente (botón): pedido ANULADO con motivo de NO, incidente DEVUELTO y cierre al cliente', async () => {
    const prisma = crearPrisma();
    const { servicio, avisos } = crear(prisma);

    const atendida = await servicio.procesarRespuesta(TEL, 'No, cancelar', 'reprogramar_no');

    expect(atendida).toBe(true);
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ estado: 'LISTO', repartidor_party_id: null, motivo_falla: 'NO_CONTESTA' }),
        data: expect.objectContaining({ estado: 'ANULADO', motivo_anulacion: expect.stringContaining('no quiso reprogramar') }),
      }),
    );
    expect(prisma.incidenteEntrega.update).toHaveBeenCalledWith({ where: { id: BigInt(9) }, data: { cierre: 'DEVUELTO' } });
    expect(prisma.mensajeReparto.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'NO_REPROGRAMAR' }) }),
    );
    expect(avisos.avisar).toHaveBeenCalledWith(PEDIDO, 'REPROG_CANCELADA');
  });

  it('pedido pagado que se cancela: avisa a Caja para revisar devolución', async () => {
    const prisma = crearPrisma({ pago: 'PAGADO' });
    const { servicio } = crear(prisma);

    await servicio.cancelar(PEDIDO, 'NO');

    expect(prisma.notificacion.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tipo: 'REVISAR_DEVOLUCION', rol_destino: 'CAJERO' }) }),
    );
  });

  it('pedido sin pago no genera aviso de devolución', async () => {
    const prisma = crearPrisma({ pago: 'PENDIENTE' });
    const { servicio } = crear(prisma);

    await servicio.cancelar(PEDIDO, 'NO');

    const tipos = prisma.notificacion.create.mock.calls.map((c: any[]) => c[0].data.tipo);
    expect(tipos).not.toContain('REVISAR_DEVOLUCION');
  });

  it('sin respuesta a tiempo: vence y cancela por falta de respuesta (motivo distinto al NO)', async () => {
    const prisma = crearPrisma();
    const { servicio, avisos } = crear(prisma);
    const ahora = new Date('2030-01-01T12:00:00Z');

    const n = await servicio.vencerSinRespuesta(30, ahora);

    expect(n).toBe(1);
    const filtro = prisma.mensajeReparto.findMany.mock.calls[0][0].where;
    expect(filtro.enviado_en.lte.getTime()).toBe(ahora.getTime() - 30 * 60000);
    expect(prisma.pedido.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'ANULADO', motivo_anulacion: expect.stringContaining('Sin respuesta') }) }),
    );
    expect(prisma.mensajeReparto.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ estado: 'SIN_RESPUESTA' }) }),
    );
    expect(avisos.avisar).toHaveBeenCalledWith(PEDIDO, 'REPROG_SIN_RESPUESTA');
  });

  it('idempotente: si el pedido ya no está retirado en LISTO no cancela ni avisa de nuevo', async () => {
    const prisma = crearPrisma({ actualizados: 0 });
    const { servicio, avisos } = crear(prisma);

    const ok = await servicio.cancelar(PEDIDO, 'SIN_RESPUESTA');

    expect(ok).toBe(false);
    expect(avisos.avisar).not.toHaveBeenCalled();
    expect(prisma.notificacion.create).not.toHaveBeenCalled();
  });

  it('tope: con las reprogramaciones usadas al límite, no se vuelve a preguntar', async () => {
    const prisma = crearPrisma();
    const { servicio } = crear(prisma);

    prisma.incidenteEntrega.count.mockResolvedValueOnce(1);
    expect(await servicio.topeAlcanzado(PEDIDO, 1)).toBe(true);

    prisma.incidenteEntrega.count.mockResolvedValueOnce(0);
    expect(await servicio.topeAlcanzado(PEDIDO, 1)).toBe(false);
  });
});
