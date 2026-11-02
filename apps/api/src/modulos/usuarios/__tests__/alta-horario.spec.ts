jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsuariosService } from '../usuarios.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ArchivosService } from '../../archivos/archivos.service';

describe('Alta y edición con horario y reemplazos', () => {
  let service: UsuariosService;
  let prisma: any;
  let tx: any;

  beforeEach(async () => {
    tx = {
      party: { create: jest.fn().mockResolvedValue({ id: 10n }) },
      person: { create: jest.fn().mockResolvedValue({ nombres: 'Ana', apellidos: 'Paz' }) },
      partyIdentifier: { create: jest.fn().mockResolvedValue({}) },
      userAccount: {
        create: jest.fn().mockResolvedValue({ id: 5n, rol: 'MOZO', activo: true, debe_cambiar: true }),
        findMany: jest.fn().mockResolvedValue([{ party_id: 20n }]),
      },
      contactMechanism: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
      partyRole: { create: jest.fn() },
      horarioTrabajo: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      reemplazoDia: { upsert: jest.fn(), updateMany: jest.fn() },
    };
    prisma = {
      partyIdentifier: { findFirst: jest.fn().mockResolvedValue(null) },
      contactMechanism: { findFirst: jest.fn().mockResolvedValue(null) },
      userAccount: { findUnique: jest.fn().mockResolvedValue({ id: 5n, party_id: 10n }) },
      horarioTrabajo: { findMany: jest.fn().mockResolvedValue([]) },
      reemplazoDia: { findMany: jest.fn().mockResolvedValue([]) },
      $transaction: jest.fn((cb: any) => cb(tx)),
    };
    const mod = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: ArchivosService, useValue: { subirArchivo: jest.fn() } },
      ],
    }).compile();
    service = mod.get(UsuariosService);
  });

  const base = { nombres: 'Ana', apellidos: 'Paz', dni: '12345678', rol: 'MOZO' };

  it('crea persona, cuenta, horario y reemplazos en una sola transacción', async () => {
    await service.crear({
      ...base,
      celular: '987654321',
      descuentoPct: 10,
      horarios: [
        { dia: 1, entrada: '13:00', salida: '21:00' },
        { dia: 2, entrada: '22:00', salida: '06:00' },
      ],
      reemplazos: [{ dia: 0, reemplazaPartyId: '20' }],
    });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.horarioTrabajo.create).toHaveBeenCalledTimes(2);
    expect(tx.reemplazoDia.upsert).toHaveBeenCalledTimes(1);
    expect(tx.contactMechanism.create).toHaveBeenCalled();
    expect(tx.partyRole.create).toHaveBeenCalled();
  });

  it('reemplazo que no es personal activo -> 400 y no guarda reemplazos', async () => {
    tx.userAccount.findMany.mockResolvedValue([]);
    await expect(
      service.crear({ ...base, reemplazos: [{ dia: 0, reemplazaPartyId: '99' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.reemplazoDia.upsert).not.toHaveBeenCalled();
  });

  it('reemplazo igual a la misma persona -> 400', async () => {
    await expect(
      service.configurarHorario('5', { reemplazos: [{ dia: 0, reemplazaPartyId: '10' }] }),
    ).rejects.toMatchObject({ response: { codigo: 'REEMPLAZO_MISMA_PERSONA' } });
  });

  it('entrada igual a salida -> 400', async () => {
    await expect(
      service.configurarHorario('5', { horarios: [{ dia: 1, entrada: '09:00', salida: '09:00' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('editar desactiva el día que ya no trabaja, sin borrar', async () => {
    tx.horarioTrabajo.findMany.mockResolvedValue([{ id: 1n, dia_semana: 3, activo: true }]);
    await service.configurarHorario('5', { horarios: [{ dia: 1, entrada: '08:00', salida: '16:00' }] });
    expect(tx.horarioTrabajo.updateMany).toHaveBeenCalledWith({
      where: { id: { in: [1n] } },
      data: { activo: false },
    });
  });
});
