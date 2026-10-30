jest.mock('../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { PantallasService } from './pantallas.service';

describe('PantallasService', () => {
  let prisma: any;
  let auditoria: any;
  let eventos: any;
  let service: PantallasService;

  const admin = { partyId: 1n, rol: 'ADMIN', debeCambiar: false };

  beforeEach(() => {
    prisma = {
      deviceKey: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 1n,
            tipo: 'TV',
            nombre: 'TV cocina',
            llave_hash: 'abcdef12345678904qx9',
            area_id: 1n,
            codigo_vinculo: null,
            activo: true,
            ultima_conexion: new Date(),
            creado_en: new Date(),
            area: { id: 1n, nombre: 'Cocina y barra' },
          },
          {
            id: 2n,
            tipo: 'TV',
            nombre: 'TV barra',
            llave_hash: 'abcdef12345678908kl2',
            area_id: 2n,
            codigo_vinculo: null,
            activo: true,
            ultima_conexion: new Date(),
            creado_en: new Date(),
            area: { id: 2n, nombre: 'Solo barra' },
          },
          {
            id: 3n,
            tipo: 'TV',
            nombre: 'TV despacho',
            llave_hash: 'abcdef12345678909mn3',
            area_id: null,
            codigo_vinculo: 'K7M-4QX',
            codigo_expira_en: new Date(Date.now() + 600000),
            activo: false,
            ultima_conexion: null,
            creado_en: new Date(),
            area: { id: 3n, nombre: 'Solo cocina' },
          },
        ]),
        findFirst: jest.fn().mockImplementation(({ where }) => {
          if (where.codigo_vinculo === 'K7M-4QX') {
            return Promise.resolve({
              id: 3n,
              tipo: 'TV',
              nombre: 'TV despacho',
              codigo_vinculo: 'K7M-4QX',
              codigo_expira_en: new Date(Date.now() + 600000),
              activo: false,
            });
          }
          return Promise.resolve(null);
        }),
        findUnique: jest.fn().mockImplementation(({ where }) => {
          if (where.id === 1n) {
            return Promise.resolve({ id: 1n, tipo: 'TV', nombre: 'TV cocina', activo: true });
          }
          return Promise.resolve(null);
        }),
        update: jest.fn().mockResolvedValue({ id: 1n, activo: false }),
        create: jest.fn().mockResolvedValue({ id: 4n, nombre: 'TV nueva', activo: true }),
      },
      areaCocina: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1n, nombre: 'Cocina y barra' },
          { id: 2n, nombre: 'Solo barra' },
        ]),
        findFirst: jest.fn().mockResolvedValue({ id: 1n, nombre: 'Cocina y barra' }),
      },
    };

    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    eventos = { emitirAdmin: jest.fn() };
    service = new PantallasService(prisma, auditoria, eventos);
  });

  it('listar retorna las pantallas TV y filtra por texto o estación', async () => {
    const res = await service.listar();
    expect(res.total).toBe(3);
    expect(res.pantallas[0].nombre).toBe('TV cocina');
    expect(res.pantallas[0].llave).toBe('Termina en ...4QX9');
    expect(res.pantallas[0].estacion).toBe('Cocina y barra');

    const filtrado = await service.listar('barra', '');
    expect(filtrado.pantallas.length).toBe(2); // TV cocina (Cocina y barra) y TV barra
  });

  it('vincular activa una pantalla existente por código', async () => {
    const res = await service.vincular({ codigo: 'K7M-4QX' }, admin);
    expect(res.ok).toBe(true);
    expect(prisma.deviceKey.update).toHaveBeenCalled();
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        modulo: 'pantallas',
        accion: 'VINCULAR_PANTALLA',
      }),
    );
    expect(eventos.emitirAdmin).toHaveBeenCalledWith('pantallas:actualizado', expect.any(Object));
  });

  it('vincular crea una nueva pantalla TV si el código no existía en cola', async () => {
    const res = await service.vincular({ codigo: 'X9P-123', nombre: 'TV Sala' }, admin);
    expect(res.ok).toBe(true);
    expect(prisma.deviceKey.create).toHaveBeenCalled();
  });

  it('cambiarEstado activa o desactiva la pantalla y audita', async () => {
    const res = await service.cambiarEstado('1', false, admin);
    expect(res.ok).toBe(true);
    expect(res.activo).toBe(false);
    expect(prisma.deviceKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n },
        data: { activo: false },
      }),
    );
    expect(auditoria.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ accion: 'DESACTIVAR_PANTALLA' }),
    );
  });

  it('editar cambia el nombre y el área', async () => {
    const res = await service.editar('1', { nombre: 'TV Principal' }, admin);
    expect(res.ok).toBe(true);
    expect(prisma.deviceKey.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 1n },
        data: { nombre: 'TV Principal' },
      }),
    );
  });
});
