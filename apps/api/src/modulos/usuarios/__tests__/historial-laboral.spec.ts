jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { UsuariosService } from '../usuarios.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { UsuarioAutenticado } from '../../acceso/acceso.tipos';
import { fechaDia } from '../periodos-laborales';

const admin: UsuarioAutenticado = { partyId: 1n, rol: 'ADMIN', debeCambiar: false, roles: ['ADMIN'] };
const d = (t: string) => fechaDia(t) as Date;

describe('historial laboral (periodos TRABAJADOR)', () => {
  let service: UsuariosService;
  let prisma: any;
  let tx: any;
  let auditoria: any;
  let periodosBD: any[];
  let cuenta: any;

  beforeEach(async () => {
    periodosBD = [];
    cuenta = { id: 5n, party_id: 10n, rol: 'CAJERO', activo: true, debe_cambiar: false };
    tx = {
      party: { create: jest.fn().mockResolvedValue({ id: 10n }) },
      person: { create: jest.fn().mockResolvedValue({ party_id: 10n, nombres: 'Ana', apellidos: 'Ruiz' }) },
      partyIdentifier: { create: jest.fn().mockResolvedValue({}) },
      userAccount: {
        update: jest.fn(),
        create: jest.fn().mockResolvedValue({ id: 50n, party_id: 10n, rol: 'CAJERO', debe_cambiar: true, activo: true }),
      },
      userAccountRol: { createMany: jest.fn() },
      partyRole: { create: jest.fn().mockResolvedValue({}), update: jest.fn() },
      sesion: { updateMany: jest.fn() },
    };
    prisma = {
      partyIdentifier: { findFirst: jest.fn().mockResolvedValue(null) },
      userAccount: {
        findUnique: jest.fn(async () => ({ ...cuenta, party: { documentos: [], persona: null } })),
        count: jest.fn().mockResolvedValue(2),
      },
      partyRole: {
        findFirst: jest.fn(async ({ where }: any) => periodosBD.find((p) => (where.hasta === null ? p.hasta === null : true)) ?? null),
        findMany: jest.fn(async ({ where }: any) => periodosBD.filter((p) => !where.id || p.id !== where.id.not)),
        create: jest.fn(async ({ data }: any) => ({ id: BigInt(periodosBD.length + 1), ...data })),
        update: jest.fn(async ({ where, data }: any) => ({ id: where.id, ...data })),
      },
      sesion: { updateMany: jest.fn() },
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };
    auditoria = { registrar: jest.fn().mockResolvedValue(undefined) };
    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: auditoria },
        { provide: ArchivosService, useValue: { subirArchivo: jest.fn() } },
      ],
    }).compile();
    service = mod.get(UsuariosService);
  });

  it('crear con reingreso: periodo 1 hasta el día anterior al reingreso, periodo 2 abierto, y aviso de salida no registrada', async () => {
    const dto: any = {
      nombres: 'Ana', apellidos: 'Ruiz', documento: '12345678', rol: 'CAJERO',
      fechaIngreso: '2024-07-02', fechaReingreso: '2025-06-20',
    };
    const r: any = await service.crear(dto, admin);
    const periodos = tx.partyRole.create.mock.calls.map((c: any[]) => c[0].data);
    expect(periodos).toEqual([
      expect.objectContaining({ rol: 'TRABAJADOR', desde: d('2024-07-02'), hasta: d('2025-06-19') }),
      expect.objectContaining({ rol: 'TRABAJADOR', desde: d('2025-06-20'), hasta: null }),
    ]);
    expect(r.avisos).toEqual(['Fecha de salida no registrada: corregir en el historial laboral.']);
  });

  it('crear solo con ingreso: un periodo abierto desde esa fecha; el reingreso anterior al ingreso es 400', async () => {
    await service.crear({ nombres: 'A', apellidos: 'B', documento: '12345678', rol: 'MOZO', fechaIngreso: '2024-07-02' } as any, admin);
    expect(tx.partyRole.create.mock.calls[0][0].data).toMatchObject({ desde: d('2024-07-02'), hasta: null });
    await expect(
      service.crear({ nombres: 'A', apellidos: 'B', documento: '87654321', rol: 'MOZO', fechaIngreso: '2024-07-02', fechaReingreso: '2024-01-01' } as any, admin),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('desactivar cierra el periodo abierto con la fecha de salida y audita el motivo', async () => {
    periodosBD = [{ id: 1n, party_id: 10n, rol: 'TRABAJADOR', desde: d('2024-07-02'), hasta: null }];
    await service.desactivar(5n, admin, '1.1.1.1', { fechaSalida: '2025-03-15', motivo: 'Renuncia' });
    expect(tx.partyRole.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { hasta: d('2025-03-15') } });
    expect(tx.userAccount.update).toHaveBeenCalledWith({ where: { id: 5n }, data: { activo: false } });
    const audit = auditoria.registrar.mock.calls.map((c: any[]) => c[0]).find((a: any) => a.accion === 'DESACTIVAR');
    expect(audit.motivo).toBe('Renuncia');
    expect(audit.despues).toMatchObject({ fechaSalida: '2025-03-15', periodoCerrado: true });
  });

  it('desactivar con salida anterior al ingreso del periodo abierto: 400 y no desactiva', async () => {
    periodosBD = [{ id: 1n, party_id: 10n, rol: 'TRABAJADOR', desde: d('2024-07-02'), hasta: null }];
    await expect(service.desactivar(5n, admin, undefined, { fechaSalida: '2024-01-01' })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.userAccount.update).not.toHaveBeenCalled();
  });

  it('reactivar abre un periodo nuevo y copia el descuento del último', async () => {
    cuenta.activo = false;
    periodosBD = [{ id: 1n, party_id: 10n, rol: 'TRABAJADOR', desde: d('2024-07-02'), hasta: d('2025-03-15'), employee_detail: { descuento_pct: 20 } }];
    await service.reactivar(5n, admin, undefined, { fechaReingreso: '2025-06-20' });
    expect(tx.partyRole.create.mock.calls[0][0].data).toMatchObject({
      rol: 'TRABAJADOR', desde: d('2025-06-20'), hasta: null, employee_detail: { create: { descuento_pct: 20 } },
    });
  });

  it('reactivar con un periodo abierto (licencia) solo activa la cuenta, sin periodo nuevo', async () => {
    cuenta.activo = false;
    periodosBD = [{ id: 1n, party_id: 10n, rol: 'TRABAJADOR', desde: d('2024-07-02'), hasta: null, employee_detail: null }];
    await service.reactivar(5n, admin, undefined, {});
    expect(tx.partyRole.create).not.toHaveBeenCalled();
    expect(tx.userAccount.update).toHaveBeenCalledWith({ where: { id: 5n }, data: { activo: true } });
  });

  it('reactivar con fecha que se cruza con un periodo cerrado: 400 PERIODO_INVALIDO', async () => {
    cuenta.activo = false;
    periodosBD = [{ id: 1n, party_id: 10n, rol: 'TRABAJADOR', desde: d('2024-07-02'), hasta: d('2025-03-15'), employee_detail: null }];
    await expect(service.reactivar(5n, admin, undefined, { fechaReingreso: '2025-03-10' })).rejects.toMatchObject({
      response: { codigo: 'PERIODO_INVALIDO' },
    });
  });

  it('historial: duraciones, tiempo total, veces que salió y licencia', async () => {
    cuenta.activo = false;
    periodosBD = [
      { id: 1n, party_id: 10n, rol: 'TRABAJADOR', desde: d('2024-07-02'), hasta: d('2025-03-15') },
      { id: 2n, party_id: 10n, rol: 'TRABAJADOR', desde: d('2025-06-20'), hasta: null },
    ];
    const h: any = await service.historialLaboral(5n);
    expect(h.periodos[0]).toMatchObject({ desde: '2024-07-02', hasta: '2025-03-15', abierto: false, duracion: '8 meses 13 días' });
    expect(h.periodos[1]).toMatchObject({ abierto: true });
    expect(h.vecesSalio).toBe(1);
    expect(h.enLicencia).toBe(true);
    expect(h.tiempoTotal).toMatch(/^\d+ (mes|meses|año|años)/);
  });

  it('editar periodo: sin solapes y desde ≤ hasta; solo ADMIN; audita el cambio', async () => {
    periodosBD = [
      { id: 1n, party_id: 10n, rol: 'TRABAJADOR', desde: d('2024-07-02'), hasta: d('2025-03-15') },
      { id: 2n, party_id: 10n, rol: 'TRABAJADOR', desde: d('2025-06-20'), hasta: null },
    ];
    // se cruza con el periodo 2
    await expect(service.editarPeriodo(5n, 1n, { desde: '2024-07-02', hasta: '2025-07-01' }, admin)).rejects.toMatchObject({
      response: { codigo: 'PERIODO_INVALIDO' },
    });
    // salida antes del ingreso
    await expect(service.editarPeriodo(5n, 1n, { desde: '2024-07-02', hasta: '2024-06-01' }, admin)).rejects.toBeInstanceOf(BadRequestException);
    // no ADMIN
    const cajero: UsuarioAutenticado = { partyId: 2n, rol: 'CAJERO', debeCambiar: false };
    await expect(service.editarPeriodo(5n, 1n, { desde: '2024-07-02', hasta: '2025-03-10' }, cajero)).rejects.toBeInstanceOf(ForbiddenException);
    // válido
    await service.editarPeriodo(5n, 1n, { desde: '2024-07-03', hasta: '2025-03-10' }, admin);
    expect(tx.partyRole.update).not.toHaveBeenCalled();
    expect(prisma.partyRole.update).toHaveBeenCalledWith({ where: { id: 1n }, data: { desde: d('2024-07-03'), hasta: d('2025-03-10') } });
    const audit = auditoria.registrar.mock.calls.map((c: any[]) => c[0]).find((a: any) => a.accion === 'PERIODO_EDITAR');
    expect(audit.despues).toEqual({ desde: '2024-07-03', hasta: '2025-03-10' });
  });

  it('importar con reingreso: la fila creada trae el aviso y abre los dos periodos', async () => {
    const fila = { nombres: 'Luis', apellidos: 'Paz', documento: '87654321', tipoDocumento: 'DNI', rol: 'MOZO', fechaIngreso: '2023-01-10', fechaReingreso: '2025-02-01', activo: false };
    const r: any = await service.importarPersonal([fila] as any, { simular: false }, admin, '1.1.1.1');
    expect(r.resultados).toEqual([expect.objectContaining({ indice: 0, estado: 'CREADA', avisos: ['Fecha de salida no registrada: corregir en el historial laboral.'] })]);
    const periodos = tx.partyRole.create.mock.calls.map((c: any[]) => c[0].data);
    expect(periodos[0]).toMatchObject({ desde: d('2023-01-10'), hasta: d('2025-01-31') });
    expect(periodos[1]).toMatchObject({ desde: d('2025-02-01'), hasta: null });
    expect(tx.userAccount.create.mock.calls[0][0].data.activo).toBe(false);
  });
});
