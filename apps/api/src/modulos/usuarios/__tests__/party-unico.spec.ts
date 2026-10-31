jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { UsuariosService } from '../usuarios.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { AvisosInternosService } from '../../chatbot/avisos-internos/avisos-internos.service';

/** Una persona = un party: alta de personal reutilizando parties de puntos o de clientes. */
describe('Usuarios: una persona = un party', () => {
  let service: UsuariosService;
  let prisma: any;
  let tx: any;

  const base = { nombres: 'Ana', apellidos: 'Paz', dni: '12345678', rol: 'MOZO' };

  beforeEach(async () => {
    tx = {
      party: { create: jest.fn().mockResolvedValue({ id: 10n }) },
      person: {
        create: jest.fn().mockResolvedValue({ nombres: 'Ana', apellidos: 'Paz' }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ nombres: 'Ana', apellidos: 'Paz' }),
      },
      partyIdentifier: { create: jest.fn().mockResolvedValue({ id: 1n }) },
      userAccount: {
        create: jest.fn().mockResolvedValue({ id: 5n, party_id: 20n, rol: 'MOZO', activo: true, debe_cambiar: true }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      contactMechanism: {
        create: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      partyRole: { create: jest.fn() },
    };
    prisma = {
      partyIdentifier: { findUnique: jest.fn().mockResolvedValue(null) },
      contactMechanism: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
      userAccount: { findUnique: jest.fn().mockResolvedValue(null) },
      person: { findUnique: jest.fn() },
      $transaction: jest.fn((cb: any) => cb(tx)),
    };
    const mod = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditoriaService, useValue: { registrar: jest.fn() } },
        { provide: ArchivosService, useValue: { subirArchivo: jest.fn() } },
        { provide: AvisosInternosService, useValue: { enviarPruebaAlertas: jest.fn() } },
      ],
    }).compile();
    service = mod.get(UsuariosService);
  });

  it('DNI de un party de puntos (sin usuario): se reutiliza, no crea party ni DNI, reemplaza el placeholder Cliente', async () => {
    prisma.partyIdentifier.findUnique.mockResolvedValue({ id: 3n, party_id: 20n, tipo: 'DNI', numero: '12345678' });
    tx.person.findUnique.mockResolvedValue({ party_id: 20n, nombres: 'Cliente', apellidos: null, correo: null, cumple_mes: null });

    const r = await service.crear({ ...base, celular: '987654321' });

    expect(tx.party.create).not.toHaveBeenCalled();
    expect(tx.partyIdentifier.create).not.toHaveBeenCalled();
    expect(tx.person.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { party_id: 20n }, data: expect.objectContaining({ nombres: 'Ana', apellidos: 'Paz' }) }),
    );
    expect(tx.userAccount.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ party_id: 20n, rol: 'MOZO' }) }));
    expect(r.partyId).toBe('20');
  });

  it('reutilizado: si el nombre ya es real no lo pisa', async () => {
    prisma.partyIdentifier.findUnique.mockResolvedValue({ id: 3n, party_id: 20n, tipo: 'DNI', numero: '12345678' });
    tx.person.findUnique.mockResolvedValue({ party_id: 20n, nombres: 'Rosa', apellidos: 'Lopez', correo: 'r@x.pe', cumple_mes: 3 });

    await service.crear(base);

    expect(tx.person.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nombres: 'Rosa', apellidos: 'Lopez' }) }),
    );
  });

  it('celular de un party de puntos (sin usuario): se reutiliza y su TELEFONO pasa a WHATSAPP, sin fila duplicada', async () => {
    prisma.contactMechanism.findFirst.mockResolvedValue({ party_id: 20n });
    tx.person.findUnique.mockResolvedValue({ party_id: 20n, nombres: 'Cliente' });
    tx.contactMechanism.findMany.mockResolvedValue([{ id: 100n, party_id: 20n, tipo: 'TELEFONO', valor: '987654321' }]);
    tx.contactMechanism.findFirst.mockResolvedValue({ id: 100n, party_id: 20n, tipo: 'TELEFONO', valor: '987654321' });

    await service.crear({ ...base, celular: '987654321' });

    expect(tx.party.create).not.toHaveBeenCalled();
    expect(tx.contactMechanism.update).toHaveBeenCalledWith({ where: { id: 100n }, data: { tipo: 'WHATSAPP' } });
    expect(tx.contactMechanism.create).not.toHaveBeenCalled();
    expect(tx.userAccount.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ party_id: 20n }) }));
  });

  it('DNI de un party que ya tiene usuario: 409 DNI_DUPLICADO y no toca nada', async () => {
    prisma.partyIdentifier.findUnique.mockResolvedValue({ id: 3n, party_id: 20n, tipo: 'DNI', numero: '12345678' });
    prisma.userAccount.findUnique.mockResolvedValue({ id: 9n, party_id: 20n });

    await expect(service.crear(base)).rejects.toMatchObject({ response: { codigo: 'DNI_DUPLICADO' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('celular de un party que ya tiene usuario: 409 CELULAR_DUPLICADO y no toca nada', async () => {
    prisma.contactMechanism.findFirst.mockResolvedValue({ party_id: 20n });
    prisma.userAccount.findUnique.mockResolvedValue({ id: 9n, party_id: 20n });

    await expect(service.crear({ ...base, celular: '987654321' })).rejects.toMatchObject({
      response: { codigo: 'CELULAR_DUPLICADO' },
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('celular de otra persona dentro de la transacción (DNI nuevo): 409 CELULAR_DUPLICADO', async () => {
    tx.contactMechanism.findMany.mockResolvedValue([{ party_id: 77n }]);

    await expect(service.crear({ ...base, celular: '987654321' })).rejects.toBeInstanceOf(ConflictException);
    await expect(service.crear({ ...base, celular: '987654321' })).rejects.toMatchObject({
      response: { codigo: 'CELULAR_DUPLICADO', mensaje: 'Ese celular ya esta registrado en otra persona' },
    });
  });

  it('choque de unicidad (P2002) con un DNI libre: 409 CELULAR_DUPLICADO, nunca 500', async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });

    await expect(service.crear({ ...base, celular: '987654321' })).rejects.toMatchObject({
      response: { codigo: 'CELULAR_DUPLICADO' },
    });
  });

  it('choque de unicidad (P2002) cuando el DNI ya existe al reintentar: 409 DNI_DUPLICADO', async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });
    prisma.partyIdentifier.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 3n, party_id: 40n, tipo: 'DNI', numero: '12345678' });

    await expect(service.crear(base)).rejects.toMatchObject({ response: { codigo: 'DNI_DUPLICADO' } });
  });

  it('alertas WhatsApp: si el celular nuevo es de otra persona, 409 y no guarda', async () => {
    prisma.userAccount = { findUnique: jest.fn().mockResolvedValue({
      id: 10n,
      party_id: 20n,
      rol: 'ADMIN',
      alertas_whatsapp: false,
      alertas_whatsapp_confirmado_en: null,
      party: { persona: { nombres: 'Admin' }, contactos: [] },
    }) };
    tx.contactMechanism.findMany.mockResolvedValue([{ party_id: 77n }]);

    await expect(
      service.configurarAlertasWhatsapp('10', { celular: '922222222', alertasWhatsapp: true } as any),
    ).rejects.toMatchObject({ response: { codigo: 'CELULAR_DUPLICADO' } });
    expect(tx.contactMechanism.create).not.toHaveBeenCalled();
  });

  it('alertas WhatsApp: choque de unicidad en la BD se responde 409, no 500', async () => {
    prisma.userAccount = { findUnique: jest.fn().mockResolvedValue({
      id: 10n,
      party_id: 20n,
      rol: 'ADMIN',
      alertas_whatsapp: false,
      alertas_whatsapp_confirmado_en: null,
      party: { persona: { nombres: 'Admin' }, contactos: [] },
    }) };
    tx.contactMechanism.create.mockRejectedValueOnce({ code: 'P2002' });

    await expect(
      service.configurarAlertasWhatsapp('10', { celular: '922222222', alertasWhatsapp: true } as any),
    ).rejects.toMatchObject({ response: { codigo: 'CELULAR_DUPLICADO' } });
  });
});
