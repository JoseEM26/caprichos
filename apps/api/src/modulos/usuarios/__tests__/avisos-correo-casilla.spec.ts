jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UsuariosService } from '../usuarios.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ArchivosService } from '../../archivos/archivos.service';

describe('Alta: casilla de avisos por correo y horario 24/7', () => {
  let service: UsuariosService;
  let tx: any;

  beforeEach(async () => {
    tx = {
      party: { create: jest.fn().mockResolvedValue({ id: 10n }) },
      person: {
        create: jest.fn(({ data }: any) => Promise.resolve({ nombres: data.nombres, correo: data.correo ?? null, horario_24_7: data.horario_24_7 })),
      },
      partyIdentifier: { create: jest.fn().mockResolvedValue({}) },
      userAccount: { create: jest.fn().mockResolvedValue({ id: 5n, rol: 'MOZO', activo: true, debe_cambiar: true }) },
      partyRole: { create: jest.fn() },
    };
    const prisma: any = {
      partyIdentifier: { findFirst: jest.fn().mockResolvedValue(null) },
      contactMechanism: { findFirst: jest.fn().mockResolvedValue(null) },
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

  const base = { nombres: 'Ana', apellidos: 'Paz', dni: '12345678' };

  it('ADMIN con correo: casilla encendida por defecto y 24/7 por defecto', async () => {
    await service.crear({ ...base, rol: 'ADMIN', correo: 'ana@caprichos.pe' });
    expect(tx.userAccount.create.mock.calls[0][0].data.avisos_correo).toBe(true);
    expect(tx.person.create.mock.calls[0][0].data.horario_24_7).toBe(true);
  });

  it('SUPERVISOR con correo: casilla encendida; CAJERO: apagada y sin 24/7', async () => {
    await service.crear({ ...base, rol: 'SUPERVISOR', correo: 'sup@caprichos.pe' });
    expect(tx.userAccount.create.mock.calls[0][0].data.avisos_correo).toBe(true);
    await service.crear({ ...base, dni: '87654321', rol: 'CAJERO', correo: 'caja@caprichos.pe' });
    expect(tx.userAccount.create.mock.calls[1][0].data.avisos_correo).toBe(false);
    expect(tx.person.create.mock.calls[1][0].data.horario_24_7).toBe(false);
  });

  it('pedir la casilla sin correo es error (y no guarda nada)', async () => {
    await expect(service.crear({ ...base, rol: 'CAJERO', avisosCorreo: true })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.userAccount.create).not.toHaveBeenCalled();
  });

  it('ADMIN sin correo: no queda con casilla (no falla el alta)', async () => {
    await service.crear({ ...base, rol: 'ADMIN' });
    expect(tx.userAccount.create.mock.calls[0][0].data.avisos_correo).toBe(false);
  });
});
