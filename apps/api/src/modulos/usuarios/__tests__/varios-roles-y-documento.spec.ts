jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsuariosService } from '../usuarios.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ArchivosService } from '../../archivos/archivos.service';
import * as argon2 from 'argon2';
import { UsuarioAutenticado } from '../../acceso/acceso.tipos';
import {
  documentoValido,
  errorCombinacionRoles,
  esSoloMozo,
  permisosDeRoles,
  rolEfectivoMozo,
  tieneRol,
} from '../../acceso/roles-usuario';

const admin: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] };
const cajero: UsuarioAutenticado = { partyId: 2n, rol: 'CAJERO', debeCambiar: false, roles: ['CAJERO'] };

describe('varios roles y tipo de documento (reglas puras)', () => {
  it('ADMIN y REPARTIDOR no se combinan con otros roles', () => {
    expect(errorCombinacionRoles('ADMIN', ['CAJERO'])).toMatch(/ADMIN/);
    expect(errorCombinacionRoles('CAJERO', ['REPARTIDOR'])).toMatch(/REPARTIDOR/);
    expect(errorCombinacionRoles('REPARTIDOR', ['MOZO'])).toMatch(/REPARTIDOR/);
  });

  it('un rol no se repite y una combinación normal es válida', () => {
    expect(errorCombinacionRoles('CAJERO', ['CAJERO'])).toMatch(/repetir/);
    expect(errorCombinacionRoles('CAJERO', ['MOZO', 'ALMACEN'])).toBeNull();
    expect(errorCombinacionRoles('MOZO', [])).toBeNull();
  });

  it('DNI de 8 dígitos; CE, cédula y pasaporte de 7 a 12 alfanuméricos', () => {
    expect(documentoValido('DNI', '12345678')).toBe(true);
    expect(documentoValido('DNI', '1234567')).toBe(false);
    expect(documentoValido('CE', 'AB12345')).toBe(true);
    expect(documentoValido('CE', 'ABC123')).toBe(false);
    expect(documentoValido('PASAPORTE', 'ABCDEFGHIJKLM')).toBe(false);
    expect(documentoValido('CEDULA', '1234567')).toBe(true);
  });

  it('pertenencia: cuenta el rol principal o cualquiera de los extra', () => {
    expect(tieneRol({ rol: 'CAJERO', roles: ['CAJERO', 'MOZO'] }, 'MOZO')).toBe(true);
    expect(tieneRol({ rol: 'CAJERO' }, 'MOZO')).toBe(false);
  });

  it('mozo con rol de alcance amplio: el más amplio manda (solo es mozo si no tiene CAJERO, SUPERVISOR ni ADMIN)', () => {
    expect(esSoloMozo({ rol: 'MOZO', roles: ['MOZO'] })).toBe(true);
    expect(esSoloMozo({ rol: 'MOZO', roles: ['MOZO', 'COCINA'] })).toBe(true);
    expect(esSoloMozo({ rol: 'CAJERO', roles: ['CAJERO', 'MOZO'] })).toBe(false);
    expect(esSoloMozo({ rol: 'MOZO', roles: ['MOZO', 'SUPERVISOR'] })).toBe(false);
    expect(rolEfectivoMozo({ rol: 'CAJERO', roles: ['CAJERO', 'MOZO'] })).toBe('CAJERO');
    expect(rolEfectivoMozo({ rol: 'MOZO', roles: ['MOZO', 'CAJERO'] })).toBe('CAJERO');
    expect(rolEfectivoMozo({ rol: 'MOZO', roles: ['MOZO'] })).toBe('MOZO');
  });

  it('permisos: unión sin repetir de todos los roles, consultados con rol in', async () => {
    const prisma: any = {
      rolPermiso: {
        findMany: jest.fn().mockResolvedValue([
          { permiso: { modulo: 'caja', accion: 'ver' } },
          { permiso: { modulo: 'pedidos', accion: 'crear' } },
          { permiso: { modulo: 'caja', accion: 'ver' } },
        ]),
      },
    };
    const permisos = await permisosDeRoles(prisma, ['CAJERO', 'MOZO']);
    expect(permisos).toEqual(['caja/ver', 'pedidos/crear']);
    expect(prisma.rolPermiso.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { rol: { in: ['CAJERO', 'MOZO'] } } }),
    );
  });
});

