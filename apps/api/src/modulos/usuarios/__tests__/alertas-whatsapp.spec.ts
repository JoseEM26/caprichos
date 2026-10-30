jest.mock('../../../comun/socket/eventos.gateway', () => ({ EventosGateway: class {} }));

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsuariosService } from '../usuarios.service';
import { PrismaService } from '../../../comun/prisma/prisma.service';
import { AuditoriaService } from '../../auditoria/auditoria.service';
import { ArchivosService } from '../../archivos/archivos.service';
import { AvisosInternosService } from '../../chatbot/avisos-internos/avisos-internos.service';
import { UsuarioAutenticado } from '../../acceso/acceso.tipos';
import {
  calcularEstadoAlertas,
  normalizarCelularPeru,
  ROLES_ALERTAS_WHATSAPP,
} from '../alertas-whatsapp.util';

describe('Alertas WhatsApp en Usuarios (Contrato Caprichos - Sección 1)', () => {
  let service: UsuariosService;
  let prismaMock: any;
  let auditoriaMock: any;
  let avisosInternosMock: any;

  const adminAuth: UsuarioAutenticado = {
    partyId: 1n,
    rol: 'ADMIN',
    debeCambiar: false,
  };

  beforeEach(async () => {
    prismaMock = {
      userAccount: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      contactMechanism: {
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn().mockImplementation((cb) => cb(prismaMock)),
    };

    auditoriaMock = {
      registrar: jest.fn().mockResolvedValue(undefined),
    };

    avisosInternosMock = {
      enviarPruebaAlertas: jest.fn().mockResolvedValue({ exito: true, estado: 'ENVIADO' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: AuditoriaService, useValue: auditoriaMock },
        { provide: ArchivosService, useValue: { subirArchivo: jest.fn() } },
        { provide: AvisosInternosService, useValue: avisosInternosMock },
      ],
    }).compile();

    service = module.get<UsuariosService>(UsuariosService);
  });

  describe('Utilidades de normalización y estado', () => {
    it('normaliza correctamente teléfonos peruanos de 9 dígitos que inician con 9', () => {
      expect(normalizarCelularPeru('987654321')).toEqual({
        valido: true,
        celular9: '987654321',
        celularE164: '51987654321',
      });

      expect(normalizarCelularPeru('+51 987 654 321')).toEqual({
        valido: true,
        celular9: '987654321',
        celularE164: '51987654321',
      });

      expect(normalizarCelularPeru('51987654321')).toEqual({
        valido: true,
        celular9: '987654321',
        celularE164: '51987654321',
      });
    });

    it('rechaza números que no cumplen el formato peruano', () => {
      expect(normalizarCelularPeru('123456789').valido).toBe(false);
      expect(normalizarCelularPeru('98765432').valido).toBe(false);
      expect(normalizarCelularPeru('51887654321').valido).toBe(false);
      expect(normalizarCelularPeru('').valido).toBe(false);
      expect(normalizarCelularPeru(null).valido).toBe(false);
    });

    it('calcula correctamente los 3 estados: Sin alertas, Pendiente de confirmar, Confirmado', () => {
      expect(calcularEstadoAlertas(false, null)).toBe('SIN_ALERTAS');
      expect(calcularEstadoAlertas(true, null)).toBe('PENDIENTE');
      expect(calcularEstadoAlertas(true, new Date())).toBe('CONFIRMADO');
    });

    it('restringe la lista de roles por defecto a ADMIN', () => {
      expect(ROLES_ALERTAS_WHATSAPP).toContain('ADMIN');
      expect(ROLES_ALERTAS_WHATSAPP).not.toContain('MOZO');
      expect(ROLES_ALERTAS_WHATSAPP).not.toContain('CAJERO');
    });
  });

  describe('Consultar estado de alertas (GET /admin/usuarios/:id/alertas-whatsapp)', () => {
    it('devuelve el estado de alertas de un usuario ADMIN con número configurado', async () => {
      prismaMock.userAccount.findUnique.mockResolvedValueOnce({
        id: 10n,
        party_id: 20n,
        rol: 'ADMIN',
        activo: true,
        alertas_whatsapp: true,
        alertas_whatsapp_confirmado_en: new Date('2026-10-27T10:00:00Z'),
        party: {
          persona: { nombres: 'Kevin', apellidos: 'Dueño' },
          contactos: [
            { id: 100n, tipo: 'WHATSAPP', valor: '987654321', principal: true, activo: true },
          ],
        },
      });

      const res = await service.obtenerAlertasWhatsapp('10');
      expect(res.usuarioId).toBe('10');
      expect(res.rolPermitido).toBe(true);
      expect(res.alertasWhatsapp).toBe(true);
      expect(res.celular).toBe('987654321');
      expect(res.celularNormalizado).toBe('51987654321');
      expect(res.estado).toBe('CONFIRMADO');
    });

    it('indica rolPermitido=false si el usuario no tiene rol ADMIN', async () => {
      prismaMock.userAccount.findUnique.mockResolvedValueOnce({
        id: 11n,
        party_id: 21n,
        rol: 'CAJERO',
        activo: true,
        alertas_whatsapp: false,
        alertas_whatsapp_confirmado_en: null,
        party: { persona: { nombres: 'Cajero', apellidos: 'Prueba' }, contactos: [] },
      });

      const res = await service.obtenerAlertasWhatsapp('11');
      expect(res.rolPermitido).toBe(false);
      expect(res.estado).toBe('SIN_ALERTAS');
    });

    it('lanza 404 si el usuario no existe', async () => {
      prismaMock.userAccount.findUnique.mockResolvedValueOnce(null);
      await expect(service.obtenerAlertasWhatsapp('99')).rejects.toThrow(NotFoundException);
    });
  });

  describe('Guardar número y casilla (PUT /admin/usuarios/:id/alertas-whatsapp)', () => {
    it('rechaza con 400 si el usuario no tiene rol ADMIN', async () => {
      prismaMock.userAccount.findUnique.mockResolvedValueOnce({
        id: 12n,
        rol: 'MOZO',
        party_id: 22n,
      });

      await expect(
        service.configurarAlertasWhatsapp('12', { alertasWhatsapp: true, celular: '987654321' }, adminAuth),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza con 400 si el formato del celular no es válido', async () => {
      prismaMock.userAccount.findUnique.mockResolvedValueOnce({
        id: 10n,
        rol: 'ADMIN',
        party_id: 20n,
        party: { contactos: [] },
      });

      await expect(
        service.configurarAlertasWhatsapp('10', { alertasWhatsapp: true, celular: '123456789' }, adminAuth),
      ).rejects.toThrow(BadRequestException);
    });

    it('guarda el número en contact_mechanism y envía prueba si se activa la casilla', async () => {
      prismaMock.userAccount.findUnique
        .mockResolvedValueOnce({
          id: 10n,
          party_id: 20n,
          rol: 'ADMIN',
          activo: true,
          alertas_whatsapp: false,
          alertas_whatsapp_confirmado_en: null,
          party: { persona: { nombres: 'Kevin' }, contactos: [] },
        })
        .mockResolvedValueOnce({
          id: 10n,
          party_id: 20n,
          rol: 'ADMIN',
          activo: true,
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: null,
          party: {
            persona: { nombres: 'Kevin' },
            contactos: [{ tipo: 'WHATSAPP', valor: '987654321', principal: true, activo: true }],
          },
        });

      const res = await service.configurarAlertasWhatsapp(
        '10',
        { alertasWhatsapp: true, celular: '987654321' },
        adminAuth,
        '127.0.0.1',
      );

      // Guardado en contact_mechanism
      expect(prismaMock.contactMechanism.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          party_id: 20n,
          tipo: 'WHATSAPP',
          valor: '987654321',
          principal: true,
          activo: true,
        }),
      });

      // Actualización en user_account
      expect(prismaMock.userAccount.update).toHaveBeenCalledWith({
        where: { id: 10n },
        data: {
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: null,
        },
      });

      // Envío automático de mensaje de prueba con botón "Sí, soy yo"
      expect(avisosInternosMock.enviarPruebaAlertas).toHaveBeenCalledWith(
        10n,
        '51987654321',
        'Kevin',
      );

      // Auditoría obligatoria
      expect(auditoriaMock.registrar).toHaveBeenCalledWith(
        expect.objectContaining({
          categoria: 'CAMBIO',
          modulo: 'usuarios',
          accion: 'CONFIGURAR_ALERTAS_WHATSAPP',
          entidad: 'user_account',
          entidadId: 10n,
        }),
      );

      expect(res.estado).toBe('PENDIENTE');
    });

    it('si cambia el número de celular, se borra la confirmación previa', async () => {
      prismaMock.userAccount.findUnique
        .mockResolvedValueOnce({
          id: 10n,
          party_id: 20n,
          rol: 'ADMIN',
          activo: true,
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: new Date('2026-10-25T10:00:00Z'),
          party: {
            persona: { nombres: 'Kevin' },
            contactos: [
              { id: 100n, tipo: 'WHATSAPP', valor: '911111111', principal: true, activo: true },
            ],
          },
        })
        .mockResolvedValueOnce({
          id: 10n,
          party_id: 20n,
          rol: 'ADMIN',
          activo: true,
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: null,
          party: {
            persona: { nombres: 'Kevin' },
            contactos: [
              { id: 100n, tipo: 'WHATSAPP', valor: '922222222', principal: true, activo: true },
            ],
          },
        });

      await service.configurarAlertasWhatsapp(
        '10',
        { alertasWhatsapp: true, celular: '922222222' },
        adminAuth,
      );

      // Actualiza el número existente
      expect(prismaMock.contactMechanism.update).toHaveBeenCalledWith({
        where: { id: 100n },
        data: expect.objectContaining({ valor: '922222222' }),
      });

      // Borra la confirmación anterior
      expect(prismaMock.userAccount.update).toHaveBeenCalledWith({
        where: { id: 10n },
        data: {
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: null,
        },
      });

      // Envía mensaje de prueba al nuevo número
      expect(avisosInternosMock.enviarPruebaAlertas).toHaveBeenCalledWith(
        10n,
        '51922222222',
        'Kevin',
      );
    });
  });

  describe('Enviar prueba manual y Confirmar alertas (POST)', () => {
    it('enviarPruebaAlertasWhatsapp invoca al servicio de mensajería con el botón "Sí, soy yo"', async () => {
      prismaMock.userAccount.findUnique.mockResolvedValueOnce({
        id: 10n,
        party_id: 20n,
        rol: 'ADMIN',
        activo: true,
        alertas_whatsapp: true,
        party: {
          persona: { nombres: 'Kevin' },
          contactos: [{ tipo: 'WHATSAPP', valor: '987654321', principal: true, activo: true }],
        },
      });

      const res = await service.enviarPruebaAlertasWhatsapp('10', adminAuth);
      expect(res.enviado).toBe(true);
      expect(avisosInternosMock.enviarPruebaAlertas).toHaveBeenCalledWith(
        '10',
        '51987654321',
        'Kevin',
      );
    });

    it('confirmarAlertasWhatsapp actualiza alertas_whatsapp_confirmado_en y pasa a estado CONFIRMADO', async () => {
      prismaMock.userAccount.findUnique
        .mockResolvedValueOnce({
          id: 10n,
          party_id: 20n,
          rol: 'ADMIN',
          activo: true,
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: null,
          party: {
            persona: { nombres: 'Kevin' },
            contactos: [{ tipo: 'WHATSAPP', valor: '987654321', principal: true, activo: true }],
          },
        })
        .mockResolvedValueOnce({
          id: 10n,
          party_id: 20n,
          rol: 'ADMIN',
          activo: true,
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: new Date(),
          party: {
            persona: { nombres: 'Kevin' },
            contactos: [{ tipo: 'WHATSAPP', valor: '987654321', principal: true, activo: true }],
          },
        });

      const res = await service.confirmarAlertasWhatsapp('10', adminAuth);
      expect(prismaMock.userAccount.update).toHaveBeenCalledWith({
        where: { id: 10n },
        data: expect.objectContaining({
          alertas_whatsapp: true,
          alertas_whatsapp_confirmado_en: expect.any(Date),
        }),
      });

      expect(res.estado).toBe('CONFIRMADO');
    });
  });
});
