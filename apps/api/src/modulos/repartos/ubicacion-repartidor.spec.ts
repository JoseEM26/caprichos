jest.mock('../../comun/socket/eventos.gateway', () => ({
  EventosGateway: class {
    emitirAdmin = jest.fn();
  },
}));

import { ForbiddenException, HttpException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UbicacionRepartidorService } from './ubicacion-repartidor.service';
import { UbicacionRepartidorDto } from './dto/ubicacion-repartidor.dto';
import { SeguimientoService } from '../pedidos/seguimiento.service';
import { MATRIZ } from '../acceso/permisos';

const u = (rol: string, partyId = 7n) => ({ partyId, rol, debeCambiar: false }) as any;
const dto = (o: Record<string, any> = {}) => ({ lat: -12.05, lng: -77.04, precision: 20, ...o }) as any;
const hace = (m: number) => new Date(Date.now() - m * 60000);

function montar(pedidos: any[] = [{ codigo: 'CP-1' }], filas: any[] = []) {
  const prisma: any = {
    pedido: { findMany: jest.fn().mockResolvedValue(pedidos) },
    person: { findUnique: jest.fn().mockResolvedValue({ nombres: 'Rosa', apellidos: 'Gil' }), findMany: jest.fn().mockResolvedValue([]) },
    contactMechanism: { findMany: jest.fn().mockResolvedValue([]) },
    ubicacionRepartidor: {
      upsert: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      findMany: jest.fn().mockResolvedValue(filas),
    },
  };
  const gw = { emitirAdmin: jest.fn(), emitirPublico: jest.fn() };
  return { prisma, gw, service: new UbicacionRepartidorService(prisma, gw as any) };
}

describe('Ubicación del repartidor: validación', () => {
  const errores = async (o: Record<string, any>) => validate(plainToInstance(UbicacionRepartidorDto, dto(o)));
  it('acepta una posición en Lima', async () => expect(await errores({})).toHaveLength(0));
  it.each([{ lat: 40 }, { lng: -3 }, { lat: 'x' }, { precision: 500 }, { precision: -1 }])('rechaza %j', async (o) => {
    expect((await errores(o)).length).toBeGreaterThan(0);
  });
});

describe('Ubicación del repartidor: envío', () => {
  it('con pedidos en camino hace upsert de la última posición y emite solo a la sala del personal', async () => {
    const { service, prisma, gw } = montar();
    await service.registrar(dto(), u('REPARTIDOR'));
    expect(prisma.ubicacionRepartidor.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.ubicacionRepartidor.upsert.mock.calls[0][0].where).toEqual({ repartidor_party_id: 7n });
    expect(gw.emitirAdmin).toHaveBeenCalledWith(
      'reparto:ubicacion',
      expect.objectContaining({ repartidorId: '7', nombre: 'Rosa Gil', pedidos: ['CP-1'], lat: -12.05 }),
    );
    expect(gw.emitirPublico).not.toHaveBeenCalled();
  });

  it('sin pedidos en camino responde 403 y no guarda nada', async () => {
    const { service, prisma, gw } = montar([]);
    await expect(service.registrar(dto(), u('REPARTIDOR'))).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.ubicacionRepartidor.upsert).not.toHaveBeenCalled();
    expect(gw.emitirAdmin).not.toHaveBeenCalled();
  });

  it('límite: máximo un envío cada 5 s por repartidor (429), otro repartidor no se afecta', async () => {
    const { service } = montar();
    await service.registrar(dto(), u('REPARTIDOR', 7n));
    await expect(service.registrar(dto(), u('REPARTIDOR', 7n))).rejects.toMatchObject({ status: 429 });
    await expect(service.registrar(dto(), u('REPARTIDOR', 8n))).resolves.toEqual({ ok: true });
  });

  it('pasados 5 s vuelve a aceptar', async () => {
    const { service } = montar();
    const t = jest.spyOn(Date, 'now');
    t.mockReturnValue(1_000_000);
    await service.registrar(dto(), u('REPARTIDOR'));
    t.mockReturnValue(1_006_000);
    await expect(service.registrar(dto(), u('REPARTIDOR'))).resolves.toEqual({ ok: true });
    t.mockRestore();
  });

  it('borra las posiciones de más de 15 min', async () => {
    const { service, prisma } = montar();
    await service.listar(u('ADMIN'));
    const corte = prisma.ubicacionRepartidor.deleteMany.mock.calls[0][0].where.actualizado_en.lt as Date;
    expect(Date.now() - corte.getTime()).toBeGreaterThanOrEqual(15 * 60000 - 50);
  });
});

