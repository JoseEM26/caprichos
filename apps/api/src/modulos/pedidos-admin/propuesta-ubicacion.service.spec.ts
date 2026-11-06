jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PropuestaUbicacionService } from './propuesta-ubicacion.service';

describe('PropuestaUbicacionService (repartidor)', () => {
  const repartidor: any = { partyId: 50n, rol: 'REPARTIDOR' };
  let prisma: any;
  let cambio: any;
  let auditoria: any;
  let service: PropuestaUbicacionService;

  const pedido = (extra: any = {}) => ({
    id: 7n,
    codigo: 'CP-W007',
    modalidad: 'DELIVERY',
    estado: 'EN_CAMINO',
    repartidor_party_id: 50n,
    entrega_lat: null,
    entrega_lng: null,
    entrega_direccion: null,
    entrega_referencia: null,
    zona_id: null,
    envio: 6,
    total: 46,
    ...extra,
  });

  beforeEach(() => {
    prisma = {
      pedido: { findUnique: jest.fn().mockResolvedValue(pedido()) },
      pedidoCambioUbicacion: {
        create: jest.fn().mockResolvedValue({ id: 3n, origen: 'REPARTIDOR', estado: 'PROPUESTA', propuesto_por_party_id: 50n, lat_nueva: new Prisma.Decimal(-12.05), lng_nueva: new Prisma.Decimal(-76.97), envio_anterior: new Prisma.Decimal(6), envio_nuevo: new Prisma.Decimal(0), total_anterior: new Prisma.Decimal(46), total_nuevo: new Prisma.Decimal(40), diferencia_envio: new Prisma.Decimal(-6), propuesto_en: new Date(), zonaAnterior: null, zonaNueva: null }),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      party: { findMany: jest.fn().mockResolvedValue([{ id: 50n, persona: { nombres: 'Luis', apellidos: 'Ruiz' } }]) },
      notificacion: { create: jest.fn().mockResolvedValue({ id: 1n }) },
      persona: {},
    };
    cambio = {
      parseId: (s: string) => BigInt(s),
      calcular: jest.fn().mockResolvedValue({ zona: { zonaId: 3n, codigo: 'Z3' }, envioAnterior: 6, envioNuevo: 0, diferencia: -6, totalAnterior: 46, totalNuevo: 40 }),
      aplicarCambio: jest.fn().mockResolvedValue({ id: '7', ok: true }),
    };
    auditoria = { registrar: jest.fn() };
    service = new PropuestaUbicacionService(prisma, cambio, auditoria, undefined);
  });

  it('un repartidor no propone en un pedido ajeno: 403', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ repartidor_party_id: 99n }));
    await expect(service.proponer('7', { lat: -12.05, lng: -76.97 }, repartidor)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.pedidoCambioUbicacion.create).not.toHaveBeenCalled();
  });

  it('no propone si el pedido ya no está en curso', async () => {
    prisma.pedido.findUnique.mockResolvedValue(pedido({ estado: 'ENTREGADO' }));
    await expect(service.proponer('7', { lat: -12.05, lng: -76.97 }, repartidor)).rejects.toMatchObject({ response: { codigo: 'ESTADO_INVALIDO' } });
  });

  it('propone: queda PROPUESTA, sin tocar el pedido, y avisa a Caja', async () => {
    const r = await service.proponer('7', { lat: -12.05, lng: -76.97, nota: ' Casa azul ' }, repartidor);
    expect(prisma.pedidoCambioUbicacion.create.mock.calls[0][0].data).toMatchObject({ estado: 'PROPUESTA', origen: 'REPARTIDOR', nota: 'Casa azul' });
    expect(prisma.notificacion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ rol_destino: 'CAJERO', tipo: 'UBICACION_PROPUESTA' }) });
    expect(r).toMatchObject({ codigo: 'CP-W007', estado: 'PROPUESTA' });
    expect(cambio.aplicarCambio).not.toHaveBeenCalled();
  });

  it('una segunda propuesta pendiente choca con el índice único: 409', async () => {
    prisma.pedidoCambioUbicacion.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' }),
    );
    await expect(service.proponer('7', { lat: -12.05, lng: -76.97 }, repartidor)).rejects.toMatchObject({ response: { codigo: 'PROPUESTA_PENDIENTE' } });
  });

  it('el repartidor cancela su propuesta; si no tiene ninguna pendiente, 404', async () => {
    await expect(service.cancelar('7', repartidor)).resolves.toEqual({ cancelada: true });
    expect(prisma.pedidoCambioUbicacion.updateMany.mock.calls[0][0].where).toMatchObject({ estado: 'PROPUESTA', propuesto_por_party_id: 50n });
    prisma.pedidoCambioUbicacion.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.cancelar('7', repartidor)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('Caja aprueba: se aplica como cambio de Caja con el punto de la propuesta', async () => {
    prisma.pedidoCambioUbicacion.findUnique.mockResolvedValue({ id: 3n, pedido_id: 7n, origen: 'REPARTIDOR', estado: 'PROPUESTA', lat_nueva: new Prisma.Decimal(-12.05), lng_nueva: new Prisma.Decimal(-76.97), propuesto_por_party_id: 50n, nota: 'Casa azul' });
    const caja: any = { partyId: 2n, rol: 'CAJERO' };
    await service.aprobar('7', '3', caja);
    expect(cambio.aplicarCambio).toHaveBeenCalledWith(7n, { lat: -12.05, lng: -76.97 }, expect.objectContaining({ origen: 'REPARTIDOR', propuesta: { id: 3n, propuestoPor: 50n, nota: 'Casa azul' } }));
  });

  it('Caja rechaza con motivo; la propuesta ya no está pendiente: 409', async () => {
    const caja: any = { partyId: 2n, rol: 'CAJERO' };
    prisma.pedidoCambioUbicacion.findUnique.mockResolvedValue({ id: 3n, pedido_id: 7n, origen: 'REPARTIDOR', estado: 'PROPUESTA' });
    const r = await service.rechazar('7', '3', { motivo: 'No es esa dirección' }, caja);
    expect(r).toMatchObject({ estado: 'RECHAZADA', motivo: 'No es esa dirección' });
    expect(prisma.pedidoCambioUbicacion.updateMany.mock.calls[0][0].data).toMatchObject({ estado: 'RECHAZADA' });

    prisma.pedidoCambioUbicacion.findUnique.mockResolvedValue({ id: 3n, pedido_id: 7n, origen: 'REPARTIDOR', estado: 'CANCELADA' });
    await expect(service.rechazar('7', '3', {}, caja)).rejects.toMatchObject({ response: { codigo: 'PROPUESTA_NO_VIGENTE' } });
  });
});