describe('UsuariosService: alta con varios roles, documento CE e importación', () => {
  let service: UsuariosService;
  let prismaMock: any;
  let auditoriaMock: any;
  let tx: any;

  beforeEach(async () => {
    tx = {
      party: { create: jest.fn().mockResolvedValue({ id: 30n }) },
      person: { create: jest.fn().mockResolvedValue({ party_id: 30n, nombres: 'Ana', apellidos: 'Ruiz' }) },
      partyIdentifier: { create: jest.fn().mockResolvedValue({}) },
      userAccount: {
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 50n,
          party_id: 30n,
          rol: data.rol,
          debe_cambiar: true,
          activo: data.activo,
        })),
      },
      userAccountRol: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
      userAccountRolHistorial: { create: jest.fn().mockResolvedValue({}) },
      partyRole: { create: jest.fn().mockResolvedValue({}) },
    };
    prismaMock = {
      partyIdentifier: {
        // Por defecto el documento no existe; los que se indiquen sí
        findFirst: jest.fn().mockImplementation(async ({ where }: any) =>
          where.numero === '87654321'
            ? { id: 9n, party_id: 99n, tipo: 'DNI', numero: '87654321' }
            : null,
        ),
      },
      userAccount: { findUnique: jest.fn().mockResolvedValue({ id: 7n, party_id: 99n }), count: jest.fn() },
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    };
    auditoriaMock = { registrar: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: ArchivosService, useValue: { subirArchivo: jest.fn() } },
      ],
    }).compile();
    service = module.get(UsuariosService);
  });

  it('alta con CE de 7 caracteres, rol principal CAJERO y extra MOZO: guarda el tipo y los roles extra', async () => {
    const r = await service.crear(
      {
        nombres: 'Ana',
        apellidos: 'Ruiz',
        tipoDocumento: 'CE',
        documento: 'ab12345',
        rol: 'CAJERO',
        otrosRoles: ['MOZO'],
        fechaIngreso: '2024-07-02',
        paisNacimiento: 'Venezuela',
      } as any,
      admin,
    );

    expect(r.tipoDocumento).toBe('CE');
    expect(r.roles).toEqual(['CAJERO', 'MOZO']);
    expect(tx.partyIdentifier.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: 'CE', numero: 'AB12345' }),
    });
    expect(tx.userAccountRol.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ user_account_id: 50n, rol: 'MOZO' })],
    });
    // El ingreso es el inicio del periodo TRABAJADOR, no una columna de la cuenta
    expect(tx.partyRole.create).toHaveBeenCalledTimes(1);
    expect(tx.partyRole.create.mock.calls[0][0].data).toMatchObject({ rol: 'TRABAJADOR', desde: new Date('2024-07-02T00:00:00.000Z'), hasta: null });
    expect(tx.person.create.mock.calls[0][0].data.pais_nacimiento).toBe('Venezuela');
  });

  it('rechaza ADMIN combinado con otro rol (400 ROLES_INVALIDOS) y un DNI de 7 dígitos (400)', async () => {
    await expect(
      service.crear({ nombres: 'A', apellidos: 'B', dni: '12345678', rol: 'ADMIN', otrosRoles: ['CAJERO'] } as any, admin),
    ).rejects.toMatchObject({ response: { codigo: 'ROLES_INVALIDOS' } });
    await expect(
      service.crear({ nombres: 'A', apellidos: 'B', dni: '1234567', rol: 'CAJERO' } as any, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('importar: crea la fila válida con clave inicial = su documento, omite la que ya existe, rechaza la inválida y audita conteos', async () => {
    const filas = [
      { nombres: 'Ana', apellidos: 'Ruiz', tipoDocumento: 'CE', documento: 'AB12345', rol: 'CAJERO', otrosRoles: ['MOZO'] },
      { nombres: 'Luis', apellidos: 'Paz', tipoDocumento: 'DNI', documento: '87654321', rol: 'MOZO' },
      { nombres: 'Mal', apellidos: 'Dato', tipoDocumento: 'DNI', documento: '123', rol: 'MOZO' },
    ];

    const r: any = await service.importarPersonal(filas as any, { simular: false }, undefined, '10.0.0.1');

    expect(r.resultados).toEqual([
      { indice: 0, estado: 'CREADA', avisos: [] },
      { indice: 1, estado: 'YA_EXISTE' },
      expect.objectContaining({ indice: 2, estado: 'ERROR' }),
    ]);
    // La clave inicial es el documento, con debe_cambiar
    const datos = tx.userAccount.create.mock.calls[0][0].data;
    expect(await argon2.verify(datos.hash, 'AB12345')).toBe(true);
    expect(datos.debe_cambiar).toBe(true);
    expect(tx.userAccountRol.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({ user_account_id: 50n, rol: 'MOZO' })] });
    // Una sola auditoría, con conteos y sin nombres ni documentos
    const imp = auditoriaMock.registrar.mock.calls.map((c: any[]) => c[0]).filter((a: any) => a.accion === 'IMPORTAR_PERSONAL');
    expect(imp).toHaveLength(1);
    expect(imp[0].despues).toEqual({ filas: 3, creados: 1, omitidos: 1, errores: 1 });
    expect(JSON.stringify(imp[0], (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toMatch(/Ana|Ruiz|AB12345/);
  });

  it('importar simulacro: dice OK / YA_EXISTE / ERROR por fila y no escribe ni audita', async () => {
    const filas = [
      { nombres: 'Ana', apellidos: 'Ruiz', tipoDocumento: 'CE', documento: 'AB12345', rol: 'CAJERO' },
      { nombres: 'Luis', apellidos: 'Paz', documento: '87654321', rol: 'MOZO' },
      { nombres: 'Mal', apellidos: 'Dato', documento: '123', rol: 'MOZO' },
    ];
    const r: any = await service.importarPersonal(filas as any, { simular: true });
    expect(r.resultados.map((x: any) => x.estado)).toEqual(['OK', 'YA_EXISTE', 'ERROR']);
    expect(tx.userAccount.create).not.toHaveBeenCalled();
    expect(auditoriaMock.registrar).not.toHaveBeenCalled();
  });

  it('importar: documento repetido en el archivo se omite; máximo 200 filas', async () => {
    const dup = [
      { nombres: 'A', apellidos: 'B', documento: 'AB12345', tipoDocumento: 'CE', rol: 'MOZO' },
      { nombres: 'C', apellidos: 'D', documento: 'AB12345', tipoDocumento: 'CE', rol: 'MOZO' },
    ];
    const r: any = await service.importarPersonal(dup as any, { simular: true });
    expect(r.resultados.map((x: any) => x.estado)).toEqual(['OK', 'DUPLICADO_EN_ARCHIVO']);
    const muchas = Array.from({ length: 201 }, () => ({ nombres: 'A', apellidos: 'B', documento: '12345678', rol: 'MOZO' }));
    await expect(service.importarPersonal(muchas as any, { simular: true })).rejects.toMatchObject({
      response: { codigo: 'DEMASIADAS_FILAS' },
    });
  });
});