describe('Ubicación del repartidor: lectura', () => {
  const fila = (id: bigint, min: number) => ({ repartidor_party_id: id, lat: -12, lng: -77, precision: 10, rumbo: null, velocidad: null, actualizado_en: hace(min) });

  it('el personal ve todas, con estado en vivo / hace minutos', async () => {
    const { service, prisma } = montar([], [fila(7n, 1), fila(8n, 9)]);
    for (const rol of ['ADMIN', 'SUPERVISOR', 'CAJERO']) {
      const r = await service.listar(u(rol, 1n));
      expect(r.map((x: any) => x.estado)).toEqual(['EN_VIVO', 'HACE_MINUTOS']);
    }
    expect(prisma.ubicacionRepartidor.findMany.mock.calls[0][0].where.repartidor_party_id).toBeUndefined();
  });

  it('el repartidor solo se ve a sí mismo', async () => {
    const { service, prisma } = montar([], [fila(7n, 1)]);
    await service.listar(u('REPARTIDOR', 7n));
    expect(prisma.ubicacionRepartidor.findMany.mock.calls[0][0].where.repartidor_party_id).toBe(7n);
  });

  it('MOZO y COCINA reciben 403', async () => {
    const { service } = montar([], [fila(7n, 1)]);
    for (const rol of ['MOZO', 'COCINA']) await expect(service.listar(u(rol))).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('Ubicación del repartidor: permisos', () => {
  it('ver_ubicacion solo ADMIN, SUPERVISOR y CAJERO', () => {
    const con = Object.keys(MATRIZ).filter((r) => MATRIZ[r].includes('repartos/ver_ubicacion')).sort();
    expect(con).toEqual(['ADMIN', 'CAJERO', 'SUPERVISOR']);
  });
  it('enviar (repartos/entregar) lo tienen REPARTIDOR y APOYO_DELIVERY, no MOZO ni COCINA', () => {
    expect(MATRIZ.REPARTIDOR).toContain('repartos/entregar');
    expect(MATRIZ.APOYO_DELIVERY).toContain('repartos/entregar');
    expect(MATRIZ.MOZO).not.toContain('repartos/entregar');
    expect(MATRIZ.COCINA).not.toContain('repartos/entregar');
  });
});

describe('Seguimiento público: nunca expone la posición del repartidor', () => {
  it('la respuesta no trae lat/lng del repartidor ni consulta su tabla', async () => {
    const prisma: any = {
      pedido: {
        findUnique: jest.fn().mockResolvedValue({
          id: 7n, codigo: 'CAP-0007', estado: 'EN_CAMINO', modalidad: 'DELIVERY', total: { toString: () => '42.50' },
          creado_en: hace(30), pasa_cocina_en: null, listo_en: null, despachado_en: null, entregado_en: null, historial: [],
          cliente_nombre: 'X', cliente_telefono: '999000111', entrega_direccion: 'Calle 1', entrega_referencia: null,
          entrega_lat: 1.5, entrega_lng: 2.5, repartidor_party_id: 7n, salio_en: hace(5), llego_en: null,
        }),
      },
      ubicacionRepartidor: new Proxy({}, { get: () => { throw new Error('el seguimiento público no puede leer ubicacion_repartidor'); } }),
    };
    const service = new SeguimientoService(prisma);
    let json = '';
    try {
      json = JSON.stringify(await service.obtener('CAP-0007', undefined));
    } catch (e: any) {
      // sin token puede pedirlo; el contenido del error tampoco debe traer posición
      json = JSON.stringify(e instanceof HttpException ? e.getResponse() : String(e));
    }
    expect(json).not.toContain('-12.05');
    expect(json.toLowerCase()).not.toContain('ubicacion_repartidor');
  });
});
